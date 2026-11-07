const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const https = require("node:https");
const net = require("node:net");
const test = require("node:test");
const tls = require("node:tls");
const prettier = require("prettier");
const qrcode = require("qrcode");
const { runWithErrorHandling } = require("../lib/interactions");

function guardNetwork(t) {
  const refuse = () => {
    throw new Error("Rede real proibida nos testes de interações");
  };
  for (const transport of [http, https]) {
    t.mock.method(transport, "request", refuse);
    t.mock.method(transport, "get", refuse);
  }
  t.mock.method(net.Socket.prototype, "connect", refuse);
  t.mock.method(tls, "connect", refuse);
  t.mock.method(globalThis, "fetch", refuse);
}

function captureLogs(t) {
  const logs = [];
  for (const method of ["warn", "error"]) {
    t.mock.method(console, method, (...args) => logs.push(args));
  }
  return logs;
}

function interactionFor({
  strings = {},
  integers = {},
  subcommand,
  fail,
  reactionFails = false,
} = {}) {
  const events = [];
  const message = {
    async react(emoji) {
      events.push({ method: "react", emoji });
      if (reactionFails) throw new Error("sentinela-erro-privado-reação");
    },
  };
  const interaction = {
    events,
    user: { id: "usuario-de-teste" },
    client: { guilds: { cache: { size: 2 } } },
    createdTimestamp: Date.now(),
    deferred: false,
    replied: false,
    ephemeral: false,
    isCommand: () => true,
    isRepliable: () => true,
    options: {
      getString: (name) => strings[name],
      getInteger: (name) => integers[name],
      getSubcommand: () => subcommand,
    },
    async deferReply(payload = {}) {
      assert.equal(this.deferred || this.replied, false);
      events.push({ method: "deferReply", payload });
      if (fail === "deferReply")
        throw new Error("sentinela-erro-privado-envio");
      this.deferred = true;
      this.ephemeral =
        Boolean(payload.flags & 64) || Boolean(payload.ephemeral);
    },
    async reply(payload) {
      assert.equal(this.deferred || this.replied, false);
      events.push({ method: "reply", payload });
      if (fail === "reply") throw new Error("sentinela-erro-privado-envio");
      this.replied = true;
      this.ephemeral =
        Boolean(payload.flags & 64) || Boolean(payload.ephemeral);
      return message;
    },
    async editReply(payload) {
      assert.equal(this.deferred || this.replied, true);
      events.push({ method: "editReply", payload });
      if (fail === "editReply") throw new Error("sentinela-erro-privado-envio");
      this.replied = true;
      return message;
    },
    async followUp(payload) {
      assert.equal(this.deferred || this.replied, true);
      events.push({ method: "followUp", payload });
      if (fail === "followUp") throw new Error("sentinela-erro-privado-envio");
      this.replied = true;
      return message;
    },
    async deleteReply() {
      events.push({ method: "deleteReply" });
    },
  };
  return interaction;
}

const methods = (interaction) =>
  interaction.events.map((event) => event.method);
const deliveryEvents = (interaction) =>
  interaction.events.filter((event) =>
    ["reply", "editReply", "followUp"].includes(event.method),
  );
const isPrivate = (payload) =>
  Boolean(payload?.flags & 64) || Boolean(payload?.ephemeral);

async function execute(name, interaction) {
  const command = require(`../commands/${name}`);
  await runWithErrorHandling(interaction, () => command.execute(interaction));
}

test("/count mantém resposta rápida pública sem defer", async (t) => {
  guardNetwork(t);
  const interaction = interactionFor({ strings: { texto: "Um teste 24" } });
  await execute("count", interaction);
  assert.deepEqual(methods(interaction), ["reply"]);
  const payload = deliveryEvents(interaction)[0].payload;
  assert.equal(isPrivate(payload), false);
  assert.match(payload.embeds[0].toJSON().description, /Palavras:\*\* 3/);
});

for (const name of ["autor", "invite", "vote", "playlist"]) {
  test(`/${name}: reação falha sem repetir resposta ou expor erro`, async (t) => {
    guardNetwork(t);
    const logs = captureLogs(t);
    const interaction = interactionFor({ reactionFails: true });
    await execute(name, interaction);
    assert.equal(
      methods(interaction).filter((method) => method === "reply").length,
      1,
    );
    assert.equal(methods(interaction).includes("editReply"), false);
    assert.equal(
      methods(interaction).filter((method) => method === "followUp").length,
      name === "playlist" ? 1 : 0,
    );
    assert.ok(methods(interaction).includes("react"));
    assert.ok(
      deliveryEvents(interaction).every((event) => !isPrivate(event.payload)),
    );
    assert.doesNotMatch(JSON.stringify(logs), /sentinela-erro-privado/);
  });
}

for (const name of ["count", "autor", "invite", "vote", "playlist", "ping"]) {
  test(`/${name}: falha no reply não provoca nova tentativa`, async (t) => {
    guardNetwork(t);
    const logs = captureLogs(t);
    const interaction = interactionFor({
      strings: { texto: "teste" },
      fail: "reply",
    });
    await execute(name, interaction);
    assert.deepEqual(methods(interaction), ["reply"]);
    assert.doesNotMatch(JSON.stringify(logs), /sentinela-erro-privado/);
  });
}

test("/playlist: falha no followUp não duplica mensagem", async (t) => {
  guardNetwork(t);
  captureLogs(t);
  const interaction = interactionFor({ fail: "followUp" });
  await execute("playlist", interaction);
  assert.deepEqual(methods(interaction), ["reply", "followUp"]);
});

test("/ping mantém resposta efêmera e edita a latência", async (t) => {
  guardNetwork(t);
  const interaction = interactionFor();
  await execute("ping", interaction);
  assert.deepEqual(methods(interaction), ["reply", "editReply"]);
  assert.equal(isPrivate(deliveryEvents(interaction)[0].payload), true);
  assert.equal(interaction.ephemeral, true);
  const edited = deliveryEvents(interaction)[1].payload;
  assert.match(
    typeof edited === "string" ? edited : edited.content,
    /Latência:/,
  );
});

test("/ping: falha ao editar não tenta reply ou followUp", async (t) => {
  guardNetwork(t);
  captureLogs(t);
  const interaction = interactionFor({ fail: "editReply" });
  await execute("ping", interaction);
  assert.deepEqual(methods(interaction), ["reply", "editReply"]);
});

test("/formatar reconhece antes do Prettier e mantém sucesso público", async (t) => {
  guardNetwork(t);
  const interaction = interactionFor({
    strings: { linguagem: "babel", codigo: "const a=1" },
  });
  const originalFormat = prettier.format;
  t.mock.method(prettier, "format", async (...args) => {
    assert.deepEqual(methods(interaction), ["deferReply"]);
    return originalFormat(...args);
  });
  await execute("formatar", interaction);
  assert.deepEqual(methods(interaction), ["deferReply", "editReply"]);
  assert.equal(interaction.ephemeral, false);
  assert.match(
    deliveryEvents(interaction)[0].payload.embeds[0].toJSON().fields[0].value,
    /const a = 1;/,
  );
});

test("/formatar: falha da operação mantém mensagem de erro privada", async (t) => {
  guardNetwork(t);
  captureLogs(t);
  t.mock.method(prettier, "format", async () => {
    throw new Error("sentinela-erro-privado-prettier");
  });
  const interaction = interactionFor({
    strings: { linguagem: "babel", codigo: "entrada" },
  });
  await execute("formatar", interaction);
  assert.equal(methods(interaction)[0], "deferReply");
  assert.equal(methods(interaction).includes("reply"), false);
  const errorEvent = deliveryEvents(interaction).find((event) =>
    /Verifique se a sintaxe/.test(event.payload.content || ""),
  );
  assert.ok(errorEvent);
  assert.equal(isPrivate(errorEvent.payload), true);
  assert.doesNotMatch(
    JSON.stringify(interaction.events),
    /sentinela-erro-privado/,
  );
});

test("/formatar: falha do editReply não é confundida com erro de sintaxe", async (t) => {
  guardNetwork(t);
  captureLogs(t);
  const interaction = interactionFor({
    strings: { linguagem: "babel", codigo: "const a=1" },
    fail: "editReply",
  });
  await execute("formatar", interaction);
  assert.deepEqual(methods(interaction), ["deferReply", "editReply"]);
});

test("/qrcode reconhece antes de gerar e captura falha no cleanup após sucesso", async (t) => {
  guardNetwork(t);
  captureLogs(t);
  const interaction = interactionFor({
    strings: { link: "https://example.com" },
  });
  const generated = [];
  t.mock.method(qrcode, "toFile", async (file, link) => {
    assert.deepEqual(methods(interaction), ["deferReply"]);
    generated.push({ file, link });
  });
  t.mock.method(fs, "unlinkSync", (file) => {
    assert.equal(file, generated[0].file);
    assert.deepEqual(methods(interaction), ["deferReply", "editReply"]);
    throw new Error("sentinela-erro-privado-cleanup");
  });
  await execute("qrcode", interaction);
  assert.equal(generated.length, 1);
  assert.equal(generated[0].link, "https://example.com");
  assert.deepEqual(methods(interaction), ["deferReply", "editReply"]);
  assert.equal(interaction.ephemeral, false);
});

test("/qrcode: erro de geração interrompe envio do anexo ausente", async (t) => {
  guardNetwork(t);
  captureLogs(t);
  t.mock.method(qrcode, "toFile", async () => {
    throw new Error("sentinela-erro-privado-qrcode");
  });
  let removed = 0;
  t.mock.method(fs, "unlinkSync", () => {
    removed += 1;
  });
  const interaction = interactionFor({
    strings: { link: "https://example.com" },
  });
  await execute("qrcode", interaction);
  assert.equal(methods(interaction)[0], "deferReply");
  assert.ok(deliveryEvents(interaction).every((event) => !event.payload.files));
  assert.equal(removed, 0);
});

test("/lofiradio reconhece antes do envio de anexos e permanece público", async (t) => {
  guardNetwork(t);
  const interaction = interactionFor();
  await execute("lofiradio", interaction);
  assert.deepEqual(methods(interaction), ["deferReply", "editReply"]);
  assert.equal(deliveryEvents(interaction)[0].payload.files.length, 2);
  assert.equal(interaction.ephemeral, false);
});

test("/lofiradio: falha do envio não dispara nova mensagem de erro", async (t) => {
  guardNetwork(t);
  captureLogs(t);
  const interaction = interactionFor({ fail: "editReply" });
  await execute("lofiradio", interaction);
  assert.deepEqual(methods(interaction), ["deferReply", "editReply"]);
});

test("/lofiradio valida o conteúdo antes do defer e mantém erro privado", async (t) => {
  guardNetwork(t);
  captureLogs(t);
  const { EmbedBuilder } = require("discord.js");
  t.mock.method(EmbedBuilder.prototype, "setURL", () => {
    throw new Error("sentinela-erro-privado-builder");
  });
  const interaction = interactionFor();
  await execute("lofiradio", interaction);
  assert.deepEqual(methods(interaction), ["reply"]);
  assert.equal(isPrivate(deliveryEvents(interaction)[0].payload), true);
  assert.doesNotMatch(
    JSON.stringify(interaction.events),
    /sentinela-erro-privado/,
  );
});

for (const name of ["formatar", "qrcode", "lofiradio"]) {
  test(`/${name}: falha do defer interrompe trabalho e não tenta resposta`, async (t) => {
    guardNetwork(t);
    captureLogs(t);
    let operations = 0;
    t.mock.method(prettier, "format", async () => {
      operations += 1;
    });
    t.mock.method(qrcode, "toFile", async () => {
      operations += 1;
    });
    const interaction = interactionFor({
      fail: "deferReply",
      strings: {
        linguagem: "babel",
        codigo: "const a=1",
        link: "https://example.com",
      },
    });
    await execute(name, interaction);
    assert.deepEqual(methods(interaction), ["deferReply"]);
    assert.equal(operations, 0);
  });
}

test("/qrcode: falha do envio não repete resposta nem executa cleanup de sucesso", async (t) => {
  guardNetwork(t);
  captureLogs(t);
  t.mock.method(qrcode, "toFile", async () => {});
  let removed = 0;
  t.mock.method(fs, "unlinkSync", () => {
    removed += 1;
  });
  const interaction = interactionFor({
    fail: "editReply",
    strings: { link: "https://example.com" },
  });
  await execute("qrcode", interaction);
  assert.deepEqual(methods(interaction), ["deferReply", "editReply"]);
  assert.equal(removed, 0);
});

test("/timer captura rejeição tardia do canal sem reusar a interação", async (t) => {
  guardNetwork(t);
  const logs = captureLogs(t);
  let scheduled;
  let delay;
  t.mock.method(globalThis, "setTimeout", (callback, milliseconds) => {
    scheduled = callback;
    delay = milliseconds;
    return { id: "timer-simulado" };
  });
  t.mock.method(globalThis, "clearTimeout", () => {});
  const interaction = interactionFor({
    subcommand: "set",
    integers: { tempo: 1 },
  });
  let sends = 0;
  interaction.channel = {
    async send() {
      sends += 1;
      throw new Error("sentinela-erro-privado-canal");
    },
  };
  await execute("timer", interaction);
  assert.equal(delay, 60000);
  assert.deepEqual(methods(interaction), ["reply"]);
  await assert.doesNotReject(scheduled());
  assert.equal(sends, 1);
  assert.deepEqual(methods(interaction), ["reply"]);
  assert.doesNotMatch(JSON.stringify(logs), /sentinela-erro-privado/);
});
