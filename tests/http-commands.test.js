const assert = require("node:assert/strict");
const dns = require("node:dns");
const dnsPromises = require("node:dns/promises");
const http = require("node:http");
const https = require("node:https");
const net = require("node:net");
const { beforeEach, test } = require("node:test");
const tls = require("node:tls");

beforeEach((t) => {
  // These cases exercise ordering/visibility, not expiry (covered separately in
  // interactions.test.js). Module loading or parallel CI scheduling must not
  // age an otherwise immediate mocked acknowledgement beyond Discord's 3 s.
  const now = Date.now();
  t.mock.method(Date, "now", () => now);
  const blockNetwork = () => {
    throw new Error("Somente APIs e interações simuladas são permitidas.");
  };
  t.mock.method(dns, "lookup", blockNetwork);
  t.mock.method(dnsPromises, "lookup", blockNetwork);
  t.mock.method(net.Socket.prototype, "connect", blockNetwork);
  t.mock.method(tls, "connect", blockNetwork);
  t.mock.method(globalThis, "fetch", blockNetwork);
  for (const transport of [http, https]) {
    t.mock.method(transport, "request", blockNetwork);
    t.mock.method(transport, "get", blockNetwork);
  }
});

const repo = {
  owner: {
    login: "codebucket-test",
    avatar_url: "https://example.com/avatar.png",
  },
  html_url: "https://example.com/codebucket-test/repo",
  full_name: "codebucket-test/repo",
  description: "Repositório simulado",
  language: "JavaScript",
  stargazers_count: 3,
  forks_count: 1,
};

const scenarios = [
  {
    name: "github",
    options: { repositorio: "codebucket-test/repo" },
    response: { status: 200, data: repo },
    failurePrivate: false,
  },
  {
    name: "repositorys",
    options: { linguagem: "javascript" },
    response: { data: { items: [repo] } },
    failurePrivate: false,
  },
  {
    name: "question",
    options: { pergunta: "How to write a test?" },
    response: {
      data: {
        items: [
          {
            title: "How to write a test?",
            link: "https://example.com/question",
            is_answered: true,
          },
        ],
      },
    },
    failurePrivate: true,
  },
  {
    name: "translate",
    options: { idioma: "pt", texto: "Hello" },
    response: { data: [[["Olá"]]] },
    failurePrivate: true,
  },
  {
    name: "moeda",
    options: { valor: 10, origem: "USD", destino: "EUR" },
    response: { data: { rates: { EUR: 0.9 } } },
    failurePrivate: true,
  },
  {
    name: "http",
    options: { codigo: 200 },
    response: { data: { code: 200, description: "OK" } },
    failurePrivate: true,
  },
  {
    name: "status",
    options: { url: "example.com" },
    response: { origin: "https://example.com", status: 200 },
    failurePrivate: false,
  },
];

function isPrivate(payload) {
  return (
    typeof payload === "object" &&
    Boolean(payload.ephemeral || Number(payload.flags) & 64)
  );
}

function simulateInteraction(options, failAt) {
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
    events,
    async deferReply(payload = {}) {
      events.push({ method: "deferReply", payload });
      if (failAt === "deferReply") throw new Error("defer simulado recusado");
      assert.equal(this.deferred || this.replied, false);
      this.deferred = true;
      this.ephemeral = isPrivate(payload);
    },
    async reply(payload) {
      events.push({ method: "reply", payload, private: isPrivate(payload) });
      if (failAt === "reply") throw new Error("reply simulado recusado");
      assert.equal(this.deferred || this.replied, false);
      this.replied = true;
      this.ephemeral = isPrivate(payload);
      return { id: "reply-test" };
    },
    async editReply(payload) {
      assert.equal(this.deferred || this.replied, true);
      events.push({ method: "editReply", payload, private: this.ephemeral });
      if (failAt === "editReply") throw new Error("edit simulado recusado");
      this.replied = true;
      return { id: "reply-test" };
    },
    async followUp(payload) {
      assert.equal(this.deferred || this.replied, true);
      // Discord ignora flags no primeiro follow-up enquanto há loading pendente.
      const privacy =
        this.deferred && !this.replied ? this.ephemeral : isPrivate(payload);
      events.push({ method: "followUp", payload, private: privacy });
      if (failAt === "followUp") throw new Error("follow-up simulado recusado");
      this.replied = true;
      return { id: "follow-up-test" };
    },
    async deleteReply() {
      events.push({ method: "deleteReply" });
      if (failAt === "deleteReply") throw new Error("delete simulado recusado");
    },
  };
  return interaction;
}

function meaningfulResponses(interaction) {
  return interaction.events.filter(({ method, payload }) => {
    if (!["reply", "editReply", "followUp"].includes(method)) return false;
    return (
      typeof payload === "string" ||
      payload.embeds?.length ||
      (payload.content && payload.content !== "\u200b")
    );
  });
}

function assertResponse(interaction, expectedPrivate) {
  const responses = meaningfulResponses(interaction);
  assert.equal(
    responses.length,
    1,
    "deve haver um único resultado com conteúdo",
  );
  assert.equal(responses[0].private, expectedPrivate);
  if (responses[0].payload.embeds) {
    for (const embed of responses[0].payload.embeds) {
      assert.doesNotThrow(() => JSON.stringify(embed.toJSON()));
    }
  }
  if (expectedPrivate && interaction.deferred) {
    assert.deepEqual(
      interaction.events
        .filter(({ method }) => method !== "http")
        .map(({ method }) => method),
      ["deferReply", "editReply", "followUp", "deleteReply"],
    );
  }
  return responses[0].payload;
}

function assertSuccessfulResult(name, payload) {
  const embed = payload.embeds?.[0].toJSON();
  switch (name) {
    case "github":
      assert.equal(embed.title, "Repositório de codebucket-test");
      assert.equal(embed.fields[0].value, "codebucket-test/repo");
      break;
    case "repositorys":
      assert.match(
        payload.content ?? payload,
        /Aqui estão os top 5 repositórios/,
      );
      assert.match(payload.content ?? payload, /codebucket-test\/repo/);
      break;
    case "question":
      assert.equal(embed.title, "How to write a test?");
      assert.equal(embed.fields[0].value, "https://example.com/question");
      break;
    case "translate":
      assert.equal(payload.content ?? payload, "🗺️ | <@test-user>\nOlá");
      break;
    case "moeda":
      assert.equal(embed.title, "Conversão de Moeda");
      assert.equal(embed.fields[1].value, "9.00 EUR");
      break;
    case "http":
      assert.equal(embed.title, "Código HTTP 200");
      assert.equal(embed.description, "**OK**");
      break;
    case "status":
      assert.match(embed.description, /Online.*200/);
      break;
    default:
      assert.fail(`Comando inesperado: ${name}`);
  }
}

async function withCommand(
  name,
  request,
  run,
  { realStatusChecker = false } = {},
) {
  const commandPath = require.resolve(`../commands/${name}`);
  const httpPath = require.resolve("../lib/http-client");
  const helperExports = require(httpPath);
  const statusPath = require.resolve("../lib/status-http");
  const previous = new Map(
    [commandPath, httpPath, statusPath].map((filename) => [
      filename,
      require.cache[filename],
    ]),
  );
  const installMock = (filename, exports) => {
    require.cache[filename] = { id: filename, filename, loaded: true, exports };
  };
  const requestWithStatus = async (...args) => {
    const response = await request(...args);
    return response && typeof response === "object"
      ? { status: 200, ...response }
      : response;
  };
  installMock(httpPath, {
    ...helperExports,
    getJson: requestWithStatus,
    fetchJson: requestWithStatus,
    pauseStackExchange: () => {},
  });
  if (!realStatusChecker) installMock(statusPath, { checkStatus: request });
  delete require.cache[commandPath];
  try {
    await run(require(commandPath));
  } finally {
    for (const [filename, cached] of previous) {
      if (cached) require.cache[filename] = cached;
      else delete require.cache[filename];
    }
  }
}

for (const scenario of scenarios) {
  test(`/${scenario.name} reconhece antes da API lenta e edita a resposta pública`, async () => {
    const interaction = simulateInteraction(scenario.options);
    let release;
    const delayed = new Promise((resolve) => {
      release = resolve;
    });
    let requests = 0;
    await withCommand(
      scenario.name,
      async () => {
        requests += 1;
        assert.equal(interaction.deferred, true);
        interaction.events.push({ method: "http" });
        return delayed;
      },
      async (command) => {
        const execution = command.execute(interaction);
        await new Promise(setImmediate);
        assert.equal(requests, 1);
        assert.deepEqual(
          interaction.events.map(({ method }) => method),
          ["deferReply", "http"],
        );
        release(scenario.response);
        await execution;
      },
    );
    const payload = assertResponse(interaction, false);
    assertSuccessfulResult(scenario.name, payload);
    assert.equal(
      interaction.events.filter(({ method }) => method === "reply").length,
      0,
    );
  });

  test(`/${scenario.name} não inicia HTTP se o defer falhar`, async () => {
    const interaction = simulateInteraction(scenario.options, "deferReply");
    let requests = 0;
    await withCommand(
      scenario.name,
      async () => {
        requests += 1;
        return scenario.response;
      },
      async (command) => {
        await assert.rejects(command.execute(interaction));
      },
    );
    assert.equal(requests, 0);
    assert.deepEqual(
      interaction.events.map(({ method }) => method),
      ["deferReply"],
    );
  });

  test(`/${scenario.name} preserva a visibilidade no timeout sem log bruto`, async (t) => {
    const interaction = simulateInteraction(scenario.options);
    const logs = [];
    t.mock.method(console, "error", (...args) => logs.push(args));
    await withCommand(
      scenario.name,
      async () => {
        const error = new Error("URL-e-detalhe-interno-sentinela");
        error.code = "TIMEOUT";
        throw error;
      },
      async (command) => command.execute(interaction),
    );
    const payload = assertResponse(interaction, scenario.failurePrivate);
    assert.doesNotMatch(
      JSON.stringify(payload),
      /URL-e-detalhe-interno-sentinela|TIMEOUT/,
    );
    assert.deepEqual(logs, []);
  });

  test(`/${scenario.name} não transforma falha de editReply em nova resposta`, async () => {
    const interaction = simulateInteraction(scenario.options, "editReply");
    await withCommand(
      scenario.name,
      async () => scenario.response,
      async (command) => {
        await assert.rejects(command.execute(interaction));
      },
    );
    assert.deepEqual(
      interaction.events.map(({ method }) => method),
      ["deferReply", "editReply"],
    );
  });

  for (const status of [404, 503]) {
    test(`/${scenario.name} mantém comportamento e visibilidade para HTTP ${status}`, async () => {
      const interaction = simulateInteraction(scenario.options);
      await withCommand(
        scenario.name,
        async (_url, options) => {
          if (scenario.name === "github") return { status, data: {} };
          if (scenario.name === "http") {
            assert.equal(options.validateStatus(status), false);
            return {
              status,
              data: { code: status, description: "Resposta simulada" },
            };
          }
          if (scenario.name === "status")
            return { status, origin: "https://example.com" };
          const error = new Error("corpo-remoto-sentinela");
          error.response = { status, data: "corpo-remoto-sentinela" };
          throw error;
        },
        async (command) => command.execute(interaction),
      );
      const publicStatus = ["github", "status"].includes(scenario.name);
      const payload = assertResponse(
        interaction,
        publicStatus ? false : scenario.failurePrivate,
      );
      assert.doesNotMatch(JSON.stringify(payload), /corpo-remoto-sentinela/);
      if (scenario.name === "github")
        assert.equal(
          payload.content ?? payload,
          status === 404
            ? "Repositório não encontrado."
            : "O serviço está indisponível no momento. Tente novamente mais tarde.",
        );
      if (scenario.name === "moeda" && status === 404) {
        assert.equal(payload.content, "Código de moeda de origem inválido.");
      }
    });
  }
}

test("/question sem pergunta responde privadamente sem defer ou HTTP", async () => {
  const interaction = simulateInteraction({ pergunta: "" });
  await withCommand(
    "question",
    async () => assert.fail("HTTP inesperado"),
    async (command) => command.execute(interaction),
  );
  assertResponse(interaction, true);
  assert.deepEqual(
    interaction.events.map(({ method }) => method),
    ["reply"],
  );
});

test("/http 1xx responde publicamente sem defer ou HTTP", async () => {
  const interaction = simulateInteraction({ codigo: 150 });
  await withCommand(
    "http",
    async () => assert.fail("HTTP inesperado"),
    async (command) => command.execute(interaction),
  );
  const payload = assertResponse(interaction, false);
  assert.equal(payload.embeds[0].toJSON().title, "Código HTTP 150");
  assert.deepEqual(
    interaction.events.map(({ method }) => method),
    ["reply"],
  );
});

for (const scenario of scenarios.filter(({ name }) => name !== "status")) {
  test(`/${scenario.name} trata corpo inesperado preservando a visibilidade`, async () => {
    const interaction = simulateInteraction(scenario.options);
    await withCommand(
      scenario.name,
      async () => ({ status: 200, data: null }),
      async (command) => command.execute(interaction),
    );
    assertResponse(interaction, scenario.failurePrivate);
  });
}

for (const scenario of scenarios.filter(({ name }) =>
  ["repositorys", "question"].includes(name),
)) {
  test(`/${scenario.name} preserva a visibilidade quando não há resultados`, async () => {
    const interaction = simulateInteraction(scenario.options);
    await withCommand(
      scenario.name,
      async () => ({ data: { items: [] } }),
      async (command) => command.execute(interaction),
    );
    assertResponse(interaction, scenario.failurePrivate);
  });
}

test("/moeda mantém erro privado para destino sem taxa", async () => {
  const interaction = simulateInteraction({
    valor: 10,
    origem: "USD",
    destino: "ZZZ",
  });
  await withCommand(
    "moeda",
    async () => ({ data: { rates: { EUR: 0.9 } } }),
    async (command) => command.execute(interaction),
  );
  const payload = assertResponse(interaction, true);
  assert.equal(payload.content, "Código de moeda de destino inválido.");
});

for (const url of [
  "http://127.0.0.1",
  "http://169.254.169.254",
  "http://[::ffff:127.0.0.1]",
]) {
  test(`/status mantém a política SSRF real depois do defer: ${url}`, async () => {
    const interaction = simulateInteraction({ url });
    await withCommand(
      "status",
      async () => assert.fail("HTTP inesperado"),
      async (command) => command.execute(interaction),
      { realStatusChecker: true },
    );
    const payload = assertResponse(interaction, false);
    assert.equal(payload.embeds[0].toJSON().color, 0xff0000);
    assert.doesNotMatch(JSON.stringify(payload), /127\.0\.0\.1|169\.254|ffff/);
    assert.deepEqual(
      interaction.events.map(({ method }) => method),
      ["deferReply", "editReply"],
    );
  });
}
