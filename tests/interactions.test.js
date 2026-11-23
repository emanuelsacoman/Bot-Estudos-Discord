const assert = require("node:assert/strict");
const dns = require("node:dns");
const dnsPromises = require("node:dns/promises");
const net = require("node:net");
const tls = require("node:tls");
const { beforeEach, test } = require("node:test");
const {
  deferResponse,
  respond,
  editResponse,
  handleInteractionError,
  runWithErrorHandling,
  runSecondary,
  InteractionResponseError,
} = require("../lib/interactions");

const ERROR_MESSAGE = "Houve um erro ao executar esse comando!";

beforeEach((t) => {
  const blockNetwork = () => {
    throw new Error("A suíte permite somente interações controladas.");
  };
  t.mock.method(dns, "lookup", blockNetwork);
  t.mock.method(dnsPromises, "lookup", blockNetwork);
  t.mock.method(net.Socket.prototype, "connect", blockNetwork);
  t.mock.method(tls, "connect", blockNetwork);
  t.mock.method(globalThis, "fetch", blockNetwork);
  t.mock.method(console, "error", () => {});
  t.mock.method(console, "warn", () => {});
});

function deferredPromise() {
  let resolve;
  let reject;
  const promise = new Promise((accept, decline) => {
    resolve = accept;
    reject = decline;
  });
  return { promise, resolve, reject };
}

function fixture({
  deferred = false,
  replied = false,
  ephemeral = false,
  ageMs = 0,
  fail,
  pending,
} = {}) {
  const calls = [];
  const interaction = {
    deferred,
    replied,
    ephemeral,
    createdTimestamp: Date.now() - ageMs,
  };
  for (const method of [
    "reply",
    "deferReply",
    "editReply",
    "followUp",
    "deleteReply",
  ]) {
    interaction[method] = async (payload) => {
      calls.push({ method, payload });
      if (pending?.method === method) await pending.promise;
      if (fail === method)
        throw Object.assign(new Error("private internal data"), {
          code: "ECONNRESET",
        });
      if (method === "deferReply") {
        interaction.deferred = true;
        interaction.ephemeral = Boolean(payload?.flags & 64);
      }
      if (method === "reply") {
        interaction.replied = true;
        interaction.ephemeral = Boolean(payload?.flags & 64);
      }
      if (method === "editReply") interaction.replied = true;
      return { id: "controlled-message" };
    };
  }
  return { interaction, calls };
}

function contentOf(payload) {
  return typeof payload === "string" ? payload : payload?.content;
}

function methods(calls) {
  return calls.map((call) => call.method);
}

test("respond seleciona reply, editReply ou followUp conforme o estado real", async (t) => {
  for (const [state, expected] of [
    [{}, "reply"],
    [{ deferred: true }, "editReply"],
    [{ replied: true }, "followUp"],
    [{ deferred: true, replied: true }, "followUp"],
  ]) {
    await t.test(expected + JSON.stringify(state), async () => {
      const { interaction, calls } = fixture(state);
      await respond(interaction, "response");
      assert.deepEqual(methods(calls), [expected]);
      assert.equal(contentOf(calls[0].payload), "response");
    });
  }
});

test("payload legado ephemeral torna-se flags sem alterar o contrato público", async () => {
  const { interaction, calls } = fixture();
  await respond(interaction, { content: "private", ephemeral: true });
  assert.equal(calls[0].payload.flags & 64, 64);
  assert.equal(Object.hasOwn(calls[0].payload, "ephemeral"), false);
  assert.equal(contentOf(calls[0].payload), "private");
});

test("resposta pública inicial não ganha visibilidade efêmera incidental", async () => {
  const { interaction, calls } = fixture();
  await respond(interaction, { content: "public", ephemeral: false });
  assert.equal(Boolean(calls[0].payload.flags & 64), false);
  assert.equal(Object.hasOwn(calls[0].payload, "ephemeral"), false);
});

test("edição da resposta original não tenta alterar flags imutáveis de visibilidade", async () => {
  const { interaction, calls } = fixture({ deferred: true, ephemeral: true });
  await respond(interaction, { content: "edited", flags: 64, ephemeral: true });
  assert.deepEqual(methods(calls), ["editReply"]);
  assert.equal(contentOf(calls[0].payload), "edited");
  assert.equal(Object.hasOwn(calls[0].payload, "ephemeral"), false);
  assert.equal(Boolean(calls[0].payload.flags & 64), false);
});

test("defer público é idempotente e não envia novo acknowledgement", async () => {
  const { interaction, calls } = fixture();
  await deferResponse(interaction);
  await deferResponse(interaction);
  assert.deepEqual(methods(calls), ["deferReply"]);
  assert.equal(Boolean(calls[0].payload?.flags & 64), false);
});

test("defer privado usa flags atuais e é preservado até editReply", async () => {
  const { interaction, calls } = fixture();
  await deferResponse(interaction, { ephemeral: true });
  await respond(interaction, { content: "private", flags: 64 });
  assert.deepEqual(methods(calls), ["deferReply", "editReply"]);
  assert.equal(calls[0].payload.flags & 64, 64);
  assert.equal(Object.hasOwn(calls[0].payload, "ephemeral"), false);
});

test("defer em interações previamente respondidas ou deferidas não duplica ack", async () => {
  for (const state of [{ replied: true }, { deferred: true }]) {
    const { interaction, calls } = fixture(state);
    await deferResponse(interaction);
    assert.equal(calls.length, 0);
  }
});

test("editResponse força edição após reply, como exigido por ping", async () => {
  const { interaction, calls } = fixture({ replied: true });
  await editResponse(interaction, "new latency");
  assert.deepEqual(methods(calls), ["editReply"]);
  assert.equal(contentOf(calls[0].payload), "new latency");
});

test("erro privado após defer público neutraliza original, envia privado e remove placeholder", async () => {
  const { interaction, calls } = fixture({ deferred: true });
  await respond(interaction, {
    content: "private validation error",
    ephemeral: true,
  });
  assert.deepEqual(methods(calls), ["editReply", "followUp", "deleteReply"]);
  assert.equal(contentOf(calls[0].payload), "\u200b");
  assert.equal(Boolean(calls[0].payload.flags & 64), false);
  assert.equal(contentOf(calls[1].payload), "private validation error");
  assert.equal(calls[1].payload.flags & 64, 64);
});

test("expiração após neutralizar original impede followUp e reenvio central", async (t) => {
  const { interaction, calls } = fixture({ deferred: true });
  const editReply = interaction.editReply;
  t.mock.method(interaction, "editReply", async (payload) => {
    const result = await editReply(payload);
    interaction.createdTimestamp = Date.now() - 16 * 60 * 1000;
    return result;
  });
  await assert.rejects(
    respond(interaction, { content: "private result", flags: 64 }),
    InteractionResponseError,
  );
  await handleInteractionError(interaction, new Error("private failure"));
  assert.deepEqual(methods(calls), ["editReply"]);
  assert.equal(contentOf(calls[0].payload), "\u200b");
});

test("expiração após followUp impede deleteReply e reenvio central", async (t) => {
  const { interaction, calls } = fixture({ deferred: true });
  const followUp = interaction.followUp;
  t.mock.method(interaction, "followUp", async (payload) => {
    const result = await followUp(payload);
    interaction.createdTimestamp = Date.now() - 16 * 60 * 1000;
    return result;
  });
  await assert.rejects(
    respond(interaction, { content: "private result", flags: 64 }),
    InteractionResponseError,
  );
  await handleInteractionError(interaction, new Error("private failure"));
  assert.deepEqual(methods(calls), ["editReply", "followUp"]);
  assert.equal(contentOf(calls[0].payload), "\u200b");
  assert.equal(contentOf(calls[1].payload), "private result");
  assert.equal(calls[1].payload.flags & 64, 64);
});

test("resultado público após defer privado usa followUp público após neutralizar original", async () => {
  const { interaction, calls } = fixture({ deferred: true, ephemeral: true });
  await respond(interaction, { content: "public result" });
  assert.deepEqual(methods(calls), ["editReply", "followUp", "deleteReply"]);
  assert.equal(contentOf(calls[0].payload), "\u200b");
  assert.equal(contentOf(calls[1].payload), "public result");
  assert.equal(Boolean(calls[1].payload.flags & 64), false);
});

test("erro posterior preserva a visibilidade do resultado mais recente após mixed defer", async () => {
  const { interaction, calls } = fixture({ deferred: true });
  await respond(interaction, { content: "private result", ephemeral: true });
  await handleInteractionError(interaction, new Error("private error"));
  assert.deepEqual(methods(calls), [
    "editReply",
    "followUp",
    "deleteReply",
    "followUp",
  ]);
  assert.equal(contentOf(calls[3].payload), ERROR_MESSAGE);
  assert.equal(calls[3].payload.flags & 64, 64);
});

test("cada falha no fluxo público para privado encerra a sequência sem retries", async (t) => {
  for (const [fail, expected] of [
    ["editReply", ["editReply"]],
    ["followUp", ["editReply", "followUp"]],
    ["deleteReply", ["editReply", "followUp", "deleteReply"]],
  ]) {
    await t.test(fail, async () => {
      const { interaction, calls } = fixture({ deferred: true, fail });
      await assert.rejects(
        respond(interaction, { content: "private", ephemeral: true }),
        InteractionResponseError,
      );
      await handleInteractionError(interaction, new Error("private data"));
      assert.deepEqual(methods(calls), expected);
    });
  }
});

test("falhas de reply, editReply e followUp não causam segunda tentativa ambígua", async (t) => {
  for (const [state, fail] of [
    [{}, "reply"],
    [{ deferred: true }, "editReply"],
    [{ replied: true }, "followUp"],
  ]) {
    await t.test(fail, async () => {
      const { interaction, calls } = fixture({ ...state, fail });
      await assert.rejects(
        respond(interaction, "result"),
        InteractionResponseError,
      );
      await handleInteractionError(interaction, new Error("private error"));
      await Promise.allSettled([respond(interaction, "retry")]);
      assert.deepEqual(methods(calls), [fail]);
    });
  }
});

test("falha de defer impede iniciar a operação lenta e dispensa novo reply", async () => {
  const { interaction, calls } = fixture({ fail: "deferReply" });
  let started = 0;
  await runWithErrorHandling(interaction, async () => {
    await deferResponse(interaction);
    started++;
  });
  assert.equal(started, 0);
  assert.deepEqual(methods(calls), ["deferReply"]);
});

test("entregas concorrentes não enviam duas mensagens enquanto a primeira está pendente", async () => {
  const pending = deferredPromise();
  const { interaction, calls } = fixture({
    pending: { method: "reply", promise: pending.promise },
  });
  const first = respond(interaction, "first");
  const second = respond(interaction, "second");
  const outcomes = Promise.allSettled([first, second]);
  await handleInteractionError(
    interaction,
    new Error("concurrent private error"),
  );
  assert.deepEqual(methods(calls), ["reply"]);
  pending.resolve();
  await outcomes;
  assert.deepEqual(methods(calls), ["reply"]);
});

test("defers concorrentes não duplicam acknowledgement", async () => {
  const pending = deferredPromise();
  const { interaction, calls } = fixture({
    pending: { method: "deferReply", promise: pending.promise },
  });
  const outcomes = Promise.allSettled([
    deferResponse(interaction),
    deferResponse(interaction),
  ]);
  assert.deepEqual(methods(calls), ["deferReply"]);
  pending.resolve();
  await outcomes;
  assert.deepEqual(methods(calls), ["deferReply"]);
});

test("tratamento central responde uma vez em cada estado com mensagem fixa", async (t) => {
  for (const [state, expected] of [
    [{}, "reply"],
    [{ deferred: true }, "editReply"],
    [{ replied: true }, "followUp"],
    [{ deferred: true, replied: true }, "followUp"],
  ]) {
    await t.test(expected + JSON.stringify(state), async () => {
      const { interaction, calls } = fixture(state);
      await handleInteractionError(
        interaction,
        new Error("sensitive environment details"),
      );
      await handleInteractionError(interaction, new Error("second failure"));
      assert.deepEqual(methods(calls), [expected]);
      assert.equal(contentOf(calls[0].payload), ERROR_MESSAGE);
      assert.equal(Boolean(calls[0].payload.flags & 64), false);
    });
  }
});

test("erro posterior mantém a visibilidade privada já estabelecida", async () => {
  const { interaction, calls } = fixture({ replied: true, ephemeral: true });
  await handleInteractionError(interaction, new Error("private error"));
  assert.deepEqual(methods(calls), ["followUp"]);
  assert.equal(calls[0].payload.flags & 64, 64);
  assert.equal(contentOf(calls[0].payload), ERROR_MESSAGE);
});

test("erro após defer privado edita original sem tentar trocar visibilidade", async () => {
  const { interaction, calls } = fixture({ deferred: true, ephemeral: true });
  await handleInteractionError(interaction, new Error("private error"));
  assert.deepEqual(methods(calls), ["editReply"]);
  assert.equal(contentOf(calls[0].payload), ERROR_MESSAGE);
  assert.equal(Boolean(calls[0].payload.flags & 64), false);
});

test("interações expiradas são ignoradas pelo tratamento de erro", async (t) => {
  for (const state of [
    { ageMs: 4000 },
    { deferred: true, ageMs: 15 * 60 * 1000 + 100 },
    { replied: true, ageMs: 15 * 60 * 1000 + 100 },
  ]) {
    await t.test(JSON.stringify(state), async () => {
      const { interaction, calls } = fixture(state);
      await handleInteractionError(interaction, new Error("sensitive error"));
      assert.equal(calls.length, 0);
    });
  }
});

test("erro posterior a defer continua permitido após o prazo inicial de 3 segundos", async () => {
  const { interaction, calls } = fixture({ deferred: true, ageMs: 10000 });
  await handleInteractionError(interaction, new Error("private error"));
  assert.deepEqual(methods(calls), ["editReply"]);
});

test("códigos terminais Discord não provocam novo envio", async (t) => {
  for (const code of [
    10062,
    "10062",
    10015,
    50027,
    40060,
    "InteractionAlreadyReplied",
    "InteractionNotReplied",
  ]) {
    await t.test(String(code), async () => {
      const { interaction, calls } = fixture();
      await handleInteractionError(
        interaction,
        Object.assign(new Error("private details"), { code }),
      );
      assert.equal(calls.length, 0);
    });
  }
});

test("código terminal em rawError também impede reenvio", async () => {
  const { interaction, calls } = fixture();
  await handleInteractionError(interaction, { rawError: { code: 10062 } });
  assert.equal(calls.length, 0);
});

test("falha ao enviar o próprio erro central é capturada sem retries", async () => {
  for (const [state, fail] of [
    [{}, "reply"],
    [{ deferred: true }, "editReply"],
    [{ replied: true }, "followUp"],
  ]) {
    const { interaction, calls } = fixture({ ...state, fail });
    await handleInteractionError(interaction, new Error("private details"));
    await handleInteractionError(interaction, new Error("another failure"));
    assert.deepEqual(methods(calls), [fail]);
  }
});

test("runWithErrorHandling aguarda a tarefa, captura rejeição e trata o estado de resposta", async () => {
  const { interaction, calls } = fixture();
  await runWithErrorHandling(interaction, async () => {
    await deferResponse(interaction);
    throw new Error("private API failure");
  });
  assert.deepEqual(methods(calls), ["deferReply", "editReply"]);
  assert.equal(contentOf(calls[1].payload), ERROR_MESSAGE);
});

test("runSecondary captura falha posterior sem expor erro bruto ou rejeição solta", async (t) => {
  const printed = [];
  for (const method of ["error", "warn", "log"]) {
    t.mock.method(console, method, (...args) => printed.push(...args));
  }
  const unhandled = [];
  const onUnhandled = (error) => unhandled.push(error);
  process.on("unhandledRejection", onUnhandled);
  t.after(() => process.off("unhandledRejection", onUnhandled));
  await runSecondary(async () => {
    throw Object.assign(new Error("SENSITIVE_SENTINEL"), {
      config: { auth: "SENSITIVE_SENTINEL" },
    });
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(unhandled.length, 0);
  assert.ok(printed.length > 0);
  assert.ok(printed.every((entry) => typeof entry === "string"));
  assert.doesNotMatch(JSON.stringify(printed), /SENSITIVE_SENTINEL/);
});

test("tratamento central não registra stack, payload ou configuração sensível", async (t) => {
  const printed = [];
  for (const method of ["error", "warn", "log"]) {
    t.mock.method(console, method, (...args) => printed.push(...args));
  }
  const { interaction, calls } = fixture();
  await handleInteractionError(
    interaction,
    Object.assign(new Error("SENSITIVE_SENTINEL"), {
      response: { data: "SENSITIVE_SENTINEL" },
      config: { headers: { Authorization: "SENSITIVE_SENTINEL" } },
    }),
  );
  assert.doesNotMatch(JSON.stringify({ printed, calls }), /SENSITIVE_SENTINEL/);
  assert.ok(printed.every((entry) => typeof entry === "string"));
});
