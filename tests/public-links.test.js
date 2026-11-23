const assert = require("node:assert/strict");
const dns = require("node:dns");
const dnsPromises = require("node:dns/promises");
const fs = require("node:fs");
const http = require("node:http");
const https = require("node:https");
const net = require("node:net");
const path = require("node:path");
const { beforeEach, test } = require("node:test");
const tls = require("node:tls");
const { ButtonStyle, PermissionFlagsBits } = require("discord.js");
const {
  PUBLIC_LINKS,
  INVITE_PERMISSIONS,
  readClientId,
  buildInviteUrl,
  readLofiUrl,
  readConfig,
  ConfigurationError,
  configurationMessage,
} = require("../lib/config");
const { runWithErrorHandling } = require("../lib/interactions");

const APPLICATION_ID = "123456789012345678";
const OTHER_APPLICATION_ID = "987654321012345678";
const SENTINEL = "SENSITIVE_R12_SENTINEL";
const TOKEN = "x".repeat(32);

beforeEach((t) => {
  let forbiddenAttempts = 0;
  const block = () => {
    forbiddenAttempts += 1;
    throw new Error("Rede ou leitura de .env proibida na suíte R12.");
  };
  for (const transport of [http, https]) {
    t.mock.method(transport, "request", block);
    t.mock.method(transport, "get", block);
  }
  t.mock.method(dns, "lookup", block);
  t.mock.method(dnsPromises, "lookup", block);
  t.mock.method(net.Socket.prototype, "connect", block);
  t.mock.method(tls, "connect", block);
  t.mock.method(globalThis, "fetch", block);
  const readFileSync = fs.readFileSync;
  t.mock.method(fs, "readFileSync", function (filename, ...args) {
    if (path.basename(String(filename)) === ".env") block();
    return readFileSync.call(this, filename, ...args);
  });
  const saved = new Map();
  for (const key of ["CLIENT_ID", "INVITE_URL", "LOFIRADIO_URL"]) {
    saved.set(key, process.env[key]);
    delete process.env[key];
  }
  t.after(() => {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    assert.equal(
      forbiddenAttempts,
      0,
      "nenhuma tentativa de rede ou leitura de .env",
    );
  });
});

function rejectsConfiguration(operation) {
  assert.throws(operation, (error) => {
    assert.ok(error instanceof ConfigurationError);
    assert.equal(error.cause, undefined);
    assert.equal(configurationMessage(error), error.message);
    assert.doesNotMatch(
      `${error.message} ${error.stack} ${JSON.stringify(error)}`,
      /SENSITIVE_R12_SENTINEL|xxxxxxxxxxxxxxxx/,
    );
    return true;
  });
}

function configuredInvite(overrides = {}) {
  const query = new URLSearchParams({
    client_id: APPLICATION_ID,
    permissions: "117824",
    scope: "bot applications.commands",
    ...overrides,
  });
  return `https://discord.com/oauth2/authorize?${query}`;
}

function interactionFor({
  applicationId = APPLICATION_ID,
  fail,
  reactionFails = false,
} = {}) {
  const events = [];
  const message = {
    async react(emoji) {
      events.push({ method: "react", emoji });
      if (reactionFails) throw new Error(SENTINEL);
    },
  };
  const interaction = {
    applicationId,
    events,
    user: { id: "r12-test-user" },
    createdTimestamp: Date.now(),
    deferred: false,
    replied: false,
    ephemeral: false,
    isCommand: () => true,
    isRepliable: () => true,
    async deferReply(payload = {}) {
      events.push({ method: "deferReply", payload });
      if (fail === "deferReply") throw new Error(SENTINEL);
      this.deferred = true;
      this.ephemeral =
        Boolean(payload.flags & 64) || Boolean(payload.ephemeral);
    },
    async reply(payload) {
      events.push({ method: "reply", payload });
      if (fail === "reply") throw new Error(SENTINEL);
      this.replied = true;
      this.ephemeral =
        Boolean(payload.flags & 64) || Boolean(payload.ephemeral);
      return message;
    },
    async editReply(payload) {
      events.push({ method: "editReply", payload });
      if (fail === "editReply") throw new Error(SENTINEL);
      this.replied = true;
      return message;
    },
    async followUp(payload) {
      events.push({ method: "followUp", payload });
      if (fail === "followUp") throw new Error(SENTINEL);
      this.replied = true;
      return message;
    },
    async deleteReply() {
      events.push({ method: "deleteReply" });
    },
  };
  return interaction;
}

async function execute(name, interaction) {
  const command = require(`../commands/${name}`);
  await runWithErrorHandling(interaction, () => command.execute(interaction));
}

function captureLogs(t) {
  const logs = [];
  for (const method of ["log", "warn", "error"]) {
    t.mock.method(console, method, (...args) => logs.push(args));
  }
  return logs;
}

function linkButton(interaction) {
  const event = interaction.events.find((item) => item.payload?.components);
  assert.ok(event, "a resposta contém componentes");
  const button = event.payload.components[0].toJSON().components[0];
  assert.equal(button.style, ButtonStyle.Link);
  assert.equal(button.custom_id, undefined);
  return button;
}

test("R12: CLIENT_ID aceita os limites canônicos sem perda de precisão", () => {
  for (const value of [
    APPLICATION_ID,
    "12345678901234567",
    "18446744073709551615",
  ]) {
    assert.equal(readClientId(value), value);
  }
});

test("R12: CLIENT_ID ausente é opcional no runtime e exigível no registro", () => {
  for (const value of [undefined, null, ""]) {
    assert.equal(readClientId(value), undefined);
    rejectsConfiguration(() => readClientId(value, { required: true }));
  }
  assert.deepEqual(readConfig({ TOKEN }), { token: TOKEN });
  rejectsConfiguration(() => readConfig({ TOKEN }, { registration: true }));
});

for (const [label, value] of [
  ["curto", "1234567890123456"],
  ["longo", "123456789012345678901"],
  ["overflow", "18446744073709551616"],
  ["zero inicial", "012345678901234567"],
  ["sinal", `+${APPLICATION_ID}`],
  ["whitespace", `${APPLICATION_ID}\n`],
  ["número", 123456789012345678],
  ["objeto", {}],
  ["sentinela", SENTINEL],
]) {
  test(`R12: CLIENT_ID inválido (${label}) é rejeitado também no runtime`, () => {
    rejectsConfiguration(() => readClientId(value));
    rejectsConfiguration(() => readConfig({ TOKEN, CLIENT_ID: value }));
  });
}

test("R12: convite deriva da aplicação real sem fallback histórico", () => {
  const url = new URL(buildInviteUrl({}, APPLICATION_ID));
  assert.equal(url.origin, "https://discord.com");
  assert.equal(url.pathname, "/oauth2/authorize");
  assert.equal(url.searchParams.get("client_id"), APPLICATION_ID);
  assert.equal(url.searchParams.get("permissions"), "117824");
  assert.deepEqual(url.searchParams.get("scope").split(" ").sort(), [
    "applications.commands",
    "bot",
  ]);
  assert.equal(url.searchParams.size, 3);
  assert.doesNotMatch(url.href, /1193011045577523300/);
});

test("R12: identidade configurada funciona offline e é conferida contra a interação", () => {
  const env = { CLIENT_ID: APPLICATION_ID };
  assert.equal(buildInviteUrl(env), buildInviteUrl(env, APPLICATION_ID));
  rejectsConfiguration(() => buildInviteUrl(env, OTHER_APPLICATION_ID));
  rejectsConfiguration(() => buildInviteUrl(env, SENTINEL));
  rejectsConfiguration(() => buildInviteUrl({}, undefined));
  rejectsConfiguration(() =>
    buildInviteUrl({ INVITE_URL: configuredInvite() }),
  );
});

test("R12: bitfield inclui apenas os seis privilégios dos canais de texto", () => {
  const expected =
    PermissionFlagsBits.ViewChannel |
    PermissionFlagsBits.SendMessages |
    PermissionFlagsBits.EmbedLinks |
    PermissionFlagsBits.AttachFiles |
    PermissionFlagsBits.ReadMessageHistory |
    PermissionFlagsBits.AddReactions;
  assert.equal(String(INVITE_PERMISSIONS), "117824");
  assert.equal(BigInt(INVITE_PERMISSIONS), expected);
  for (const unneeded of [
    PermissionFlagsBits.Administrator,
    PermissionFlagsBits.ManageMessages,
    PermissionFlagsBits.ManageWebhooks,
    PermissionFlagsBits.Connect,
    PermissionFlagsBits.Speak,
    PermissionFlagsBits.SendMessagesInThreads,
  ]) {
    assert.equal(BigInt(INVITE_PERMISSIONS) & unneeded, 0n);
  }
});

test("R12: convite coerente aceita ordem de parâmetros/scopes e retorna URL canônica", () => {
  const expected = buildInviteUrl({}, APPLICATION_ID);
  for (const invite of [
    configuredInvite(),
    `https://discord.com/oauth2/authorize?scope=applications.commands%20bot&permissions=117824&client_id=${APPLICATION_ID}`,
    configuredInvite().replace("/oauth2/", "/api/oauth2/"),
  ]) {
    assert.equal(
      buildInviteUrl({ INVITE_URL: invite }, APPLICATION_ID),
      expected,
    );
    assert.equal(
      buildInviteUrl({ CLIENT_ID: APPLICATION_ID, INVITE_URL: invite }),
      expected,
    );
    assert.doesNotThrow(() =>
      readConfig({ TOKEN, CLIENT_ID: APPLICATION_ID, INVITE_URL: invite }),
    );
  }
});

for (const [label, invite] of [
  ["outra aplicação", configuredInvite({ client_id: OTHER_APPLICATION_ID })],
  ["ID inválido", configuredInvite({ client_id: SENTINEL })],
  ["permissões antigas", configuredInvite({ permissions: "0" })],
  ["Administrator", configuredInvite({ permissions: "117832" })],
  ["permissões com sinal", configuredInvite({ permissions: "+117824" })],
  [
    "scope adicional",
    configuredInvite({ scope: "bot applications.commands identify" }),
  ],
  ["scope ausente", configuredInvite({ scope: "bot" })],
  [
    "scope repetido",
    configuredInvite({ scope: "bot bot applications.commands" }),
  ],
  ["parâmetro ausente", configuredInvite().replace("permissions=117824&", "")],
  ["parâmetro duplicado", `${configuredInvite()}&client_id=${APPLICATION_ID}`],
  ["query sensível", `${configuredInvite()}&access_token=${SENTINEL}`],
  ["fragmento sensível", `${configuredInvite()}#${SENTINEL}`],
  [
    "host falso",
    configuredInvite().replace("discord.com", "discord.com.example.org"),
  ],
  [
    "userinfo",
    configuredInvite().replace("discord.com", `${SENTINEL}@discord.com`),
  ],
  ["HTTP", configuredInvite().replace("https:", "http:")],
  ["esquema perigoso", `javascript:${SENTINEL}`],
  ["rota diferente", configuredInvite().replace("/oauth2/authorize", "/login")],
  [
    "porta customizada",
    configuredInvite().replace("discord.com", "discord.com:8443"),
  ],
  ["controle", `${configuredInvite()}\n`],
  ["tipo diferente", {}],
]) {
  test(`R12: convite inválido (${label}) falha sanitizado`, () => {
    rejectsConfiguration(() =>
      buildInviteUrl({ INVITE_URL: invite }, APPLICATION_ID),
    );
    rejectsConfiguration(() =>
      readConfig({ TOKEN, CLIENT_ID: APPLICATION_ID, INVITE_URL: invite }),
    );
  });
}

test("R12: páginas externas preservam identidade histórica independente de CLIENT_ID", () => {
  assert.equal(PUBLIC_LINKS.vote, "https://top.gg/bot/1193011045577523300");
  assert.equal(PUBLIC_LINKS.lofi, "https://lofiradio.web.app");
  assert.equal(readLofiUrl({}), PUBLIC_LINKS.lofi);
  assert.equal(readLofiUrl({ LOFIRADIO_URL: "" }), PUBLIC_LINKS.lofi);
  assert.equal(
    readLofiUrl({ LOFIRADIO_URL: "https://radio.example.org/estudar" }),
    "https://radio.example.org/estudar",
  );
  assert.equal(
    readLofiUrl({ LOFIRADIO_URL: "https://radio.example.org/estudar%20agora" }),
    "https://radio.example.org/estudar%20agora",
  );
});

test("R12: URL Lofi normaliza HTTPS/host e codifica delimitadores Markdown sem trocar o destino", () => {
  assert.equal(
    readLofiUrl({ LOFIRADIO_URL: "HTTPS://RADIO.EXAMPLE.ORG/estudar" }),
    "https://radio.example.org/estudar",
  );
  for (const source of [
    "https://radio.example.org/(lofi)",
    "https://radio.example.org/)[clique](https://example.net",
  ]) {
    const normalized = readLofiUrl({ LOFIRADIO_URL: source });
    assert.doesNotMatch(normalized, /[()[\]]/);
    assert.equal(decodeURIComponent(normalized), source);
    assert.equal(new URL(normalized).hostname, "radio.example.org");
  }
});

test("R12: limite de URL Lofi considera a forma serializada consumida pelo Discord", () => {
  const base = "https://radio.example.org/";
  const maximum = base + "a".repeat(512 - base.length);
  assert.equal(readLofiUrl({ LOFIRADIO_URL: maximum }), maximum);
  for (const source of [base + "é".repeat(100), base + "(".repeat(200)]) {
    assert.ok(source.length <= 512);
    rejectsConfiguration(() => readLofiUrl({ LOFIRADIO_URL: source }));
    rejectsConfiguration(() => readConfig({ TOKEN, LOFIRADIO_URL: source }));
  }
});

for (const [label, url] of [
  ["HTTP", "http://radio.example.org"],
  ["JavaScript", `javascript:${SENTINEL}`],
  ["data", `data:text/html,${SENTINEL}`],
  ["relativa", "/estudar"],
  ["sem esquema", "radio.example.org"],
  ["malformada", "https://"],
  ["credenciais", `https://user:${SENTINEL}@radio.example.org`],
  ["userinfo vazio", "https://@radio.example.org/"],
  ["porta explícita padrão", "https://radio.example.org:443/"],
  ["query sensível", `https://radio.example.org/?token=${SENTINEL}`],
  ["query pública", "https://radio.example.org/?station=lofi"],
  ["fragmento", `https://radio.example.org/#${SENTINEL}`],
  ["query vazia", "https://radio.example.org/?"],
  ["fragmento vazio", "https://radio.example.org/#"],
  ["whitespace", " https://radio.example.org"],
  ["controle", "https://radio.example.org/\n"],
  ["backslash", "https://radio.example.org\\estudar"],
  ["percentual inválido", "https://radio.example.org/%ZZ"],
  ["localhost", "https://localhost/"],
  ["IP privado", "https://127.0.0.1/"],
  ["IP público", "https://8.8.8.8/"],
  ["comprimento excessivo", `https://radio.example.org/${"a".repeat(512)}`],
  ["tipo diferente", {}],
]) {
  test(`R12: URL Lofi inválida (${label}) é rejeitada antes do login`, () => {
    rejectsConfiguration(() => readLofiUrl({ LOFIRADIO_URL: url }));
    rejectsConfiguration(() => readConfig({ TOKEN, LOFIRADIO_URL: url }));
  });
}

test("R12: /invite constrói botão serializável para a aplicação da interação", async () => {
  const interaction = interactionFor();
  await execute("invite", interaction);
  assert.equal(
    new URL(linkButton(interaction).url).searchParams.get("client_id"),
    APPLICATION_ID,
  );
  assert.deepEqual(
    interaction.events.map((event) => event.method),
    ["reply", "react"],
  );
});

test("R12: /vote preserva botão top.gg ao executar em outra aplicação", async () => {
  process.env.CLIENT_ID = OTHER_APPLICATION_ID;
  const interaction = interactionFor({ applicationId: OTHER_APPLICATION_ID });
  await execute("vote", interaction);
  assert.equal(linkButton(interaction).url, PUBLIC_LINKS.vote);
  assert.deepEqual(
    interaction.events.map((event) => event.method),
    ["reply", "react"],
  );
});

test("R12: /lofiradio usa a mesma URL validada no botão, embed e texto", async () => {
  process.env.LOFIRADIO_URL = "https://radio.example.org/estudar";
  const interaction = interactionFor();
  await execute("lofiradio", interaction);
  assert.equal(linkButton(interaction).url, process.env.LOFIRADIO_URL);
  const event = interaction.events.find((item) => item.payload?.embeds);
  const embed = event.payload.embeds[0].toJSON();
  assert.equal(embed.url, process.env.LOFIRADIO_URL);
  assert.ok(embed.description.includes(process.env.LOFIRADIO_URL));
  assert.equal(event.payload.files.length, 2);
  assert.deepEqual(
    interaction.events.map((item) => item.method),
    ["deferReply", "editReply"],
  );
});

test("R12: /lofiradio não permite criar um segundo link pela interpolação Markdown", async () => {
  const source = "https://radio.example.org/)[clique](https://example.net";
  process.env.LOFIRADIO_URL = source;
  const interaction = interactionFor();
  await execute("lofiradio", interaction);
  const button = linkButton(interaction);
  const event = interaction.events.find((item) => item.payload?.embeds);
  const embed = event.payload.embeds[0].toJSON();
  assert.equal(embed.url, button.url);
  assert.equal(decodeURIComponent(button.url), source);
  assert.ok(embed.description.includes(`](${button.url})`));
  assert.equal((embed.description.match(/\]\(/g) || []).length, 1);
});

for (const [name, key, value] of [
  ["invite", "CLIENT_ID", OTHER_APPLICATION_ID],
  ["invite", "CLIENT_ID", SENTINEL],
  ["invite", "INVITE_URL", `${configuredInvite()}&token=${SENTINEL}`],
  [
    "invite",
    "INVITE_URL",
    configuredInvite({ client_id: OTHER_APPLICATION_ID }),
  ],
  ["lofiradio", "LOFIRADIO_URL", `https://user:${SENTINEL}@radio.example.org/`],
  [
    "lofiradio",
    "LOFIRADIO_URL",
    `https://radio.example.org/?token=${SENTINEL}`,
  ],
]) {
  test(`R12: /${name} recusa ${key} inseguro sem botão, defer, reação ou vazamento`, async (t) => {
    const logs = captureLogs(t);
    process.env[key] = value;
    const interaction = interactionFor();
    await execute(name, interaction);
    assert.deepEqual(
      interaction.events.map((event) => event.method),
      ["reply"],
    );
    const payload = interaction.events[0].payload;
    assert.ok(Boolean(payload.flags & 64) || Boolean(payload.ephemeral));
    assert.equal(payload.components, undefined);
    assert.equal(payload.files, undefined);
    assert.doesNotMatch(
      JSON.stringify([interaction.events, logs]),
      /SENSITIVE_R12_SENTINEL|xxxxxxxxxxxxxxxx/,
    );
  });
}

for (const name of ["invite", "vote"]) {
  test(`R12: /${name} captura falha de reação sem invalidar resposta`, async (t) => {
    const logs = captureLogs(t);
    const interaction = interactionFor({ reactionFails: true });
    await execute(name, interaction);
    assert.deepEqual(
      interaction.events.map((event) => event.method),
      ["reply", "react"],
    );
    assert.ok(linkButton(interaction).url);
    assert.doesNotMatch(
      JSON.stringify([interaction.events, logs]),
      /SENSITIVE_R12_SENTINEL/,
    );
  });
}

for (const [name, fail, expected] of [
  ["invite", "reply", ["reply"]],
  ["vote", "reply", ["reply"]],
  ["lofiradio", "deferReply", ["deferReply"]],
  ["lofiradio", "editReply", ["deferReply", "editReply"]],
]) {
  test(`R12: /${name} não repete ${fail} falho nem expõe erro bruto`, async (t) => {
    const logs = captureLogs(t);
    const interaction = interactionFor({ fail });
    await execute(name, interaction);
    assert.deepEqual(
      interaction.events.map((event) => event.method),
      expected,
    );
    assert.doesNotMatch(
      JSON.stringify([interaction.events, logs]),
      /SENSITIVE_R12_SENTINEL/,
    );
  });
}
