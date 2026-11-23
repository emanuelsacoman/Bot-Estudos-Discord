const assert = require("node:assert/strict");
const dns = require("node:dns");
const dnsPromises = require("node:dns/promises");
const http = require("node:http");
const https = require("node:https");
const net = require("node:net");
const { beforeEach, test } = require("node:test");
const tls = require("node:tls");
const {
  MIN_TIMER_MINUTES,
  MAX_TIMER_MINUTES,
  TimerDurationError,
  validateDuration,
  createTimerKey,
  createTimerManager,
} = require("../lib/timers");

beforeEach((t) => {
  t.mock.method(Date, "now", () => 10000);
  const noNetwork = () => {
    throw new Error("Testes de timers não podem usar rede real.");
  };
  t.mock.method(dns, "lookup", noNetwork);
  t.mock.method(dnsPromises, "lookup", noNetwork);
  t.mock.method(net.Socket.prototype, "connect", noNetwork);
  t.mock.method(tls, "connect", noNetwork);
  t.mock.method(globalThis, "fetch", noNetwork);
  for (const transport of [http, https]) {
    t.mock.method(transport, "request", noNetwork);
    t.mock.method(transport, "get", noNetwork);
  }
});

function clockForTest() {
  let timestamp = 10000;
  let nextFailure;
  const scheduled = [];
  const events = [];
  return {
    scheduled,
    events,
    now: () => timestamp,
    advance(milliseconds) {
      timestamp += milliseconds;
    },
    failNext(error) {
      nextFailure = error;
    },
    setTimeout(callback, delay) {
      events.push({ method: "schedule", delay });
      if (nextFailure) {
        const error = nextFailure;
        nextFailure = undefined;
        throw error;
      }
      const handle = { id: scheduled.length };
      scheduled.push({ callback, delay, handle, cancelled: false });
      return handle;
    },
    clearTimeout(handle) {
      events.push({ method: "cancel", handle });
      const entry = scheduled.find((task) => task.handle === handle);
      if (entry) entry.cancelled = true;
    },
    // Deliberately allows firing cancelled/old callbacks to model an event
    // already queued before clearTimeout. No real timer or waiting is used.
    fire(index = scheduled.length - 1) {
      return scheduled[index].callback();
    },
  };
}

function managerFor(clock, options = {}) {
  return createTimerManager({
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    now: clock.now,
    ...options,
  });
}

function logCapture(t) {
  const logs = [];
  for (const method of ["warn", "error"]) {
    t.mock.method(console, method, (...args) => logs.push(args));
  }
  return logs;
}

test("duração válida é convertida exatamente de minutos para milissegundos", () => {
  assert.equal(MIN_TIMER_MINUTES, 1);
  assert.equal(MAX_TIMER_MINUTES, 1440);
  assert.equal(validateDuration(1), 60000);
  assert.equal(validateDuration(25), 1500000);
  assert.equal(validateDuration(1440), 86400000);
  assert.ok(validateDuration(MAX_TIMER_MINUTES) < 2147483647);
});

const invalidDurations = [
  ["zero", 0],
  ["negativo", -1],
  ["fracionário", 1.5],
  ["acima de 24 horas", 1441],
  ["overflow do timeout Node", 35792],
  ["NaN", NaN],
  ["infinito", Infinity],
  ["infinito negativo", -Infinity],
  ["inteiro seguro fora da faixa", Number.MAX_SAFE_INTEGER],
  ["inteiro não seguro", Number.MAX_SAFE_INTEGER + 1],
  ["string numérica", "1"],
  ["null", null],
  ["undefined", undefined],
  ["boolean", true],
  ["bigint", 1n],
  ["objeto", {}],
  ["array", [1]],
];

for (const [label, duration] of invalidDurations) {
  test(`duração ${label} é recusada sem coerção e preserva timer existente`, () => {
    assert.throws(() => validateDuration(duration), TimerDurationError);
    const clock = clockForTest();
    const manager = managerFor(clock);
    manager.set("active", 1, async () => {});
    assert.throws(
      () => manager.set("active", duration, async () => {}),
      TimerDurationError,
    );
    assert.equal(manager.size, 1);
    assert.equal(manager.has("active"), true);
    assert.equal(clock.scheduled.length, 1);
    assert.equal(clock.scheduled[0].cancelled, false);
  });
}

test("escopo é usuário+servidor e DM é usuário+canal, sem colisões", () => {
  const guild = (userId, guildId, channelId) =>
    createTimerKey({ userId, guildId, channelId });
  const dm = (userId, channelId) =>
    createTimerKey({ userId, guildId: null, channelId });
  assert.equal(guild("u", "g", "c1"), guild("u", "g", "c2"));
  assert.notEqual(guild("u", "g1"), guild("u", "g2"));
  assert.notEqual(guild("u1", "g"), guild("u2", "g"));
  assert.notEqual(dm("u", "c1"), dm("u", "c2"));
  assert.notEqual(dm("u1", "c"), dm("u2", "c"));
  assert.notEqual(guild("u", "c"), dm("u", "c"));
  assert.notEqual(guild("a:b", "c"), guild("b", "c:a"));
});

test("contextos sem usuário ou sem identificador de escopo são recusados", () => {
  for (const context of [
    {},
    { userId: "", guildId: "g" },
    { userId: "u", guildId: "" },
    { userId: "u", guildId: 1 },
    { userId: "u", guildId: null },
    { userId: "u", guildId: null, channelId: "" },
  ]) {
    assert.throws(() => createTimerKey(context), TypeError);
  }
});

test("novo agendamento usa relógio injetado e expira uma única vez", async () => {
  const clock = clockForTest();
  const manager = managerFor(clock);
  let calls = 0;
  const result = manager.set("timer", 25, () => {
    calls += 1;
  });
  assert.deepEqual(result, { replaced: false, expiresAt: 1510000 });
  assert.equal(clock.scheduled[0].delay, 1500000);
  assert.equal(manager.size, 1);
  assert.equal(calls, 0);
  await clock.fire(0);
  await clock.fire(0);
  assert.equal(calls, 1);
  assert.equal(manager.has("timer"), false);
  assert.equal(manager.size, 0);
});

test("substituição agenda antes de cancelar e ignora o callback anterior", async () => {
  const clock = clockForTest();
  const manager = managerFor(clock);
  const deliveries = [];
  manager.set("timer", 1, () => deliveries.push("old"));
  clock.advance(1000);
  const result = manager.set("timer", 2, () => deliveries.push("new"));
  assert.deepEqual(result, { replaced: true, expiresAt: 131000 });
  assert.deepEqual(
    clock.events.map(({ method }) => method),
    ["schedule", "schedule", "cancel"],
  );
  assert.equal(clock.scheduled[0].cancelled, true);
  await clock.fire(0);
  assert.equal(manager.has("timer"), true);
  assert.deepEqual(deliveries, []);
  await clock.fire(1);
  assert.deepEqual(deliveries, ["new"]);
  assert.equal(manager.size, 0);
});

test("stop cancela e torna um callback já enfileirado inofensivo", async () => {
  const clock = clockForTest();
  const manager = managerFor(clock);
  let calls = 0;
  assert.equal(manager.stop("timer"), false);
  manager.set("timer", 1, () => {
    calls += 1;
  });
  assert.equal(manager.stop("timer"), true);
  assert.equal(manager.stop("timer"), false);
  assert.equal(clock.scheduled[0].cancelled, true);
  await clock.fire(0);
  assert.equal(calls, 0);
  assert.equal(manager.size, 0);
});

test("stop seguido de novo set não deixa callback cancelado apagar o novo timer", async () => {
  const clock = clockForTest();
  const manager = managerFor(clock);
  const deliveries = [];
  manager.set("timer", 1, () => deliveries.push("cancelled"));
  manager.stop("timer");
  manager.set("timer", 1, () => deliveries.push("active"));
  await clock.fire(0);
  assert.equal(manager.has("timer"), true);
  await clock.fire(1);
  assert.deepEqual(deliveries, ["active"]);
});

for (const outcome of ["resolvido", "rejeitado"]) {
  test(`envio antigo ${outcome} não apaga timer criado enquanto estava pendente`, async (t) => {
    logCapture(t);
    const clock = clockForTest();
    const manager = managerFor(clock);
    let release;
    let rejectSend;
    let newDeliveries = 0;
    const pendingSend = new Promise((resolve, reject) => {
      release = resolve;
      rejectSend = reject;
    });
    manager.set("timer", 1, () => {
      assert.equal(manager.has("timer"), false);
      assert.equal(manager.stop("timer"), false);
      return pendingSend;
    });
    const oldCompletion = clock.fire(0);
    assert.equal(manager.size, 0);
    manager.set("timer", 2, () => {
      newDeliveries += 1;
    });
    if (outcome === "rejeitado")
      rejectSend(new Error("envio antigo simulado falhou"));
    else release();
    await oldCompletion;
    assert.equal(manager.has("timer"), true);
    await clock.fire(1);
    assert.equal(newDeliveries, 1);
    assert.equal(manager.size, 0);
  });
}

for (const kind of ["síncrona", "assíncrona"]) {
  test(`falha ${kind} no callback é capturada com estado já removido e log fixo`, async (t) => {
    const logs = logCapture(t);
    const clock = clockForTest();
    const manager = managerFor(clock);
    const error = new Error("sentinela-detalhe-privado-de-envio");
    const callback =
      kind === "síncrona"
        ? () => {
            throw error;
          }
        : async () => {
            throw error;
          };
    manager.set("timer", 1, callback);
    await assert.doesNotReject(clock.fire(0));
    assert.equal(manager.size, 0);
    assert.deepEqual(logs, [["Falha ao enviar aviso do temporizador."]]);
    assert.doesNotMatch(JSON.stringify(logs), /sentinela/);
  });
}

test("falha no diagnóstico assíncrono também é capturada sem rejeição solta", async () => {
  const clock = clockForTest();
  const manager = managerFor(clock, {
    onError: async () => {
      throw new Error("diagnóstico simulado");
    },
  });
  manager.set("timer", 1, async () => {
    throw new Error("envio simulado");
  });
  await assert.doesNotReject(clock.fire(0));
  assert.equal(manager.size, 0);
});

test("falha de agendamento não cria estado nem cancela o timer válido anterior", async () => {
  const clock = clockForTest();
  const manager = managerFor(clock);
  const error = new Error("scheduler simulado indisponível");
  clock.failNext(error);
  assert.throws(
    () => manager.set("new", 1, () => {}),
    (received) => received === error,
  );
  assert.equal(manager.size, 0);
  let deliveries = 0;
  manager.set("active", 1, () => {
    deliveries += 1;
  });
  clock.failNext(error);
  assert.throws(
    () => manager.set("active", 2, () => {}),
    (received) => received === error,
  );
  assert.equal(manager.has("active"), true);
  assert.equal(clock.scheduled[0].cancelled, false);
  await clock.fire(0);
  assert.equal(deliveries, 1);
  assert.equal(manager.size, 0);
});

test("agendamento inválido não altera o timer existente", () => {
  const clock = clockForTest();
  const manager = managerFor(clock);
  manager.set("active", 1, () => {});
  assert.throws(() => manager.set("active", 1, null), TypeError);
  assert.throws(() => manager.set("", 1, () => {}), TypeError);
  assert.equal(manager.size, 1);
  assert.equal(clock.scheduled.length, 1);
});

test("clearAll remove todos os estados antes de callbacks antigos e é idempotente", async () => {
  const clock = clockForTest();
  const manager = managerFor(clock);
  let sends = 0;
  manager.set("one", 1, () => {
    sends += 1;
  });
  manager.set("two", 2, () => {
    sends += 1;
  });
  assert.equal(manager.clearAll(), 2);
  assert.equal(manager.size, 0);
  assert.equal(manager.clearAll(), 0);
  assert.ok(clock.scheduled.every(({ cancelled }) => cancelled));
  await clock.fire(0);
  await clock.fire(1);
  assert.equal(sends, 0);
});

async function withTimerCommand(manager, run) {
  const managerPath = require.resolve("../lib/timers");
  const commandPath = require.resolve("../commands/timer");
  const previousManager = require.cache[managerPath];
  const previousCommand = require.cache[commandPath];
  require.cache[managerPath] = {
    id: managerPath,
    filename: managerPath,
    loaded: true,
    exports: { ...previousManager.exports, createTimerManager: () => manager },
  };
  delete require.cache[commandPath];
  try {
    await run(require(commandPath));
  } finally {
    require.cache[managerPath] = previousManager;
    if (previousCommand) require.cache[commandPath] = previousCommand;
    else delete require.cache[commandPath];
  }
}

function interactionFor({
  userId = "user-a",
  guildId = "guild-a",
  channelId = "channel-a",
  subcommand = "set",
  minutes = 1,
  failReply = false,
  failSend = false,
} = {}) {
  const events = [];
  const sent = [];
  return {
    createdTimestamp: 10000,
    user: { id: userId },
    guildId,
    channelId,
    channel: {
      id: channelId,
      sent,
      async send(payload) {
        sent.push(payload);
        if (failSend) throw new Error("sentinela-privada-do-canal");
      },
    },
    isCommand: () => true,
    options: {
      getSubcommand: () => subcommand,
      getInteger: (name) => {
        assert.equal(name, "tempo");
        return minutes;
      },
    },
    events,
    deferred: false,
    replied: false,
    ephemeral: false,
    async reply(payload) {
      assert.equal(this.deferred || this.replied, false);
      events.push(payload);
      if (failReply) throw new Error("sentinela-privada-do-reply");
      this.replied = true;
      this.ephemeral = Boolean(payload.flags & 64);
    },
  };
}

function publicEmbed(interaction, title) {
  assert.equal(interaction.events.length, 1);
  assert.equal(interaction.ephemeral, false);
  const payload = interaction.events[0];
  assert.equal(payload.embeds.length, 1);
  const embed = payload.embeds[0].toJSON();
  assert.equal(embed.title, title);
  assert.equal(embed.footer.text, "CodeBucket");
  return embed;
}

test("/timer válido confirma publicamente e expira enviando ao canal original", async () => {
  const clock = clockForTest();
  const manager = managerFor(clock);
  const interaction = interactionFor();
  const originalChannel = interaction.channel;
  await withTimerCommand(manager, async (command) => {
    await command.execute(interaction);
    const embed = publicEmbed(interaction, "Temporizador Iniciado");
    assert.match(embed.description, /1 minuto\(s\)/);
    assert.equal(clock.scheduled[0].delay, 60000);
    interaction.channel = {
      send: () => assert.fail("Canal alterado indevidamente"),
    };
    interaction.user.id = "other-user";
    await clock.fire(0);
  });
  assert.equal(manager.size, 0);
  assert.equal(originalChannel.sent.length, 1);
  assert.equal(originalChannel.sent[0].content, "<@user-a>");
  assert.equal(
    originalChannel.sent[0].embeds[0].toJSON().title,
    "Temporizador Finalizado",
  );
  assert.equal(interaction.events.length, 1);
});

test("/timer stop em outro canal do mesmo servidor cancela o timer e mantém mensagem pública", async () => {
  const clock = clockForTest();
  const manager = managerFor(clock);
  const start = interactionFor();
  const stop = interactionFor({
    subcommand: "stop",
    channelId: "another-channel",
  });
  await withTimerCommand(manager, async (command) => {
    await command.execute(start);
    await command.execute(stop);
    publicEmbed(stop, "Temporizador Excluído");
    await clock.fire(0);
  });
  assert.equal(manager.size, 0);
  assert.equal(start.channel.sent.length, 0);
});

test("/timer falha ao confirmar stop mantém cancelamento local sem retry", async () => {
  const clock = clockForTest();
  const manager = managerFor(clock);
  const start = interactionFor();
  const stop = interactionFor({ subcommand: "stop", failReply: true });
  await withTimerCommand(manager, async (command) => {
    await command.execute(start);
    await assert.rejects(command.execute(stop));
    assert.equal(manager.size, 0);
    await clock.fire(0);
  });
  assert.equal(stop.events.length, 1);
  assert.equal(start.channel.sent.length, 0);
});

test("/timer stop sem timer, inclusive depois de expirar, mantém aviso efêmero", async () => {
  const clock = clockForTest();
  const manager = managerFor(clock);
  await withTimerCommand(manager, async (command) => {
    const absent = interactionFor({ subcommand: "stop" });
    await command.execute(absent);
    assert.equal(absent.ephemeral, true);
    assert.equal(
      absent.events[0].content,
      "Não há temporizador em execução para você.",
    );
    const start = interactionFor();
    await command.execute(start);
    await clock.fire(0);
    const expired = interactionFor({ subcommand: "stop" });
    await command.execute(expired);
    assert.equal(expired.ephemeral, true);
    assert.equal(expired.events[0].content, absent.events[0].content);
  });
});

test("/timer duração inválida responde privadamente e não substitui timer ativo", async () => {
  const clock = clockForTest();
  const manager = managerFor(clock);
  const start = interactionFor();
  await withTimerCommand(manager, async (command) => {
    await command.execute(start);
    for (const minutes of [0, -1, 1.5, 1441, "1", NaN, Infinity]) {
      const invalid = interactionFor({ minutes });
      await command.execute(invalid);
      assert.equal(invalid.events.length, 1);
      assert.equal(invalid.ephemeral, true);
      assert.match(invalid.events[0].content, /inteiro entre 1 e 1440 minutos/);
    }
    assert.equal(manager.size, 1);
    assert.equal(clock.scheduled.length, 1);
    assert.equal(clock.scheduled[0].cancelled, false);
  });
});

test("/timer valida antes de interpolar ou converter um valor inesperado", async () => {
  const clock = clockForTest();
  const manager = managerFor(clock);
  let conversions = 0;
  const minutes = {
    toString() {
      conversions += 1;
      throw new Error("Uma duração inválida não deve ser convertida.");
    },
  };
  const interaction = interactionFor({ minutes });
  await withTimerCommand(manager, async (command) =>
    command.execute(interaction),
  );
  assert.equal(conversions, 0);
  assert.equal(interaction.ephemeral, true);
  assert.match(interaction.events[0].content, /inteiro entre 1 e 1440 minutos/);
  assert.equal(manager.size, 0);
  assert.equal(clock.scheduled.length, 0);
});

test("/timer separa usuários, servidores e canais de DM; stop não cruza escopos", async () => {
  const clock = clockForTest();
  const manager = managerFor(clock);
  const contexts = [
    { userId: "u1", guildId: "g1", channelId: "c1" },
    { userId: "u1", guildId: "g2", channelId: "c2" },
    { userId: "u2", guildId: "g1", channelId: "c1" },
    { userId: "u1", guildId: null, channelId: "dm1" },
    { userId: "u1", guildId: null, channelId: "dm2" },
  ];
  const starts = contexts.map((context) => interactionFor(context));
  await withTimerCommand(manager, async (command) => {
    for (const start of starts) await command.execute(start);
    assert.equal(manager.size, 5);
    await command.execute(
      interactionFor({ ...contexts[0], subcommand: "stop" }),
    );
    assert.equal(manager.size, 4);
    for (let index = 0; index < starts.length; index += 1)
      await clock.fire(index);
  });
  assert.deepEqual(
    starts.map(({ channel }) => channel.sent.length),
    [0, 1, 1, 1, 1],
  );
  assert.equal(manager.size, 0);
});

test("/timer substitui no mesmo usuário+servidor e preserva o novo canal de aviso", async () => {
  const clock = clockForTest();
  const manager = managerFor(clock);
  const first = interactionFor();
  const second = interactionFor({ channelId: "channel-b", minutes: 2 });
  await withTimerCommand(manager, async (command) => {
    await command.execute(first);
    await command.execute(second);
    assert.equal(manager.size, 1);
    await clock.fire(0);
    assert.equal(manager.size, 1);
    await clock.fire(1);
  });
  assert.equal(first.channel.sent.length, 0);
  assert.equal(second.channel.sent.length, 1);
  assert.equal(manager.size, 0);
});

test("/timer contexto incompleto ou canal indisponível produz aviso privado sem agendar", async () => {
  const clock = clockForTest();
  const manager = managerFor(clock);
  const noUser = interactionFor();
  noUser.user = undefined;
  const noDmChannel = interactionFor({ guildId: null, channelId: null });
  noDmChannel.channel = null;
  const noChannel = interactionFor();
  noChannel.channel = null;
  await withTimerCommand(manager, async (command) => {
    for (const interaction of [noUser, noDmChannel, noChannel]) {
      await command.execute(interaction);
      assert.equal(interaction.events.length, 1);
      assert.equal(interaction.ephemeral, true);
    }
  });
  assert.equal(clock.scheduled.length, 0);
  assert.equal(manager.size, 0);
});

test("/timer falha na confirmação mantém efeito local sem segunda resposta ou rollback", async () => {
  const clock = clockForTest();
  const manager = managerFor(clock);
  const interaction = interactionFor({ failReply: true });
  await withTimerCommand(manager, async (command) => {
    await assert.rejects(command.execute(interaction));
    assert.equal(interaction.events.length, 1);
    assert.equal(manager.size, 1);
    await clock.fire(0);
  });
  assert.equal(interaction.channel.sent.length, 1);
  assert.equal(manager.size, 0);
});

test("/timer falha tardia da confirmação anterior não apaga uma substituição", async () => {
  const clock = clockForTest();
  const manager = managerFor(clock);
  const first = interactionFor();
  let rejectFirst;
  first.reply = (payload) => {
    first.events.push(payload);
    return new Promise((_resolve, reject) => {
      rejectFirst = reject;
    });
  };
  const second = interactionFor({ minutes: 2 });
  await withTimerCommand(manager, async (command) => {
    const firstExecution = command.execute(first);
    const firstRejection = assert.rejects(firstExecution);
    await command.execute(second);
    rejectFirst(new Error("confirmação simulada ambígua"));
    await firstRejection;
    assert.equal(manager.size, 1);
    await clock.fire(0);
    assert.equal(manager.size, 1);
    await clock.fire(1);
  });
  assert.equal(first.channel.sent.length, 0);
  assert.equal(second.channel.sent.length, 1);
});

test("/timer falha do envio final remove estado e não tenta reply, follow-up ou retry", async (t) => {
  const logs = logCapture(t);
  const clock = clockForTest();
  const manager = managerFor(clock);
  const interaction = interactionFor({ failSend: true });
  await withTimerCommand(manager, async (command) => {
    await command.execute(interaction);
    await assert.doesNotReject(clock.fire(0));
    await clock.fire(0);
  });
  assert.equal(manager.size, 0);
  assert.equal(interaction.events.length, 1);
  assert.equal(interaction.channel.sent.length, 1);
  assert.doesNotMatch(JSON.stringify(logs), /sentinela/);
});
