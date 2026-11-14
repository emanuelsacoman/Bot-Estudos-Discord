const assert = require("node:assert/strict");
const dns = require("node:dns");
const dnsPromises = require("node:dns/promises");
const http = require("node:http");
const https = require("node:https");
const net = require("node:net");
const tls = require("node:tls");
const { beforeEach, test } = require("node:test");
const { Client, REST } = require("discord.js");
const { startBot } = require("../lib/startup");
const { runRegistration, CONFIRM_ARGUMENT } = require("../lib/registration");
const { CommandCatalogError } = require("../lib/command-catalog");
const { runWithErrorHandling, runSecondary } = require("../lib/interactions");
const { createTimerManager } = require("../lib/timers");

const SENTINEL = "SENSITIVE_LOG_INTEGRATION_SENTINEL";
const TEST_ENV = {
  TOKEN: "SENSITIVE_LOG_TOKEN_SENTINEL",
  CLIENT_ID: "123456789012345678",
};

beforeEach((t) => {
  const refuse = () => {
    throw new Error(
      "Somente dependências e interações simuladas são permitidas.",
    );
  };
  for (const transport of [http, https]) {
    t.mock.method(transport, "request", refuse);
    t.mock.method(transport, "get", refuse);
  }
  t.mock.method(dns, "lookup", refuse);
  t.mock.method(dnsPromises, "lookup", refuse);
  t.mock.method(net.Socket.prototype, "connect", refuse);
  t.mock.method(tls, "connect", refuse);
  t.mock.method(globalThis, "fetch", refuse);
  t.mock.method(Client.prototype, "login", refuse);
  t.mock.method(REST.prototype, "put", refuse);
  t.mock.method(process, "exit", refuse);
  const now = Date.now();
  t.mock.method(Date, "now", () => now);
});

function sensitiveError() {
  return Object.assign(new Error(`${SENTINEL} ${TEST_ENV.TOKEN}`), {
    config: {
      url: `https://internal.example.com/private?token=${SENTINEL}`,
      headers: { Authorization: `Bearer ${SENTINEL}` },
    },
    response: { status: 503, data: SENTINEL, headers: { cookie: SENTINEL } },
    task: SENTINEL,
  });
}

function loggerFixture(mode = "capture") {
  const calls = [];
  const logger = {};
  for (const level of ["log", "warn", "error"]) {
    if (mode === "getter") {
      Object.defineProperty(logger, level, {
        get() {
          calls.push({ level, getter: true });
          throw sensitiveError();
        },
      });
    } else {
      logger[level] = (...args) => {
        calls.push({ level, args });
        if (mode === "throw") throw sensitiveError();
        if (mode === "reject") return Promise.reject(sensitiveError());
        if (mode === "pending") return new Promise(() => {});
      };
    }
  }
  return { logger, calls };
}

function assertSanitized(calls) {
  assert.doesNotMatch(
    JSON.stringify(calls),
    /SENSITIVE_LOG|internal\.example|Authorization|Bearer|cookie/,
  );
  assert.ok(
    calls.every(
      ({ args }) =>
        args === undefined || args.every((arg) => typeof arg === "string"),
    ),
  );
}

async function withoutUnhandled(t, operation) {
  const unhandled = [];
  const listener = (error) => unhandled.push(error);
  process.on("unhandledRejection", listener);
  t.after(() => process.off("unhandledRejection", listener));
  const result = await operation();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(unhandled, []);
  return result;
}

async function completesWithoutWaiting(operation) {
  const waiting = Symbol("logger pending");
  const result = await Promise.race([
    operation,
    new Promise((resolve) => setImmediate(() => resolve(waiting))),
  ]);
  assert.notEqual(result, waiting, "O fluxo não deve esperar pelo logger.");
  return result;
}

function startupFixture({ logger, failAt, cleanupFails = false } = {}) {
  const events = [];
  const active = new Set();
  const scheduled = [];
  const schedule = (callback, delay) => {
    const handle = {
      callback,
      delay,
      unrefCalled: false,
      unref() {
        this.unrefCalled = true;
      },
    };
    active.add(handle);
    scheduled.push(handle);
    return handle;
  };
  const processState = {
    exitCode: undefined,
    exits: [],
    exit(code) {
      this.exits.push(code);
    },
  };
  const client = {
    async login(token) {
      events.push("login");
      assert.equal(token, TEST_ENV.TOKEN);
      if (failAt === "login") throw sensitiveError();
      return SENTINEL;
    },
    async destroy() {
      events.push("destroy");
    },
  };
  const start = () =>
    startBot({
      env: TEST_ENV,
      logger,
      processState,
      schedule,
      cancel: (handle) => active.delete(handle),
      loadCatalog() {
        events.push("catalog");
        if (failAt === "catalog") {
          const error = new CommandCatalogError();
          error.privateDetails = sensitiveError();
          throw error;
        }
        return { commands: [] };
      },
      createClient() {
        events.push("create");
        return client;
      },
      setupClient() {
        events.push("setup");
        return async () => {
          events.push("cleanup");
          if (cleanupFails) throw sensitiveError();
        };
      },
    });
  return { start, events, processState, active, scheduled, client };
}

test("startup bem-sucedido não registra o retorno sensível do login", async () => {
  const { logger, calls } = loggerFixture();
  const setup = startupFixture({ logger });
  assert.deepEqual(await setup.start(), { ok: true, client: setup.client });
  assert.deepEqual(setup.events, ["catalog", "create", "setup", "login"]);
  assert.equal(setup.processState.exitCode, undefined);
  assert.equal(setup.active.size, 0);
  assertSanitized(calls);
});

for (const mode of ["throw", "reject", "pending", "getter"]) {
  for (const failAt of ["login", "catalog"]) {
    test(`startup ${failAt} mantém saída/limpeza quando logger ${mode}`, async (t) => {
      const { logger, calls } = loggerFixture(mode);
      const setup = startupFixture({ logger, failAt, cleanupFails: true });
      const result = await withoutUnhandled(t, () =>
        completesWithoutWaiting(setup.start()),
      );
      assert.deepEqual(result, { ok: false });
      assert.equal(setup.processState.exitCode, 1);
      assert.deepEqual(
        setup.events,
        failAt === "catalog"
          ? ["catalog"]
          : ["catalog", "create", "setup", "login", "cleanup", "destroy"],
      );
      const watchdog = setup.scheduled.find(({ delay }) => delay === 5000);
      assert.ok(watchdog);
      assert.equal(watchdog.unrefCalled, true);
      assert.equal(setup.active.size, 1);
      watchdog.callback();
      assert.deepEqual(setup.processState.exits, [1]);
      assertSanitized(calls);
    });
  }
}

test("falha de login/catalog mantém diagnósticos úteis sem erro bruto", async () => {
  for (const failAt of ["login", "catalog"]) {
    const { logger, calls } = loggerFixture();
    const setup = startupFixture({ logger, failAt, cleanupFails: true });
    await setup.start();
    assert.ok(calls.length > 0);
    assert.match(
      calls[0].args[0],
      failAt === "login" ? /Falha no login/ : /Falha ao preparar o bot/,
    );
    if (failAt === "login")
      assert.ok(calls.some(({ args }) => /limpar recursos/.test(args[0])));
    assertSanitized(calls);
  }
});

function registrationFixture({ logger, stage = "success" }) {
  const calls = [];
  const catalog = () => {
    calls.push("catalog");
    if (stage === "catalog") throw new CommandCatalogError();
    return {
      payload: [{ type: 1, name: "exemplo", description: "Exemplo" }],
    };
  };
  const run = (argv = [CONFIRM_ARGUMENT]) =>
    runRegistration({
      argv,
      env: TEST_ENV,
      logger,
      loadEnvironment() {
        calls.push("environment");
      },
      loadCatalog: catalog,
      createRest() {
        calls.push("createRest");
        return {
          setToken(token) {
            assert.ok(token === TEST_ENV.TOKEN || token === null);
          },
          async put() {
            calls.push("put");
            if (stage === "rest") throw sensitiveError();
          },
          clearHashSweeper() {
            calls.push("clearHash");
          },
          clearHandlerSweeper() {
            calls.push("clearHandler");
          },
          agent: {
            async destroy() {
              calls.push("destroy");
            },
          },
        };
      },
    });
  return { calls, run };
}

for (const mode of ["throw", "reject", "pending"]) {
  for (const scenario of ["success", "rest", "catalog", "dry-run", "blocked"]) {
    test(`registro ${scenario} mantém resultado e não repete REST com logger ${mode}`, async (t) => {
      const { logger, calls: logs } = loggerFixture(mode);
      const setup = registrationFixture({ logger, stage: scenario });
      const argv =
        scenario === "dry-run"
          ? ["--dry-run"]
          : scenario === "blocked"
            ? []
            : [CONFIRM_ARGUMENT];
      const result = await withoutUnhandled(t, () =>
        completesWithoutWaiting(setup.run(argv)),
      );
      assert.equal(result, ["success", "dry-run"].includes(scenario) ? 0 : 1);
      assert.equal(
        setup.calls.filter((call) => call === "put").length,
        ["success", "rest"].includes(scenario) ? 1 : 0,
      );
      if (["success", "rest"].includes(scenario))
        assert.ok(setup.calls.includes("destroy"));
      if (scenario === "blocked") assert.deepEqual(setup.calls, []);
      if (scenario === "dry-run") assert.deepEqual(setup.calls, ["catalog"]);
      assertSanitized(logs);
    });
  }
}

test("registro preserva diagnósticos de catálogo, falha e sucesso sanitizados", async () => {
  for (const [stage, expected] of [
    ["catalog", /validar o catálogo/],
    ["rest", /concluir o registro/],
    ["success", /Registro global concluído/],
  ]) {
    const { logger, calls } = loggerFixture();
    const setup = registrationFixture({ logger, stage });
    await setup.run();
    assert.ok(calls.some(({ args }) => expected.test(args[0])));
    assertSanitized(calls);
  }
});

for (const mode of ["capture", "throw", "reject", "pending"]) {
  test(`fallback da entrada de registro mantém código 1 com console ${mode}`, async (t) => {
    const { logger, calls } = loggerFixture(mode);
    t.mock.method(console, "error", logger.error);
    const registrationPath = require.resolve("../lib/registration");
    const previous = require.cache[registrationPath];
    require.cache[registrationPath] = {
      ...previous,
      exports: {
        runRegistration: async () => {
          throw sensitiveError();
        },
      },
    };
    try {
      const { main } = require("../deploy-commands");
      const result = await withoutUnhandled(t, () =>
        completesWithoutWaiting(main()),
      );
      assert.equal(result, 1);
      assert.equal(calls.length, 1);
      assert.match(calls[0].args[0], /preparar o registro global/);
      assertSanitized(calls);
    } finally {
      require.cache[registrationPath] = previous;
    }
  });
}

function simulatedInteraction(options = {}) {
  const calls = [];
  const interaction = {
    user: { id: "controlled-user" },
    guildId: "controlled-guild",
    inGuild: () => true,
    createdTimestamp: Date.now(),
    deferred: false,
    replied: false,
    ephemeral: false,
    options: {
      getString: (name) => options[name],
      getNumber: (name) => options[name],
      getSubcommand: () => options.subcommand,
    },
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
      if (method === "deferReply") interaction.deferred = true;
      if (method === "reply" || method === "editReply")
        interaction.replied = true;
      if (method === "reply")
        interaction.ephemeral = Boolean(payload.flags & 64);
    };
  }
  return { interaction, calls };
}

for (const mode of ["throw", "reject", "pending"]) {
  test(`erro de interação responde e falha secundária é capturada com console ${mode}`, async (t) => {
    const { logger, calls: logs } = loggerFixture(mode);
    for (const level of ["log", "warn", "error"])
      t.mock.method(console, level, logger[level]);
    const request = simulatedInteraction();
    await withoutUnhandled(t, async () => {
      await completesWithoutWaiting(
        runWithErrorHandling(request.interaction, async () => {
          throw sensitiveError();
        }),
      );
      assert.equal(
        await completesWithoutWaiting(
          runSecondary(async () => {
            throw sensitiveError();
          }),
        ),
        false,
      );
    });
    assert.deepEqual(
      request.calls.map(({ method }) => method),
      ["reply"],
    );
    assert.equal(
      request.calls[0].payload.content,
      "Houve um erro ao executar esse comando!",
    );
    assertSanitized(logs);
  });

  test(`aviso de timer falho remove estado e não repete envio com console ${mode}`, async (t) => {
    const { logger, calls } = loggerFixture(mode);
    t.mock.method(console, "warn", logger.warn);
    let callback;
    let sends = 0;
    const manager = createTimerManager({
      setTimeout: (work) => {
        callback = work;
        return {};
      },
      clearTimeout: () => {},
    });
    manager.set("controlled", 1, async () => {
      sends++;
      throw sensitiveError();
    });
    await withoutUnhandled(t, async () => {
      assert.equal(await completesWithoutWaiting(callback()), true);
      assert.equal(await callback(), false);
    });
    assert.equal(manager.size, 0);
    assert.equal(sends, 1);
    assertSanitized(calls);
  });
}

test("erro HTTP e texto de tradução não entram no console", async (t) => {
  const { logger, calls: logs } = loggerFixture();
  for (const level of ["log", "warn", "error"])
    t.mock.method(console, level, logger[level]);
  const helperPath = require.resolve("../lib/http-client");
  const commandPath = require.resolve("../commands/translate");
  const previousHelper = require.cache[helperPath];
  const previousCommand = require.cache[commandPath];
  const original = require(helperPath);
  require.cache[helperPath] = {
    ...require.cache[helperPath],
    exports: {
      ...original,
      getJson: async () => {
        throw sensitiveError();
      },
    },
  };
  delete require.cache[commandPath];
  try {
    const request = simulatedInteraction({ idioma: "pt", texto: SENTINEL });
    await require(commandPath).execute(request.interaction);
    const result = request.calls.find(({ method }) => method === "followUp");
    assert.ok(result);
    assert.equal(result.payload.flags & 64, 64);
    assert.doesNotMatch(JSON.stringify(request.calls), /SENSITIVE_LOG/);
    assert.deepEqual(logs, []);
  } finally {
    if (previousHelper) require.cache[helperPath] = previousHelper;
    else delete require.cache[helperPath];
    if (previousCommand) require.cache[commandPath] = previousCommand;
    else delete require.cache[commandPath];
  }
});

test("conteúdo privado de todo permanece só na resposta efêmera, inclusive após falha", async (t) => {
  const { logger, calls: logs } = loggerFixture();
  for (const level of ["log", "warn", "error"])
    t.mock.method(console, level, logger[level]);
  const commandPath = require.resolve("../commands/todo");
  const previous = require.cache[commandPath];
  delete require.cache[commandPath];
  try {
    const command = require(commandPath);
    for (const subcommand of ["add", "list", "add"]) {
      const request = simulatedInteraction({ subcommand, tarefa: SENTINEL });
      await command.execute(request.interaction);
      assert.equal(request.calls[0].payload.flags & 64, 64);
      if (subcommand === "list")
        assert.match(JSON.stringify(request.calls[0].payload), /SENSITIVE_LOG/);
    }
    const failed = simulatedInteraction({ subcommand: "list" });
    failed.interaction.reply = async () => {
      throw sensitiveError();
    };
    await runWithErrorHandling(failed.interaction, () =>
      command.execute(failed.interaction),
    );
    assert.ok(logs.length > 0);
    assertSanitized(logs);
  } finally {
    if (previous) require.cache[commandPath] = previous;
    else delete require.cache[commandPath];
  }
});
