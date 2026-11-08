const assert = require("node:assert/strict");
const dns = require("node:dns");
const dnsPromises = require("node:dns/promises");
const http = require("node:http");
const https = require("node:https");
const net = require("node:net");
const tls = require("node:tls");
const { beforeEach, test } = require("node:test");
const { Collection } = require("discord.js");
const {
  embedFits,
  DISCORD_LIMITS,
  MAX_TEXT_ATTACHMENT_BYTES,
} = require("../lib/content-limits");

beforeEach((t) => {
  const refuse = () => {
    throw new Error("Rede real proibida nos testes de conteúdo.");
  };
  t.mock.method(dns, "lookup", refuse);
  t.mock.method(dnsPromises, "lookup", refuse);
  t.mock.method(net.Socket.prototype, "connect", refuse);
  t.mock.method(tls, "connect", refuse);
  t.mock.method(globalThis, "fetch", refuse);
  for (const transport of [http, https]) {
    t.mock.method(transport, "request", refuse);
    t.mock.method(transport, "get", refuse);
  }
});

function interactionFor(options, { failAt, commands } = {}) {
  const events = [];
  return {
    events,
    user: { id: "test-user" },
    client: { commands: commands || new Collection() },
    createdTimestamp: Date.now(),
    deferred: false,
    replied: false,
    ephemeral: false,
    options: {
      getString: (name) => options[name],
      getInteger: (name) => options[name],
      getNumber: (name) => options[name],
    },
    async deferReply(payload) {
      events.push({ method: "deferReply", payload });
      if (failAt === "deferReply") throw new Error("Falha simulada.");
      this.deferred = true;
    },
    async reply(payload) {
      events.push({ method: "reply", payload });
      if (failAt === "reply") throw new Error("Falha simulada.");
      this.replied = true;
      this.ephemeral = Boolean(payload?.flags & 64);
    },
    async editReply(payload) {
      events.push({ method: "editReply", payload });
      if (failAt === "editReply") throw new Error("Falha simulada.");
      this.replied = true;
    },
    async followUp(payload) {
      events.push({ method: "followUp", payload });
      if (failAt === "followUp") throw new Error("Falha simulada.");
    },
    async deleteReply() {
      events.push({ method: "deleteReply" });
    },
  };
}

async function execute(name, options, response, interactionOptions) {
  const requests = [];
  const interaction = interactionFor(options, interactionOptions);
  const helperPath = require.resolve("../lib/http-client");
  const commandPath = require.resolve(`../commands/${name}`);
  const previousHelper = require.cache[helperPath];
  const previousCommand = require.cache[commandPath];
  const request = async (url) => {
    assert.equal(interaction.deferred, true, "HTTP deve ocorrer após defer.");
    requests.push(url);
    if (response instanceof Error) throw response;
    return response;
  };
  require.cache[helperPath] = {
    id: helperPath,
    filename: helperPath,
    loaded: true,
    exports: { getJson: request, fetchJson: request },
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
  return { interaction, requests, payload: resultPayload(interaction) };
}

function resultPayload(interaction) {
  const meaningful = interaction.events.filter(
    ({ method, payload }) =>
      ["reply", "editReply", "followUp"].includes(method) &&
      (typeof payload === "string" ||
        payload?.embeds ||
        payload?.files ||
        (payload?.content && payload.content !== "\u200b")),
  );
  assert.equal(
    meaningful.length,
    1,
    "Resultado deve ser enviado uma única vez.",
  );
  const payload = meaningful[0].payload;
  const content = typeof payload === "string" ? payload : payload.content;
  if (content) assert.ok(content.length <= DISCORD_LIMITS.content);
  for (const embed of payload.embeds || [])
    assert.ok(embedFits(embed.toJSON()));
  return payload;
}

function attachmentText(payload) {
  assert.equal(payload.files.length, 1);
  assert.ok(Buffer.isBuffer(payload.files[0].attachment));
  return payload.files[0].attachment.toString("utf8");
}

const repository = {
  owner: { login: "user", avatar_url: "https://example.com/avatar.png" },
  full_name: "user/repo",
  html_url: "https://example.com/user/repo",
  description: "Descrição",
  language: "JavaScript",
  stargazers_count: 3,
  forks_count: 1,
};
const cases = [
  {
    name: "translate",
    options: { idioma: "pt-BR", texto: "Hello" },
    response: { data: [[["Olá"]]] },
  },
  {
    name: "repositorys",
    options: { linguagem: "JavaScript" },
    response: { data: { items: [repository] } },
  },
  {
    name: "github",
    options: { repositorio: "user/repo" },
    response: { status: 200, data: repository },
  },
  {
    name: "question",
    options: { pergunta: "How?" },
    response: {
      data: {
        items: [{ title: "How?", link: "https://example.com/question" }],
      },
    },
  },
  {
    name: "http",
    options: { codigo: 200 },
    response: { data: { code: 200, description: "OK" } },
  },
  {
    name: "moeda",
    options: { valor: 10, origem: "usd", destino: "eur" },
    response: { data: { rates: { EUR: 0.9 } } },
  },
];

for (const scenario of cases) {
  test(`/${scenario.name} mantém resultado normal válido e limitado`, async () => {
    const { payload, requests } = await execute(
      scenario.name,
      scenario.options,
      scenario.response,
    );
    assert.equal(requests.length, 1);
    assert.equal(payload.files, undefined);
  });
  test(`/${scenario.name} trata corpo inesperado após defer sem expor erro bruto`, async () => {
    const { interaction, payload } = await execute(
      scenario.name,
      scenario.options,
      { status: 200, data: null },
    );
    assert.equal(interaction.events[0].method, "deferReply");
    assert.equal(payload.files, undefined);
    assert.equal(payload.embeds, undefined);
  });
  test(`/${scenario.name} não repete envio recusado após defer`, async () => {
    await assert.rejects(
      execute(scenario.name, scenario.options, scenario.response, {
        failAt: "editReply",
      }),
    );
  });
}

const textInputs = [
  ["translate", { idioma: "pt", texto: "ok" }, "texto"],
  ["translate", { idioma: "pt", texto: "ok" }, "idioma"],
  ["repositorys", { linguagem: "JS" }, "linguagem"],
  ["github", { repositorio: "user/repo" }, "repositorio"],
  ["question", { pergunta: "How?" }, "pergunta"],
  ["count", { texto: "ok" }, "texto"],
  ["exercise", { linguagem: "js" }, "linguagem"],
];
for (const [name, options, key] of textInputs) {
  for (const invalid of [
    undefined,
    null,
    "",
    " \n\t",
    "x".repeat(6001),
    "\ud800",
    123,
  ]) {
    test(`/${name} recusa ${key} inválido (${String(invalid).slice(0, 12)}) antes de HTTP`, async () => {
      const { interaction, payload, requests } = await execute(
        name,
        { ...options, [key]: invalid },
        null,
      );
      assert.equal(requests.length, 0);
      assert.deepEqual(
        interaction.events.map(({ method }) => method),
        ["reply"],
      );
      assert.ok(payload.flags & 64);
    });
  }
}

test("/translate preserva todos os segmentos e Unicode", async () => {
  const { payload, requests } = await execute(
    "translate",
    { idioma: "pt-BR", texto: "Hello 😀 & ?" },
    { data: [[["Olá "], ["😀"], ["!\nSegundo trecho"]]] },
  );
  assert.equal(
    payload.content ?? payload,
    "🗺️ | <@test-user>\nOlá 😀!\nSegundo trecho",
  );
  assert.ok(requests[0].includes("q=Hello%20%F0%9F%98%80%20%26%20%3F"));
});

for (const invalid of ["pt&tl=en", "pt/BR", "p", "123", "pt_BR"]) {
  test(`/translate recusa idioma sintaticamente inválido ${invalid}`, async () => {
    const { requests } = await execute(
      "translate",
      { idioma: invalid, texto: "hello" },
      null,
    );
    assert.equal(requests.length, 0);
  });
}

for (const segments of [
  [],
  [null],
  [[42]],
  [[{}]],
  [["\ud800"]],
  [[""]],
  [[" "], ["\n"]],
]) {
  test(`/translate recusa segmentos inválidos ${JSON.stringify(segments)}`, async () => {
    const { payload } = await execute(
      "translate",
      { idioma: "pt", texto: "hello" },
      { data: [segments] },
    );
    assert.match(payload.content, /erro ao traduzir/);
    assert.ok(payload.flags & 64);
  });
}

for (const excess of [0, 1]) {
  test(`/translate usa mensagem/anexo na fronteira 2000 + ${excess}`, async () => {
    const prefix = "🗺️ | <@test-user>\n";
    const translation =
      "😀".repeat(Math.floor((2000 - prefix.length) / 2)) +
      "a".repeat(((2000 - prefix.length) % 2) + excess);
    const { payload } = await execute(
      "translate",
      { idioma: "pt", texto: "x".repeat(6000) },
      { data: [[[translation]]] },
    );
    const expected = prefix + translation;
    assert.equal(expected.length, 2000 + excess);
    assert.equal(
      excess ? attachmentText(payload) : (payload.content ?? payload),
      expected,
    );
  });
}

test("/repositorys codifica linguagem e limita a seleção aos cinco primeiros itens", async () => {
  const { requests, payload } = await execute(
    "repositorys",
    { linguagem: "C++&sort=bad" },
    {
      data: {
        items: Array.from({ length: 100 }, (_, index) => ({
          ...repository,
          full_name: `user/repo-${index}`,
        })),
      },
    },
  );
  assert.match(requests[0], /language:C%2B%2B%26sort%3Dbad&sort=stars/);
  assert.match(payload.content ?? payload, /repo-4/);
  assert.doesNotMatch(payload.content ?? payload, /repo-5/);
});

for (const extra of [0, 1]) {
  test(`/repositorys preserva saída na fronteira 2000 + ${extra}`, async () => {
    const prefix = "Aqui estão os top 5 repositórios de JS no GitHub:\n• [";
    const suffix = `](${repository.html_url}) - 3 estrelas`;
    const full_name = "a".repeat(2000 + extra - prefix.length - suffix.length);
    const { payload } = await execute(
      "repositorys",
      { linguagem: "JS" },
      { data: { items: [{ ...repository, full_name }] } },
    );
    const expected = prefix + full_name + suffix;
    assert.equal(
      extra ? attachmentText(payload) : (payload.content ?? payload),
      expected,
    );
  });
}

test("/repositorys aceita string no limite 6000 e anexa ausência de resultados sem perder linguagem", async () => {
  const linguagem = "x".repeat(6000);
  const { payload } = await execute(
    "repositorys",
    { linguagem },
    { data: { items: [] } },
  );
  assert.ok(attachmentText(payload).includes(linguagem));
});

for (const items of [
  { length: 2 },
  [null],
  [{ ...repository, full_name: {} }],
  [{ ...repository, html_url: "javascript:alert(1)" }],
  [{ ...repository, stargazers_count: "3" }],
]) {
  test("/repositorys recusa estrutura ou item inesperado", async () => {
    const { payload } = await execute(
      "repositorys",
      { linguagem: "JS" },
      { data: { items } },
    );
    assert.match(payload.content ?? payload, /erro ao buscar/);
  });
}

for (const length of [1024, 1025]) {
  test(`/github campo de descrição ${length} usa embed/anexo completo`, async () => {
    const description = "á".repeat(length);
    const { payload } = await execute(
      "github",
      { repositorio: "user/repo" },
      { status: 200, data: { ...repository, description } },
    );
    if (length === 1024)
      assert.equal(payload.embeds[0].toJSON().fields[1].value, description);
    else assert.ok(attachmentText(payload).includes(description));
  });
}

test("/github usa fallback para dados opcionais nulos", async () => {
  const { payload } = await execute(
    "github",
    { repositorio: "user/repo" },
    { status: 200, data: { ...repository, description: null, language: null } },
  );
  assert.equal(
    payload.embeds[0].toJSON().fields[1].value,
    "Sem descrição disponível.",
  );
  assert.equal(payload.embeds[0].toJSON().fields[3].value, "Não especificada");
});

for (const value of [
  "user/repo?secret=1",
  "user/repo/extra",
  "user",
  "user/repo#frag",
  "user/repo&x=y",
  "user/.",
  "user/..",
]) {
  test(`/github recusa formato inválido ${value}`, async () => {
    const { requests } = await execute("github", { repositorio: value }, null);
    assert.equal(requests.length, 0);
  });
}

test("/github aceita entrada no limite 6000 sem alterar a URL de destino", async () => {
  const repositorio = "u/" + "r".repeat(5998);
  const { requests } = await execute(
    "github",
    { repositorio },
    { status: 200, data: repository },
  );
  assert.equal(requests[0], `https://api.github.com/repos/${repositorio}`);
});

for (const linkLength of [1024, 1025]) {
  test(`/question link de ${linkLength} caracteres preservado em embed/anexo`, async () => {
    const link =
      "https://example.com/" +
      "q".repeat(linkLength - "https://example.com/".length);
    const { payload } = await execute(
      "question",
      { pergunta: "How?" },
      { data: { items: [{ title: "How?", link }] } },
    );
    if (linkLength === 1024)
      assert.equal(payload.embeds[0].toJSON().fields[0].value, link);
    else assert.ok(attachmentText(payload).includes(link));
  });
}

for (const scenario of cases.filter(({ name }) => name !== "moeda")) {
  test(`/${scenario.name} recusa saída maior que orçamento sem enviar conteúdo parcial`, async () => {
    const huge = "x".repeat(MAX_TEXT_ATTACHMENT_BYTES + 1);
    const responses = {
      translate: { data: [[[huge]]] },
      repositorys: { data: { items: [{ ...repository, full_name: huge }] } },
      github: { status: 200, data: { ...repository, description: huge } },
      question: {
        data: { items: [{ title: huge, link: "https://example.com/q" }] },
      },
      http: { data: { code: 200, description: huge } },
    };
    const { payload } = await execute(
      scenario.name,
      scenario.options,
      responses[scenario.name],
    );
    assert.equal(payload.files, undefined);
    assert.equal(payload.embeds, undefined);
    assert.doesNotMatch(payload.content ?? payload, /x{100}/);
  });
}

for (const titleLength of [256, 257]) {
  test(`/question título ${titleLength} preservado em embed/anexo`, async () => {
    const title = "t".repeat(titleLength);
    const { payload } = await execute(
      "question",
      { pergunta: "x".repeat(6000) },
      { data: { items: [{ title, link: "https://example.com/q" }] } },
    );
    if (titleLength === 256)
      assert.equal(payload.embeds[0].toJSON().title, title);
    else assert.ok(attachmentText(payload).includes(title));
  });
}

for (const descriptionLength of [4092, 4093]) {
  test(`/http contabiliza Markdown em descrição de ${descriptionLength}`, async () => {
    const description = "á".repeat(descriptionLength);
    const { payload } = await execute(
      "http",
      { codigo: 200 },
      { data: { code: 200, description } },
    );
    if (descriptionLength === 4092)
      assert.equal(payload.embeds[0].toJSON().description.length, 4096);
    else assert.ok(attachmentText(payload).includes(description));
  });
}

for (const codigo of [undefined, 99, 600, 200.5, "200", NaN, Infinity]) {
  test(`/http recusa código inválido ${codigo} antes de HTTP`, async () => {
    const { requests, payload } = await execute("http", { codigo }, null);
    assert.equal(requests.length, 0);
    assert.ok(payload.flags & 64);
  });
}

for (const data of [
  { code: "200", description: "OK" },
  { code: 600, description: "Invalid" },
  { code: 200, description: {} },
  { code: 200, description: "" },
]) {
  test("/http trata schema remoto inesperado", async () => {
    const { payload } = await execute("http", { codigo: 200 }, { data });
    assert.equal(payload.embeds, undefined);
    assert.ok(payload.flags & 64);
  });
}

for (const options of [
  { valor: Infinity, origem: "USD", destino: "EUR" },
  { valor: 10, origem: "USD?x=1", destino: "EUR" },
  { valor: 10, origem: "USD", destino: "€" },
  { valor: 10, origem: null, destino: "EUR" },
]) {
  test("/moeda recusa entradas inválidas antes de HTTP", async () => {
    const { requests, payload } = await execute("moeda", options, null);
    assert.equal(requests.length, 0);
    assert.ok(payload.flags & 64);
  });
}

for (const rate of ["0.9", Infinity, NaN, -1, {}, Number.MAX_VALUE]) {
  test(`/moeda recusa taxa inválida ou produto infinito ${rate}`, async () => {
    const { payload } = await execute(
      "moeda",
      { valor: 10, origem: "USD", destino: "EUR" },
      { data: { rates: { EUR: rate } } },
    );
    assert.equal(payload.embeds, undefined);
    assert.ok(payload.flags & 64);
  });
}

test("/count preserva semântica UTF-16/ASCII de Unicode e aceita limite 6000", async () => {
  const text = "á😀a1_";
  const { payload } = await execute("count", { texto: text });
  assert.match(
    payload.embeds[0].toJSON().description,
    /Caracteres \(incluindo espaços\):\*\* 6/,
  );
  assert.match(payload.embeds[0].toJSON().description, /Letras:\*\* 1/);
  const full = await execute("count", { texto: "😀".repeat(3000) });
  assert.match(full.payload.embeds[0].toJSON().description, /6000/);
});

test("/exercise mantém exercício normal e preserva linguagem extensa em anexo", async () => {
  const normal = await execute("exercise", { linguagem: "js" });
  assert.equal(normal.payload.embeds[0].toJSON().title, "Exercício de JS");
  const language = "á".repeat(6000);
  const large = await execute("exercise", { linguagem: language });
  assert.ok(attachmentText(large.payload).includes(language.toUpperCase()));
});

for (const size of [25, 26]) {
  test(`/help respeita fronteira de ${size} campos sem perder comandos`, async () => {
    const commands = new Collection(
      Array.from({ length: size }, (_, index) => [
        `cmd${index}`,
        { data: { name: `cmd${index}`, description: "Comando" } },
      ]),
    );
    const { payload } = await execute("help", {}, null, { commands });
    if (size === 25)
      assert.equal(payload.embeds[0].toJSON().fields.length, size);
    else assert.ok(attachmentText(payload).includes("/cmd25"));
  });
}

test("/help aplica limite agregado de 6000 apesar de campos individuais válidos", async () => {
  const commands = new Collection(
    Array.from({ length: 25 }, (_, index) => [
      `cmd${index}`,
      { data: { name: `cmd${index}`, description: "x".repeat(250) } },
    ]),
  );
  const { payload } = await execute("help", {}, null, { commands });
  assert.ok(attachmentText(payload).includes("/cmd24"));
});
