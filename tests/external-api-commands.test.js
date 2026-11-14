const assert = require("node:assert/strict");
const dns = require("node:dns");
const dnsPromises = require("node:dns/promises");
const http = require("node:http");
const https = require("node:https");
const net = require("node:net");
const tls = require("node:tls");
const { beforeEach, test } = require("node:test");
const helper = require("../lib/http-client");
const { HttpRequestError } = helper;
const {
  requireSuccessfulResponse,
  apiErrorMessage,
} = require("../lib/api-errors");

beforeEach((t) => {
  const now = Date.now();
  t.mock.method(Date, "now", () => now);
  const block = () => {
    throw new Error("Somente transporte simulado é permitido.");
  };
  t.mock.method(dns, "lookup", block);
  t.mock.method(dnsPromises, "lookup", block);
  t.mock.method(net.Socket.prototype, "connect", block);
  t.mock.method(tls, "connect", block);
  t.mock.method(globalThis, "fetch", block);
  for (const transport of [http, https]) {
    t.mock.method(transport, "request", block);
    t.mock.method(transport, "get", block);
  }
});

const repo = {
  owner: { login: "test-user", avatar_url: "https://example.com/avatar.png" },
  full_name: "test-user/repo",
  html_url: "https://example.com/test-user/repo",
  description: "Descrição 🌎",
  language: "JavaScript",
  stargazers_count: 3,
  forks_count: 1,
};
const integrations = [
  {
    name: "github",
    options: { repositorio: "test-user/repo" },
    data: repo,
    private: false,
  },
  {
    name: "repositorys",
    options: { linguagem: "JavaScript" },
    data: { items: [repo], incomplete_results: false },
    private: false,
  },
  {
    name: "question",
    options: { pergunta: "How?" },
    data: {
      items: [{ title: "Como? 🌎", link: "https://example.com/question" }],
      quota_remaining: 10,
    },
    private: true,
  },
  {
    name: "translate",
    options: { idioma: "pt", texto: "Hello" },
    data: [
      [
        ["Olá ", null],
        ["🌎", null],
      ],
    ],
    private: true,
  },
  {
    name: "moeda",
    options: { valor: 10, origem: "USD", destino: "EUR" },
    data: { base: "USD", rates: { EUR: 0.9 } },
    private: true,
  },
  {
    name: "http",
    options: { codigo: 200 },
    data: { code: 200, description: "OK 🌎" },
    private: true,
  },
];
function fixture(options, failAt) {
  const events = [];
  const interaction = {
    createdTimestamp: Date.now(),
    deferred: false,
    replied: false,
    ephemeral: false,
    user: { id: "test-user" },
    options: {
      getString: (name) => options[name],
      getNumber: (name) => options[name],
      getInteger: (name) => options[name],
    },
  };
  for (const method of [
    "deferReply",
    "reply",
    "editReply",
    "followUp",
    "deleteReply",
  ]) {
    interaction[method] = async (payload) => {
      events.push({ method, payload });
      if (method === failAt) throw new Error("SENSITIVE_API_SEND_SENTINEL");
      if (method === "deferReply") interaction.deferred = true;
      if (method === "reply" || method === "editReply")
        interaction.replied = true;
    };
  }
  return { interaction, events };
}
function meaningful(events) {
  const results = events.filter(
    ({ method, payload }) =>
      ["reply", "editReply", "followUp"].includes(method) &&
      (payload?.embeds ||
        payload?.files ||
        (payload?.content && payload.content !== "\u200b")),
  );
  assert.equal(results.length, 1);
  return results[0];
}
async function execute(
  scenario,
  response,
  { failAt, throwError = false, requestImpl } = {},
) {
  const { interaction, events } = fixture(scenario.options, failAt);
  const commandPath = require.resolve(`../commands/${scenario.name}`);
  const helperPath = require.resolve("../lib/http-client");
  const previousHelper = require.cache[helperPath];
  const previousCommand = require.cache[commandPath];
  const requests = [];
  const pauses = [];
  const request = async (url, options) => {
    assert.equal(interaction.deferred, true);
    requests.push({ url, options });
    if (requestImpl) return requestImpl(url, options);
    if (throwError) throw response;
    return response;
  };
  require.cache[helperPath] = {
    id: helperPath,
    filename: helperPath,
    loaded: true,
    exports: {
      ...helper,
      getJson: request,
      fetchJson: request,
      pauseStackExchange: (seconds) => pauses.push(seconds),
    },
  };
  delete require.cache[commandPath];
  try {
    await require(commandPath).execute(interaction);
  } finally {
    if (previousHelper) require.cache[helperPath] = previousHelper;
    else delete require.cache[helperPath];
    if (previousCommand) require.cache[commandPath] = previousCommand;
    else delete require.cache[commandPath];
  }
  const result = meaningful(events);
  assert.equal(
    requests.length,
    1,
    "Consulta não deve repetir automaticamente.",
  );
  return { result, payload: result.payload, events, requests, pauses };
}
function assertPrivacy(result, isPrivate) {
  assert.equal(result.method, isPrivate ? "followUp" : "editReply");
  assert.equal(Boolean(result.payload.flags & 64), isPrivate);
}
const limitMessage =
  "O serviço atingiu um limite temporário de consultas. Tente novamente mais tarde.";
const unavailableMessage =
  "O serviço está indisponível no momento. Tente novamente mais tarde.";
const invalidMessage =
  "O serviço retornou uma resposta inválida. Tente novamente mais tarde.";

for (const scenario of integrations) {
  test(`/${scenario.name} preserva resposta válida sem retry`, async () => {
    const { result } = await execute(scenario, {
      status: 200,
      data: structuredClone(scenario.data),
    });
    assertPrivacy(result, false);
    assert.ok(result.payload.embeds || result.payload.content);
  });
  for (const status of [400, 401, 403, 404, 429, 500, 503]) {
    test(`/${scenario.name} classifica HTTP ${status} sem confundir indisponibilidade e ausência`, async (t) => {
      const logs = [];
      for (const method of ["log", "warn", "error"])
        t.mock.method(console, method, (...args) => logs.push(args));
      const { result, payload } = await execute(scenario, {
        status,
        data: { message: "SENSITIVE_API_BODY_SENTINEL" },
      });
      assertPrivacy(result, scenario.private);
      assert.doesNotMatch(
        JSON.stringify({ payload, logs }),
        /SENSITIVE_API_BODY_SENTINEL/,
      );
      if (status === 429) assert.equal(payload.content, limitMessage);
      if (status >= 500) assert.equal(payload.content, unavailableMessage);
      if (status === 400) assert.match(payload.content, /recusou os dados/);
      if (status === 401 || status === 403)
        assert.match(payload.content, /não permitiu/);
      if (status === 404 && scenario.name === "github")
        assert.equal(payload.content, "Repositório não encontrado.");
      if (status === 404 && scenario.name === "moeda")
        assert.equal(payload.content, "Código de moeda de origem inválido.");
      if (scenario.name === "github" && status !== 404)
        assert.notEqual(payload.content, "Repositório não encontrado.");
    });
  }
  for (const [code, expected] of [
    ["HTTP_RATE_LIMITED", limitMessage],
    [
      "HTTP_TIMEOUT",
      "O serviço demorou demais para responder. Tente novamente mais tarde.",
    ],
    ["HTTP_CANCELLED", "A consulta ao serviço foi cancelada. Tente novamente."],
    ["HTTP_REQUEST_FAILED", unavailableMessage],
    ["HTTP_INVALID_BODY", invalidMessage],
    [
      "HTTP_RESPONSE_TOO_LARGE",
      "A resposta do serviço excedeu o limite permitido. Tente novamente mais tarde.",
    ],
  ]) {
    test(`/${scenario.name} trata ${code} sem vazar requisição ou repetir`, async (t) => {
      const logs = [];
      for (const method of ["log", "warn", "error"])
        t.mock.method(console, method, (...args) => logs.push(args));
      const error = Object.assign(new HttpRequestError(code), {
        config: {
          url: "https://internal.example.com/SENSITIVE_API_SENTINEL",
          password: "SENSITIVE_API_SENTINEL",
        },
        body: "SENSITIVE_API_SENTINEL",
      });
      const { result, payload } = await execute(scenario, error, {
        throwError: true,
      });
      assertPrivacy(result, scenario.private);
      assert.equal(payload.content, expected);
      assert.deepEqual(logs, []);
      assert.doesNotMatch(
        JSON.stringify(payload),
        /SENSITIVE_API_SENTINEL|internal\.example/,
      );
    });
  }
  test(`/${scenario.name} não converte falha de envio em erro de API/retry`, async () => {
    await assert.rejects(
      execute(
        scenario,
        { status: 200, data: structuredClone(scenario.data) },
        { failAt: "editReply" },
      ),
    );
  });
}

for (const [name, invalidData] of [
  ["github", {}],
  ["github", { ...repo, owner: null }],
  ["github", { ...repo, stargazers_count: "3" }],
  ["repositorys", {}],
  ["repositorys", { items: null }],
  ["repositorys", { items: [{ ...repo, stargazers_count: -1 }] }],
  ["question", {}],
  ["question", { items: null }],
  ["question", { items: [{ title: "How?", link: null }] }],
  ["translate", []],
  ["translate", [[]]],
  ["translate", [[[42]]]],
  ["translate", { 0: [["translation"]] }],
  ["moeda", {}],
  ["moeda", { rates: {} }],
  ["moeda", { rates: [] }],
  ["moeda", { rates: { EUR: "0.9" } }],
  ["http", {}],
  ["http", { code: "200", description: "OK" }],
  ["http", { code: 200, description: null }],
]) {
  test(`/${name} recusa contrato incompleto ou tipo inesperado ${JSON.stringify(invalidData)}`, async () => {
    const scenario = integrations.find((item) => item.name === name);
    const { result, payload } = await execute(scenario, {
      status: 200,
      data: invalidData,
    });
    assertPrivacy(result, scenario.private);
    assert.equal(payload.embeds, undefined);
  });
}

for (const name of ["github", "repositorys"]) {
  test(`/${name} usa cabeçalhos GitHub explícitos`, async () => {
    const scenario = integrations.find((item) => item.name === name);
    const { requests } = await execute(scenario, {
      status: 200,
      data: scenario.data,
    });
    assert.deepEqual(requests[0].options.headers, {
      Accept: "application/vnd.github+json",
      "User-Agent": "CodeBucket",
      "X-GitHub-Api-Version": "2022-11-28",
    });
  });
}
test("/github aceita opcionais nulos sem alterar o contrato público", async () => {
  const { payload } = await execute(integrations[0], {
    status: 200,
    data: { ...repo, description: null, language: null },
  });
  const fields = payload.embeds[0].toJSON().fields;
  assert.equal(fields[1].value, "Sem descrição disponível.");
  assert.equal(fields[3].value, "Não especificada");
});
for (const incomplete_results of [true, false]) {
  test(`/repositorys informa resultado parcial=${incomplete_results}`, async () => {
    const { payload } = await execute(integrations[1], {
      status: 200,
      data: { items: [repo], incomplete_results },
    });
    assert.equal(
      payload.content.includes("resultados parciais"),
      incomplete_results,
    );
  });
}
test("/repositorys não apresenta busca parcial vazia como ausência definitiva", async () => {
  const { payload } = await execute(integrations[1], {
    status: 200,
    data: { items: [], incomplete_results: true },
  });
  assert.match(payload.content, /resultados parciais/);
});
test("/repositorys recusa indicador parcial com tipo inválido", async () => {
  const { payload } = await execute(integrations[1], {
    status: 200,
    data: { items: [repo], incomplete_results: "false" },
  });
  assert.equal(payload.content, invalidMessage);
});
for (const [name, data, expectedPrivate] of [
  ["repositorys", { items: [] }, false],
  ["question", { items: [] }, true],
]) {
  test(`/${name} preserva ausência de resultados`, async () => {
    const { result, payload } = await execute(
      integrations.find((item) => item.name === name),
      { status: 200, data },
    );
    assertPrivacy(result, expectedPrivate);
    assert.match(payload.content, /não foi possível encontrar/i);
  });
}
const question = integrations[2];
for (const status of [401, 403, 500, 503]) {
  test(`/question classifica HTTP ${status} mesmo com corpo HTML inválido`, async () => {
    const client = helper.createHttpClient({
      axiosGet: async (_url, options) => ({
        status,
        data: options.transformResponse[0](
          Buffer.from("<html>SENSITIVE_PROVIDER_MESSAGE</html>"),
          {},
          status,
        ),
      }),
    });
    const { payload } = await execute(question, undefined, {
      requestImpl: client.getJson,
    });
    if (status >= 500) assert.equal(payload.content, unavailableMessage);
    else assert.match(payload.content, /não permitiu/);
    assert.doesNotMatch(JSON.stringify(payload), /SENSITIVE_PROVIDER_MESSAGE/);
  });
}
test("/question respeita backoff sem esperar e preserva resultado válido", async () => {
  const { payload, pauses, requests } = await execute(question, {
    status: 200,
    data: { ...question.data, backoff: 12 },
  });
  assert.deepEqual(pauses, [12]);
  assert.equal(requests[0].options.validateStatus(400), true);
  assert.ok(payload.embeds);
});
for (const [data, pauses] of [
  [{ items: [], quota_remaining: 0 }, [60]],
  [{ error_id: 502 }, [60]],
  [{ ...question.data, quota_remaining: 0, backoff: 15 }, [15]],
  [
    { error_id: 502, backoff: 20, error_message: "SENSITIVE_PROVIDER_MESSAGE" },
    [20],
  ],
]) {
  test("/question trata quota/throttle como limite, sem reproduzir mensagem remota", async () => {
    const { payload, pauses: actualPauses } = await execute(question, {
      status: data.error_id ? 400 : 200,
      data,
    });
    assert.equal(payload.content, limitMessage);
    assert.deepEqual(actualPauses, pauses);
    assert.doesNotMatch(JSON.stringify(payload), /SENSITIVE_PROVIDER_MESSAGE/);
  });
}
test("/question trata error_id503 como indisponibilidade e não entrada inválida", async () => {
  const { payload } = await execute(question, {
    status: 400,
    data: { error_id: 503 },
  });
  assert.equal(payload.content, unavailableMessage);
});
for (const data of [
  { ...question.data, quota_remaining: -1 },
  { ...question.data, quota_remaining: "0" },
  { ...question.data, backoff: -1 },
  { ...question.data, backoff: 86401 },
  { ...question.data, backoff: null },
  { ...question.data, error_id: "502" },
]) {
  test("/question recusa metadados de quota/backoff com tipo ou valor inválido", async () => {
    const { payload, pauses } = await execute(question, { status: 200, data });
    assert.equal(payload.content, invalidMessage);
    assert.deepEqual(pauses, []);
  });
}
for (const rate of [null, 0]) {
  test(`/moeda distingue taxa inválida ${rate} de moeda de destino ausente`, async () => {
    const { payload } = await execute(integrations[4], {
      status: 200,
      data: { rates: { EUR: rate } },
    });
    assert.equal(payload.content, invalidMessage);
  });
}
test("/moeda distingue destino ausente de tabela inválida", async () => {
  const { payload } = await execute(integrations[4], {
    status: 200,
    data: { rates: { USD: 1 } },
  });
  assert.equal(payload.content, "Código de moeda de destino inválido.");
});
test("/moeda recusa base diferente da moeda solicitada", async () => {
  const { payload } = await execute(integrations[4], {
    status: 200,
    data: { base: "BRL", rates: { EUR: 0.9 } },
  });
  assert.equal(payload.content, invalidMessage);
});
for (const code of [400, 401, 403, 404, 429, 500, 503]) {
  test(`/http permite o código solicitado ${code}, incluindo erros HTTP legítimos`, async () => {
    const { payload, requests } = await execute(
      { ...integrations[5], options: { codigo: code } },
      { status: code, data: { code, description: "Resposta simulada 🌎" } },
    );
    assert.equal(payload.embeds[0].toJSON().title, `Código HTTP ${code}`);
    assert.equal(requests[0].options.validateStatus(code), true);
    assert.equal(requests[0].options.headers.Accept, "application/json");
  });
}
for (const response of [
  { status: 200, data: { code: 503, description: "Service unavailable" } },
  { status: 503, data: { code: 200, description: "OK" } },
]) {
  test("/http recusa resposta que não corresponde ao código solicitado", async () => {
    const { payload } = await execute(integrations[5], response);
    assert.equal(payload.embeds, undefined);
  });
}

test("validação de status recusa status ausente/inválido e aceita somente200", () => {
  assert.doesNotThrow(() => requireSuccessfulResponse({ status: 200 }));
  for (const status of [undefined, null, "200", 99, 600, NaN]) {
    assert.throws(() => requireSuccessfulResponse({ status }), {
      code: "HTTP_INVALID_BODY",
    });
  }
  assert.throws(() => requireSuccessfulResponse({ status: 204 }), {
    code: "HTTP_STATUS_ERROR",
  });
});
test("mapeador nunca utiliza detalhe bruto desconhecido como mensagem", () => {
  assert.equal(
    apiErrorMessage(
      {
        message: "SENSITIVE_PROVIDER_MESSAGE",
        body: "SENSITIVE_PROVIDER_MESSAGE",
      },
      "Falha segura.",
    ),
    "Falha segura.",
  );
  assert.equal(
    apiErrorMessage(
      new HttpRequestError("HTTP_RATE_LIMITED", 403),
      "Falha segura.",
    ),
    limitMessage,
  );
});
