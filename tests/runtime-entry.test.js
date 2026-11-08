const assert = require("node:assert/strict");
const dns = require("node:dns");
const dnsPromises = require("node:dns/promises");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const Module = require("node:module");
const net = require("node:net");
const path = require("node:path");
const tls = require("node:tls");
const { beforeEach, test } = require("node:test");
const { Client, Collection, Events, REST } = require("discord.js");
const dotenv = require("dotenv");

const FAKE_TOKEN = "x".repeat(32);

beforeEach((t) => {
  const blockExternal = () => {
    throw new Error(
      "A entrada de runtime deve usar somente dependências controladas.",
    );
  };
  t.mock.method(dns, "lookup", blockExternal);
  t.mock.method(dnsPromises, "lookup", blockExternal);
  t.mock.method(net.Socket.prototype, "connect", blockExternal);
  t.mock.method(tls, "connect", blockExternal);
  t.mock.method(globalThis, "fetch", blockExternal);
  t.mock.method(Client.prototype, "login", blockExternal);
  t.mock.method(REST.prototype, "put", blockExternal);
  t.mock.method(dotenv, "config", blockExternal);
  t.mock.method(process, "exit", blockExternal);
  const readFileSync = fs.readFileSync;
  t.mock.method(fs, "readFileSync", function (filename, ...args) {
    if (path.basename(String(filename)) === ".env") blockExternal();
    return readFileSync.call(this, filename, ...args);
  });
  t.mock.method(console, "log", () => {});
  t.mock.method(console, "error", () => {});
  t.mock.method(console, "warn", () => {});
});

async function flush() {
  for (let index = 0; index < 60; index++) await Promise.resolve();
}

function simulatedTimers(t) {
  let nextId = 0;
  const active = new Map();
  const cleared = [];
  const create = (type, callback, delay) => {
    const handle = {
      id: ++nextId,
      type,
      callback,
      delay,
      unref() {
        return this;
      },
    };
    active.set(handle.id, handle);
    return handle;
  };
  const clear = (handle) => {
    if (handle) cleared.push(handle);
    active.delete(handle?.id);
  };
  const schedule = (callback, delay) => create("timeout", callback, delay);
  t.mock.method(globalThis, "setTimeout", schedule);
  t.mock.method(globalThis, "clearTimeout", clear);
  t.mock.method(globalThis, "setInterval", (callback, delay) =>
    create("interval", callback, delay),
  );
  t.mock.method(globalThis, "clearInterval", clear);
  return {
    active,
    cleared,
    schedule,
    cancel: clear,
    async fire(handle) {
      if (handle.type === "timeout") active.delete(handle.id);
      await handle.callback();
      await flush();
    },
  };
}

function fakeClient() {
  const client = new EventEmitter();
  client.user = { tag: "controlled#0001", setActivity: async () => {} };
  client.guilds = { cache: new Collection() };
  return client;
}

function catalog(command) {
  return { commands: command ? [command] : [] };
}

function interaction({
  commandName = "controlled",
  userId = "controlled-user",
  select,
  customId = "codebucket:docs:select",
  failReply = false,
} = {}) {
  const calls = [];
  const value = {
    commandName,
    customId,
    user: { id: userId },
    values: select === undefined ? [] : [select],
    createdTimestamp: Date.now(),
    deferred: false,
    replied: false,
    ephemeral: false,
    isStringSelectMenu: () => select !== undefined,
    isCommand: () => select === undefined,
  };
  for (const method of ["reply", "editReply", "followUp", "deleteReply"]) {
    value[method] = async (payload) => {
      calls.push({ method, payload });
      if (method === "reply" && failReply)
        throw new Error("SENSITIVE_SENTINEL_REPLY");
      if (method === "reply" || method === "editReply") value.replied = true;
      if (method === "reply") value.ephemeral = Boolean(payload?.flags & 64);
      return { id: "controlled-message" };
    };
  }
  return { value, calls };
}

function contentOf(payload) {
  return typeof payload === "string" ? payload : payload?.content;
}

async function dispatch(client, value) {
  const listeners = client.listeners(Events.InteractionCreate);
  assert.equal(listeners.length, 1);
  await listeners[0](value);
}

test("importar index é seguro e não carrega SDK, catálogo, dotenv ou handlers lazily", (t) => {
  const load = Module._load;
  const forbidden = new Set([
    "discord.js",
    "dotenv",
    "./lib/command-catalog",
    "./lib/interactions",
    "./lib/documentation-catalog",
    "./lib/documentation-interactions",
  ]);
  t.mock.method(Module, "_load", function (request, parent, isMain) {
    assert.equal(
      forbidden.has(request),
      false,
      `import inesperado: ${request}`,
    );
    return load.call(this, request, parent, isMain);
  });
  const runtime = require("../index");
  assert.equal(typeof runtime.main, "function");
  assert.equal(typeof runtime.configureClient, "function");
});

test("main usa DI integral e instala handlers antes do login controlado", async (t) => {
  const timers = simulatedTimers(t);
  const { main, configureClient } = require("../index");
  const client = fakeClient();
  const calls = [];
  const commands = catalog({
    data: { name: "controlled" },
    execute: async () => {},
  });
  const processState = {
    exitCode: undefined,
    exit() {
      assert.fail("saída em caminho de sucesso");
    },
  };
  let cleanup;
  client.login = async (token) => {
    calls.push("login");
    assert.equal(token, FAKE_TOKEN);
    assert.equal(client.listenerCount(Events.InteractionCreate), 1);
    assert.equal(client.listenerCount(Events.Error), 1);
    assert.equal(client.listenerCount("ready"), 1);
    assert.equal(client.commands.get("controlled"), commands.commands[0]);
    return "SENSITIVE_SENTINEL_LOGIN_RESULT";
  };
  const result = await main({
    env: { TOKEN: FAKE_TOKEN },
    loadEnvironment: () => {
      calls.push("environment");
    },
    loadCatalog: () => {
      calls.push("catalog");
      return commands;
    },
    createClient: () => {
      calls.push("client");
      return client;
    },
    setupClient: (receivedClient, receivedCatalog) => {
      calls.push("setup");
      cleanup = configureClient(receivedClient, receivedCatalog);
      return cleanup;
    },
    processState,
    schedule: timers.schedule,
    cancel: timers.cancel,
    logger: {
      error() {
        assert.fail("erro em caminho de sucesso");
      },
    },
  });
  assert.deepEqual(result, { ok: true, client });
  assert.deepEqual(calls, [
    "environment",
    "catalog",
    "client",
    "setup",
    "login",
  ]);
  assert.equal(processState.exitCode, undefined);
  assert.equal(timers.active.size, 0);
  cleanup();
  assert.deepEqual(client.eventNames(), [Events.Error]);
});

test("ready e cooldowns usam handles rastreados e cleanup remove timers e listeners", async (t) => {
  const timers = simulatedTimers(t);
  const { configureClient } = require("../index");
  const client = fakeClient();
  let executions = 0;
  const cleanup = configureClient(
    client,
    catalog({
      data: { name: "controlled" },
      execute: async (request) => {
        executions++;
        await request.reply({ content: "controlled result" });
      },
    }),
  );
  client.emit("ready");
  const interval = [...timers.active.values()].find(
    (handle) => handle.type === "interval",
  );
  assert.ok(interval);
  assert.equal(interval.delay, 100000);
  const first = interaction();
  await dispatch(client, first.value);
  const cooldown = [...timers.active.values()].find(
    (handle) => handle.type === "timeout",
  );
  assert.ok(cooldown);
  assert.equal(cooldown.delay, 5000);
  const second = interaction();
  await dispatch(client, second.value);
  assert.equal(executions, 1);
  assert.equal(second.calls.length, 1);
  assert.equal(second.calls[0].payload.flags & 64, 64);
  assert.match(contentOf(second.calls[0].payload), /espere/);
  await timers.fire(cooldown);
  const third = interaction();
  await dispatch(client, third.value);
  assert.equal(executions, 2);
  const remainingCooldown = [...timers.active.values()].find(
    (handle) => handle.type === "timeout",
  );
  cleanup();
  assert.equal(timers.active.size, 0);
  assert.ok(timers.cleared.includes(interval));
  assert.ok(timers.cleared.includes(remainingCooldown));
  assert.deepEqual(client.eventNames(), [Events.Error]);
});

test("cleanup idempotente mantém só listener de erro sanitizado para eventos tardios", async (t) => {
  const timers = simulatedTimers(t);
  const printed = [];
  t.mock.method(console, "error", (...args) => printed.push(...args));
  const { configureClient } = require("../index");
  const client = fakeClient();
  const cleanup = configureClient(
    client,
    catalog({
      data: { name: "controlled" },
      execute: async (request) =>
        request.reply({ content: "controlled result" }),
    }),
  );
  client.emit("ready");
  await dispatch(client, interaction().value);
  assert.equal(timers.active.size, 2);
  cleanup();
  cleanup();
  assert.equal(timers.active.size, 0);
  assert.deepEqual(client.eventNames(), [Events.Error]);
  assert.equal(client.listenerCount(Events.Error), 1);
  for (const event of ["ready", "guildCreate", Events.InteractionCreate]) {
    assert.equal(client.listenerCount(event), 0);
  }
  assert.doesNotThrow(() => {
    client.emit(Events.Error, new Error("SENSITIVE_SENTINEL_LATE_TRANSPORT"));
  });
  assert.deepEqual(printed, ["Erro de conexão com o Discord."]);
  assert.doesNotMatch(JSON.stringify(printed), /SENSITIVE_SENTINEL/);
  assert.equal(timers.active.size, 0);
});

test("evento de erro e rejeição de setActivity são capturados sem dados brutos", async (t) => {
  const timers = simulatedTimers(t);
  const printed = [];
  t.mock.method(console, "error", (...args) => printed.push(...args));
  t.mock.method(console, "warn", (...args) => printed.push(...args));
  const { configureClient } = require("../index");
  const client = fakeClient();
  client.user.setActivity = async () => {
    throw new Error("SENSITIVE_SENTINEL_ACTIVITY");
  };
  const cleanup = configureClient(client, catalog());
  const unhandled = [];
  const onUnhandled = (error) => unhandled.push(error);
  process.on("unhandledRejection", onUnhandled);
  t.after(() => process.off("unhandledRejection", onUnhandled));
  client.emit(Events.Error, new Error("SENSITIVE_SENTINEL_DISCORD_ERROR"));
  client.emit("ready");
  const interval = [...timers.active.values()].find(
    (handle) => handle.type === "interval",
  );
  await timers.fire(interval);
  assert.deepEqual(printed, [
    "Erro de conexão com o Discord.",
    "Falha em operação secundária da interação.",
  ]);
  assert.doesNotMatch(JSON.stringify(printed), /SENSITIVE_SENTINEL/);
  assert.equal(unhandled.length, 0);
  cleanup();
});

test("seleção de docs preserva resposta pública e fallback para opção desconhecida", async (t) => {
  simulatedTimers(t);
  const { configureClient } = require("../index");
  const client = fakeClient();
  const cleanup = configureClient(client, catalog());
  for (const [selected, expected] of [
    ["javascript", /Documentação do Javascript/],
    ["unknown", /Opção não reconhecida/],
  ]) {
    const request = interaction({ select: selected });
    await dispatch(client, request.value);
    assert.equal(request.calls.length, 1);
    assert.equal(request.calls[0].method, "reply");
    assert.match(contentOf(request.calls[0].payload), expected);
    assert.equal(Boolean(request.calls[0].payload.flags & 64), false);
  }
  cleanup();
});

test("roteamento ignora selects alheios e antigos sem tratar como slash", async (t) => {
  const timers = simulatedTimers(t);
  const { configureClient } = require("../index");
  const client = fakeClient();
  const cleanup = configureClient(client, catalog());
  t.after(cleanup);
  for (const customId of [
    "select",
    "other:select",
    "codebucket:docs:select:extra",
    undefined,
  ]) {
    const request = interaction({ select: "javascript" });
    request.value.customId = customId;
    request.value.isCommand = () => {
      assert.fail("select de outro componente não é comando slash");
    };
    Object.defineProperty(request.value, "values", {
      get() {
        assert.fail("não deve ler valores de outro componente");
      },
    });
    await dispatch(client, request.value);
    assert.deepEqual(request.calls, []);
  }
  assert.equal(timers.active.size, 0);
});

test("roteamento de docs valida values e preserva o wrapper central de erros", async (t) => {
  const timers = simulatedTimers(t);
  const logs = [];
  t.mock.method(console, "error", (...args) => logs.push(args));
  const { configureClient } = require("../index");
  const client = fakeClient();
  const cleanup = configureClient(client, catalog());
  t.after(cleanup);
  for (const values of [
    undefined,
    [],
    ["javascript", "python"],
    ["constructor"],
  ]) {
    const request = interaction({ select: "javascript" });
    request.value.values = values;
    await dispatch(client, request.value);
    assert.deepEqual(
      request.calls.map(({ method }) => method),
      ["reply"],
    );
    assert.equal(contentOf(request.calls[0].payload), "Opção não reconhecida.");
  }
  const failing = interaction({ select: "javascript", failReply: true });
  await assert.doesNotReject(dispatch(client, failing.value));
  assert.deepEqual(
    failing.calls.map(({ method }) => method),
    ["reply"],
  );
  assert.doesNotMatch(JSON.stringify(logs), /SENSITIVE_SENTINEL/);
  const expired = interaction({ select: "javascript" });
  expired.value.createdTimestamp = Date.now() - 3000;
  await assert.doesNotReject(dispatch(client, expired.value));
  assert.deepEqual(expired.calls, []);
  assert.equal(timers.active.size, 0);
});

test("comando que lança erro recebe resposta genérica sem detalhe interno", async (t) => {
  simulatedTimers(t);
  const { configureClient } = require("../index");
  const client = fakeClient();
  const cleanup = configureClient(
    client,
    catalog({
      data: { name: "controlled" },
      execute: async () => {
        throw new Error("SENSITIVE_SENTINEL_COMMAND");
      },
    }),
  );
  const request = interaction();
  await dispatch(client, request.value);
  assert.equal(request.calls.length, 1);
  assert.equal(request.calls[0].method, "reply");
  assert.equal(
    contentOf(request.calls[0].payload),
    "Houve um erro ao executar esse comando!",
  );
  assert.doesNotMatch(JSON.stringify(request.calls), /SENSITIVE_SENTINEL/);
  cleanup();
});

test("erro após resposta usa followUp sem duplicar reply inicial", async (t) => {
  simulatedTimers(t);
  const { configureClient } = require("../index");
  const client = fakeClient();
  const cleanup = configureClient(
    client,
    catalog({
      data: { name: "controlled" },
      execute: async (request) => {
        await request.reply({ content: "first result" });
        throw new Error("SENSITIVE_SENTINEL_AFTER_REPLY");
      },
    }),
  );
  const request = interaction();
  await dispatch(client, request.value);
  assert.deepEqual(
    request.calls.map((call) => call.method),
    ["reply", "followUp"],
  );
  assert.equal(
    contentOf(request.calls[1].payload),
    "Houve um erro ao executar esse comando!",
  );
  cleanup();
});

test("falha ao enviar erro central não tenta reply ou followUp novamente", async (t) => {
  simulatedTimers(t);
  const { configureClient } = require("../index");
  const client = fakeClient();
  const cleanup = configureClient(
    client,
    catalog({
      data: { name: "controlled" },
      execute: async () => {
        throw new Error("SENSITIVE_SENTINEL_COMMAND");
      },
    }),
  );
  const request = interaction({ failReply: true });
  await dispatch(client, request.value);
  assert.deepEqual(
    request.calls.map((call) => call.method),
    ["reply"],
  );
  cleanup();
});
