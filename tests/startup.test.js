const assert = require("node:assert/strict");
const dns = require("node:dns");
const dnsPromises = require("node:dns/promises");
const net = require("node:net");
const tls = require("node:tls");
const { Client, REST } = require("discord.js");
const { beforeEach, test } = require("node:test");
const { startBot } = require("../lib/startup");

const FAKE_TOKEN = "x".repeat(32);

beforeEach((t) => {
  const blockNetwork = () => {
    throw new Error(
      "Inicialização de teste permite somente dependências controladas.",
    );
  };
  t.mock.method(dns, "lookup", blockNetwork);
  t.mock.method(dnsPromises, "lookup", blockNetwork);
  t.mock.method(net.Socket.prototype, "connect", blockNetwork);
  t.mock.method(tls, "connect", blockNetwork);
  t.mock.method(globalThis, "fetch", blockNetwork);
  t.mock.method(Client.prototype, "login", blockNetwork);
  t.mock.method(REST.prototype, "put", blockNetwork);
  t.mock.method(process, "exit", () => {
    throw new Error(
      "Inicialização de teste deve usar somente processState falso.",
    );
  });
});

async function flush() {
  for (let index = 0; index < 60; index++) await Promise.resolve();
}

function controlledPromise() {
  let resolve;
  let reject;
  const promise = new Promise((accept, decline) => {
    resolve = accept;
    reject = decline;
  });
  return { promise, resolve, reject };
}

function fakeClock() {
  let now = 0;
  let nextId = 0;
  const tasks = new Map();
  const scheduled = [];
  const schedule = (callback, delay) => {
    const handle = {
      id: ++nextId,
      at: now + delay,
      delay,
      unrefCalled: false,
      unref() {
        this.unrefCalled = true;
        return this;
      },
    };
    tasks.set(handle.id, { handle, callback });
    scheduled.push(handle);
    return handle;
  };
  const cancel = (handle) => tasks.delete(handle?.id);
  return {
    schedule,
    cancel,
    scheduled,
    get pending() {
      return [...tasks.values()].map(({ handle }) => handle);
    },
    async advance(duration) {
      const target = now + duration;
      await flush();
      while (true) {
        const next = [...tasks.values()].sort(
          (a, b) => a.handle.at - b.handle.at || a.handle.id - b.handle.id,
        )[0];
        if (!next || next.handle.at > target) break;
        tasks.delete(next.handle.id);
        now = next.handle.at;
        next.callback();
        await flush();
      }
      now = target;
      await flush();
    },
  };
}

function fixture({
  env = { TOKEN: FAKE_TOKEN },
  failAt,
  login,
  cleanup,
  destroy,
  loginTimeoutMs,
  cleanupTimeoutMs,
  forceExitAfterMs,
} = {}) {
  const clock = fakeClock();
  const events = [];
  const logs = [];
  const catalog = { commands: new Map() };
  const processState = {
    exitCode: undefined,
    exitCalls: [],
    exit(code) {
      this.exitCalls.push(code);
    },
  };
  const fail = () => {
    throw Object.assign(new Error("SENSITIVE_SENTINEL"), {
      config: { auth: "SENSITIVE_SENTINEL" },
    });
  };
  const client = {
    login(token) {
      events.push("login");
      assert.equal(token, FAKE_TOKEN);
      if (failAt === "login") return fail();
      return login
        ? login(token)
        : Promise.resolve("SENSITIVE_SENTINEL_LOGIN_RESULT");
    },
    destroy() {
      events.push("destroy");
      if (failAt === "destroy") return fail();
      return destroy?.();
    },
  };
  const dependencies = {
    env,
    loadCatalog() {
      events.push("load");
      if (failAt === "load") return fail();
      return catalog;
    },
    createClient() {
      events.push("create");
      if (failAt === "create") return fail();
      return client;
    },
    setupClient(receivedClient, receivedCatalog) {
      events.push("setup");
      assert.equal(receivedClient, client);
      assert.equal(receivedCatalog, catalog);
      if (failAt === "setup") return fail();
      return () => {
        events.push("cleanup");
        if (failAt === "cleanup") return fail();
        return cleanup?.();
      };
    },
    logger: Object.fromEntries(
      ["error", "warn", "log", "info"].map((method) => [
        method,
        (...args) => logs.push({ method, args }),
      ]),
    ),
    processState,
    schedule: clock.schedule,
    cancel: clock.cancel,
    ...(loginTimeoutMs === undefined ? {} : { loginTimeoutMs }),
    ...(cleanupTimeoutMs === undefined ? {} : { cleanupTimeoutMs }),
    ...(forceExitAfterMs === undefined ? {} : { forceExitAfterMs }),
  };
  return {
    clock,
    events,
    logs,
    catalog,
    client,
    dependencies,
    processState,
    start: () => startBot(dependencies),
  };
}

function assertSafeLogs(logs) {
  assert.doesNotMatch(
    JSON.stringify(logs),
    /SENSITIVE_SENTINEL|xxxxxxxxxxxxxxxx/,
  );
  assert.ok(
    logs.every(({ args }) =>
      args.every(
        (value) => typeof value === "string" || typeof value === "number",
      ),
    ),
  );
}

test("configuração inválida falha antes de carregar catálogo ou construir Client", async (t) => {
  for (const env of [
    {},
    { TOKEN: "short" },
    { TOKEN: `${FAKE_TOKEN} residual-whitespace` },
  ]) {
    await t.test(
      Object.keys(env).length ? "TOKEN inválido" : "TOKEN ausente",
      async () => {
        const setup = fixture({ env });
        assert.deepEqual(await setup.start(), { ok: false });
        assert.deepEqual(setup.events, []);
        assert.equal(setup.processState.exitCode, 1);
        assertSafeLogs(setup.logs);
      },
    );
  }
});

test("carregador de ambiente termina antes de validar configuração e carregar catálogo", async () => {
  const env = {};
  const setup = fixture({ env });
  setup.dependencies.loadEnvironment = async () => {
    setup.events.push("environment");
    env.TOKEN = FAKE_TOKEN;
  };
  assert.deepEqual(await setup.start(), { ok: true, client: setup.client });
  assert.deepEqual(setup.events, [
    "environment",
    "load",
    "create",
    "setup",
    "login",
  ]);
  assertSafeLogs(setup.logs);
});

test("falha no carregamento de ambiente é sanitizada antes de catálogo e login", async () => {
  const setup = fixture();
  setup.dependencies.loadEnvironment = () => {
    setup.events.push("environment");
    throw new Error("SENSITIVE_SENTINEL_ENVIRONMENT_ERROR");
  };
  assert.deepEqual(await setup.start(), { ok: false });
  assert.deepEqual(setup.events, ["environment"]);
  assert.equal(setup.processState.exitCode, 1);
  assertSafeLogs(setup.logs);
});

test("catálogo e handlers são preparados antes de login e resultado não expõe credencial", async () => {
  const setup = fixture();
  assert.deepEqual(await setup.start(), { ok: true, client: setup.client });
  assert.deepEqual(setup.events, ["load", "create", "setup", "login"]);
  assert.equal(setup.processState.exitCode, undefined);
  assert.deepEqual(setup.processState.exitCalls, []);
  assert.equal(setup.clock.pending.length, 0);
  assertSafeLogs(setup.logs);
});

test("falhas de catálogo, construção e setup impedem estágios posteriores", async (t) => {
  for (const [failAt, expected] of [
    ["load", ["load"]],
    ["create", ["load", "create"]],
    ["setup", ["load", "create", "setup", "destroy"]],
  ]) {
    await t.test(failAt, async () => {
      const setup = fixture({ failAt });
      assert.deepEqual(await setup.start(), { ok: false });
      assert.deepEqual(setup.events, expected);
      assert.equal(setup.processState.exitCode, 1);
      assertSafeLogs(setup.logs);
    });
  }
});

test("login que lança síncronamente é tratado com cleanup e destroy", async () => {
  const setup = fixture({ failAt: "login" });
  assert.deepEqual(await setup.start(), { ok: false });
  assert.deepEqual(setup.events, [
    "load",
    "create",
    "setup",
    "login",
    "cleanup",
    "destroy",
  ]);
  assert.equal(setup.processState.exitCode, 1);
  assertSafeLogs(setup.logs);
});

test("rejeição de login não retorna erro bruto e faz limpeza antes de concluir", async () => {
  const setup = fixture({
    login: async () => {
      throw new Error("SENSITIVE_SENTINEL_LOGIN_ERROR");
    },
  });
  assert.deepEqual(await setup.start(), { ok: false });
  assert.deepEqual(setup.events, [
    "load",
    "create",
    "setup",
    "login",
    "cleanup",
    "destroy",
  ]);
  assert.equal(setup.processState.exitCode, 1);
  assertSafeLogs(setup.logs);
});

test("login pendente tem prazo de 30 segundos sem iniciar execução real", async () => {
  const setup = fixture({ login: () => new Promise(() => {}) });
  const started = setup.start();
  await flush();
  assert.deepEqual(setup.events, ["load", "create", "setup", "login"]);
  await setup.clock.advance(29999);
  assert.equal(setup.events.includes("destroy"), false);
  await setup.clock.advance(1);
  assert.deepEqual(await started, { ok: false });
  assert.deepEqual(setup.events.slice(-2), ["cleanup", "destroy"]);
  assert.equal(setup.processState.exitCode, 1);
  assertSafeLogs(setup.logs);
});

test("rejeição tardia de login após timeout não fica solta", async (t) => {
  const pending = controlledPromise();
  const setup = fixture({ login: () => pending.promise });
  const unhandled = [];
  const onUnhandled = (error) => unhandled.push(error);
  process.on("unhandledRejection", onUnhandled);
  t.after(() => process.off("unhandledRejection", onUnhandled));
  const started = setup.start();
  await flush();
  await setup.clock.advance(30000);
  assert.deepEqual(await started, { ok: false });
  pending.reject(new Error("SENSITIVE_SENTINEL_LATE_LOGIN_ERROR"));
  await flush();
  assert.equal(unhandled.length, 0);
  assert.equal(setup.events.filter((event) => event === "destroy").length, 1);
  assertSafeLogs(setup.logs);
});

test("falha de login prepara saída forçada após 5 segundos sem prender event loop", async () => {
  const setup = fixture({ failAt: "login" });
  assert.deepEqual(await setup.start(), { ok: false });
  assert.deepEqual(setup.processState.exitCalls, []);
  const forced = setup.clock.pending.find((handle) => handle.delay === 5000);
  assert.ok(forced);
  assert.equal(forced.unrefCalled, true);
  await setup.clock.advance(4999);
  assert.deepEqual(setup.processState.exitCalls, []);
  await setup.clock.advance(1);
  assert.deepEqual(setup.processState.exitCalls, [1]);
});

test("cleanup que lança ou rejeita não impede tentativa de destruir Client", async (t) => {
  for (const mode of ["throw", "reject"]) {
    await t.test(mode, async () => {
      const setup = fixture({
        login: async () => {
          throw new Error("SENSITIVE_SENTINEL_LOGIN_ERROR");
        },
        cleanup: () => {
          if (mode === "throw")
            throw new Error("SENSITIVE_SENTINEL_CLEANUP_ERROR");
          return Promise.reject(new Error("SENSITIVE_SENTINEL_CLEANUP_ERROR"));
        },
      });
      assert.deepEqual(await setup.start(), { ok: false });
      assert.deepEqual(setup.events.slice(-2), ["cleanup", "destroy"]);
      assert.equal(setup.processState.exitCode, 1);
      assertSafeLogs(setup.logs);
    });
  }
});

test("destroy que lança ou rejeita permanece capturado e mantém saída de erro", async (t) => {
  for (const mode of ["throw", "reject"]) {
    await t.test(mode, async () => {
      const setup = fixture({
        login: async () => {
          throw new Error("SENSITIVE_SENTINEL_LOGIN_ERROR");
        },
        destroy: () => {
          if (mode === "throw")
            throw new Error("SENSITIVE_SENTINEL_DESTROY_ERROR");
          return Promise.reject(new Error("SENSITIVE_SENTINEL_DESTROY_ERROR"));
        },
      });
      assert.deepEqual(await setup.start(), { ok: false });
      assert.deepEqual(setup.events.slice(-2), ["cleanup", "destroy"]);
      assert.equal(setup.processState.exitCode, 1);
      assertSafeLogs(setup.logs);
    });
  }
});

test("cleanup e destroy pendentes compartilham limite total de 2 segundos", async () => {
  const setup = fixture({
    login: async () => {
      throw new Error("SENSITIVE_SENTINEL_LOGIN_ERROR");
    },
    cleanup: () => new Promise(() => {}),
    destroy: () => new Promise(() => {}),
  });
  const started = setup.start();
  await flush();
  assert.deepEqual(setup.events.slice(-2), ["cleanup", "destroy"]);
  await setup.clock.advance(1999);
  let settled = false;
  started.then(() => {
    settled = true;
  });
  await flush();
  assert.equal(settled, false);
  await setup.clock.advance(1);
  assert.deepEqual(await started, { ok: false });
  assert.equal(setup.processState.exitCode, 1);
  assertSafeLogs(setup.logs);
  await setup.clock.advance(3000);
  assert.deepEqual(setup.processState.exitCalls, [1]);
});

test("rejeição tardia do cleanup depois do prazo também permanece capturada", async (t) => {
  const cleanup = controlledPromise();
  const setup = fixture({
    failAt: "login",
    cleanup: () => cleanup.promise,
  });
  const unhandled = [];
  const onUnhandled = (error) => unhandled.push(error);
  process.on("unhandledRejection", onUnhandled);
  t.after(() => process.off("unhandledRejection", onUnhandled));
  const started = setup.start();
  await flush();
  await setup.clock.advance(2000);
  assert.deepEqual(await started, { ok: false });
  cleanup.reject(new Error("SENSITIVE_SENTINEL_LATE_CLEANUP_ERROR"));
  await flush();
  assert.equal(unhandled.length, 0);
  assert.equal(setup.events.filter((event) => event === "destroy").length, 1);
  assertSafeLogs(setup.logs);
});

test("sucesso de login tardio após timeout não reinicia nem altera resultado de falha", async () => {
  const pending = controlledPromise();
  const setup = fixture({ login: () => pending.promise });
  const started = setup.start();
  await flush();
  await setup.clock.advance(30000);
  assert.deepEqual(await started, { ok: false });
  pending.resolve("SENSITIVE_SENTINEL_LATE_SUCCESS");
  await flush();
  assert.deepEqual(setup.events, [
    "load",
    "create",
    "setup",
    "login",
    "cleanup",
    "destroy",
  ]);
  assert.equal(setup.processState.exitCode, 1);
  assertSafeLogs(setup.logs);
});
