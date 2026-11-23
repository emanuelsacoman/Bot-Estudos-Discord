const assert = require("node:assert/strict");
const http = require("node:http");
const https = require("node:https");
const net = require("node:net");
const test = require("node:test");
const tls = require("node:tls");
const dotenv = require("dotenv");
const {
  prepareRegistration,
  sendRegistration,
  runRegistration,
  RegistrationError,
  CONFIRM_ARGUMENT,
  REST_TIMEOUT_MS,
} = require("../lib/registration");
const { CommandCatalogError } = require("../lib/command-catalog");

// Deliberately synthetic, opaque test string; never loaded from credentials.
const TEST_ENV = {
  TOKEN: "opaque-unit-test-value-without-credentials",
  CLIENT_ID: "123456789012345678",
};
const payloadFor = () => [
  { options: [], name: "exemplo", description: "Comando de teste", type: 1 },
];
const catalog = () => ({ payload: payloadFor() });

function guardNetwork(t) {
  const refuse = () => {
    throw new Error("Rede real proibida no teste de registro");
  };
  for (const transport of [http, https]) {
    t.mock.method(transport, "request", refuse);
    t.mock.method(transport, "get", refuse);
  }
  t.mock.method(net.Socket.prototype, "connect", refuse);
  t.mock.method(tls, "connect", refuse);
  t.mock.method(globalThis, "fetch", refuse);
  t.mock.method(dotenv, "config", () => {
    throw new Error("Leitura real de ambiente proibida no teste");
  });
}

function loggerFor() {
  const logs = [];
  return {
    logs,
    log: (...args) => logs.push(args),
    error: (...args) => logs.push(args),
  };
}

function restFactory({ failure, cleanupFails = false } = {}) {
  const calls = [];
  return {
    calls,
    createRest(options) {
      calls.push({ method: "createRest", options });
      if (failure === "createRest")
        throw new Error("sentinela-privada-rest-constructor");
      return {
        setToken(token) {
          calls.push({ method: "setToken", token });
          if (failure === "setToken")
            throw new Error("sentinela-privada-token");
          return this;
        },
        async put(route, options) {
          calls.push({ method: "put", route, options });
          if (failure === "put") {
            const error = new Error("sentinela-privada-rest");
            error.url = "sentinela-privada-url";
            error.requestBody = { token: "sentinela-privada-corpo" };
            throw error;
          }
          return [];
        },
        clearHashSweeper() {
          calls.push({ method: "clearHashSweeper" });
          if (cleanupFails) throw new Error("sentinela-privada-cleanup");
        },
        clearHandlerSweeper() {
          calls.push({ method: "clearHandlerSweeper" });
        },
        agent: {
          async destroy() {
            calls.push({ method: "destroyAgent" });
            if (cleanupFails) throw new Error("sentinela-privada-agent");
          },
        },
      };
    },
  };
}

test("preparação valida configuração antes de carregar o catálogo", () => {
  let loads = 0;
  assert.throws(
    () =>
      prepareRegistration({
        env: {},
        loadCatalog: () => {
          loads += 1;
        },
      }),
    (error) => error.code === "TOKEN_REQUIRED",
  );
  assert.equal(loads, 0);
});

test("preparação retorna configuração e snapshot sem enviar REST", () => {
  const original = payloadFor();
  const prepared = prepareRegistration({
    env: TEST_ENV,
    loadCatalog: () => ({ payload: original }),
  });
  assert.equal(prepared.config.token, TEST_ENV.TOKEN);
  assert.equal(prepared.config.clientId, TEST_ENV.CLIENT_ID);
  assert.deepEqual(prepared.payload, original);
  original[0].name = "alterado";
  assert.equal(prepared.payload[0].name, "exemplo");
  assert.ok(Object.isFrozen(prepared.payload));
});

for (const confirmed of [undefined, false, "true", 1, [], {}]) {
  test(`envio recusa confirmação não booleana estrita: ${String(confirmed)}`, async () => {
    let created = 0;
    await assert.rejects(
      sendRegistration({
        confirmed,
        createRest: () => {
          created += 1;
        },
      }),
      (error) =>
        error instanceof RegistrationError &&
        error.code === "REGISTRATION_NOT_CONFIRMED",
    );
    assert.equal(created, 0);
  });
}

test("envio revalida configuração antes de construir REST", async () => {
  let created = 0;
  await assert.rejects(
    sendRegistration({
      confirmed: true,
      config: {},
      payload: payloadFor(),
      createRest: () => {
        created += 1;
      },
    }),
    (error) => error.code === "TOKEN_REQUIRED",
  );
  assert.equal(created, 0);
});

for (const [name, payload] of [
  ["vazio", []],
  ["inválido", [{ name: "exemplo" }]],
  ["duplicado", [...payloadFor(), ...payloadFor()]],
]) {
  test(`envio revalida payload ${name} antes de construir REST`, async () => {
    let created = 0;
    await assert.rejects(
      sendRegistration({
        confirmed: true,
        config: { token: TEST_ENV.TOKEN, clientId: TEST_ENV.CLIENT_ID },
        payload,
        createRest: () => {
          created += 1;
        },
      }),
      CommandCatalogError,
    );
    assert.equal(created, 0);
  });
}

test("envio confirmado usa PUT global único, prazo, zero retries e limpa REST", async (t) => {
  guardNetwork(t);
  const fake = restFactory();
  const result = await sendRegistration({
    ...prepareRegistration({ env: TEST_ENV, loadCatalog: catalog }),
    confirmed: true,
    createRest: fake.createRest,
  });
  assert.deepEqual(result, { count: 1 });
  const creation = fake.calls.find((call) => call.method === "createRest");
  assert.equal(creation.options.version, "10");
  assert.equal(creation.options.timeout, 15000);
  assert.equal(creation.options.retries, 0);
  assert.equal(creation.options.rejectOnRateLimit(), true);
  assert.equal(REST_TIMEOUT_MS, 15000);
  const sends = fake.calls.filter((call) => call.method === "put");
  assert.equal(sends.length, 1);
  assert.equal(sends[0].route, `/applications/${TEST_ENV.CLIENT_ID}/commands`);
  assert.deepEqual(sends[0].options.body, payloadFor());
  assert.ok(sends[0].options.signal instanceof AbortSignal);
  assert.equal(sends[0].options.signal.aborted, false);
  for (const method of [
    "clearHashSweeper",
    "clearHandlerSweeper",
    "destroyAgent",
  ]) {
    assert.equal(fake.calls.filter((call) => call.method === method).length, 1);
  }
  assert.equal(
    fake.calls.filter((call) => call.method === "setToken").at(-1).token,
    null,
  );
});

for (const stage of ["createRest", "setToken", "put"]) {
  test(`falha REST em ${stage} é sanitizada sem retry`, async (t) => {
    guardNetwork(t);
    const fake = restFactory({ failure: stage });
    await assert.rejects(
      sendRegistration({
        ...prepareRegistration({ env: TEST_ENV, loadCatalog: catalog }),
        confirmed: true,
        createRest: fake.createRest,
      }),
      (error) => {
        assert.ok(error instanceof RegistrationError);
        assert.equal(error.code, "REGISTRATION_SEND_FAILED");
        assert.equal(error.cause, undefined);
        assert.equal(error.url, undefined);
        assert.equal(error.requestBody, undefined);
        assert.doesNotMatch(error.message, /sentinela-privada/);
        return true;
      },
    );
    assert.ok(fake.calls.filter((call) => call.method === "put").length <= 1);
    if (stage !== "createRest")
      assert.ok(
        fake.calls.some((call) => call.method === "clearHandlerSweeper"),
      );
  });
}

test("falhas de limpeza não causam rejeição solta nem repetem PUT aceito", async (t) => {
  guardNetwork(t);
  const fake = restFactory({ cleanupFails: true });
  await assert.doesNotReject(
    sendRegistration({
      ...prepareRegistration({ env: TEST_ENV, loadCatalog: catalog }),
      confirmed: true,
      createRest: fake.createRest,
    }),
  );
  assert.equal(fake.calls.filter((call) => call.method === "put").length, 1);
  assert.ok(fake.calls.some((call) => call.method === "clearHandlerSweeper"));
});

for (const argv of [
  [],
  ["--unknown"],
  [`${CONFIRM_ARGUMENT}=false`],
  ["--dry-run", CONFIRM_ARGUMENT],
  [CONFIRM_ARGUMENT, "--dry-run"],
  [CONFIRM_ARGUMENT, CONFIRM_ARGUMENT],
  [" --dry-run"],
  null,
  "--dry-run",
]) {
  test(`CLI bloqueia argumentos ambíguos ou sem confirmação: ${JSON.stringify(argv)}`, async (t) => {
    guardNetwork(t);
    const logger = loggerFor();
    let operations = 0;
    const forbidden = () => {
      operations += 1;
      throw new Error("sentinela-privada-operação");
    };
    assert.equal(
      await runRegistration({
        argv,
        env: {},
        loadEnvironment: forbidden,
        loadCatalog: forbidden,
        createRest: forbidden,
        logger,
      }),
      1,
    );
    assert.equal(operations, 0);
    assert.doesNotMatch(JSON.stringify(logger.logs), /sentinela-privada/);
  });
}

test("dry-run valida somente catálogo sem ambiente, credenciais ou REST", async (t) => {
  guardNetwork(t);
  const logger = loggerFor();
  const env = new Proxy(
    {},
    {
      get() {
        throw new Error("Configuração não deve ser lida no dry-run");
      },
    },
  );
  let loads = 0;
  const forbidden = () => {
    throw new Error("Operação não permitida no dry-run");
  };
  const code = await runRegistration({
    argv: ["--dry-run"],
    env,
    loadEnvironment: forbidden,
    loadCatalog: () => {
      loads += 1;
      return catalog();
    },
    createRest: forbidden,
    logger,
  });
  assert.equal(code, 0);
  assert.equal(loads, 1);
  assert.match(JSON.stringify(logger.logs), /validado offline/);
});

test("dry-run inválido falha sem ler ambiente nem criar REST", async (t) => {
  guardNetwork(t);
  const logger = loggerFor();
  const forbidden = () => {
    throw new Error("Operação não permitida no dry-run");
  };
  assert.equal(
    await runRegistration({
      argv: ["--dry-run"],
      loadEnvironment: forbidden,
      loadCatalog: () => ({ payload: [] }),
      createRest: forbidden,
      logger,
    }),
    1,
  );
  assert.match(JSON.stringify(logger.logs), /catálogo/);
});

for (const [name, env] of [
  ["TOKEN ausente", {}],
  ["TOKEN inválido", { TOKEN: "curto" }],
  ["CLIENT_ID ausente", { TOKEN: TEST_ENV.TOKEN }],
  ["CLIENT_ID inválido", { ...TEST_ENV, CLIENT_ID: "inválido" }],
]) {
  test(`CLI confirmado falha por ${name} antes de carregar catálogo ou REST`, async (t) => {
    guardNetwork(t);
    const logger = loggerFor();
    let loadedEnv = 0;
    let laterOperations = 0;
    const forbidden = () => {
      laterOperations += 1;
      throw new Error("sentinela-privada");
    };
    assert.equal(
      await runRegistration({
        argv: [CONFIRM_ARGUMENT],
        env,
        loadEnvironment: () => {
          loadedEnv += 1;
        },
        loadCatalog: forbidden,
        createRest: forbidden,
        logger,
      }),
      1,
    );
    assert.equal(loadedEnv, 1);
    assert.equal(laterOperations, 0);
    assert.doesNotMatch(
      JSON.stringify(logger.logs),
      /sentinela-privada|opaque-unit-test/,
    );
  });
}

test("CLI confirmado captura erro de ambiente sem expor detalhe bruto", async (t) => {
  guardNetwork(t);
  const logger = loggerFor();
  assert.equal(
    await runRegistration({
      argv: [CONFIRM_ARGUMENT],
      env: TEST_ENV,
      loadEnvironment: () => {
        throw new Error("sentinela-privada-ambiente");
      },
      logger,
    }),
    1,
  );
  assert.doesNotMatch(JSON.stringify(logger.logs), /sentinela-privada/);
});

test("CLI confirmado captura falha de catálogo sem construir REST", async (t) => {
  guardNetwork(t);
  const logger = loggerFor();
  let created = 0;
  assert.equal(
    await runRegistration({
      argv: [CONFIRM_ARGUMENT],
      env: TEST_ENV,
      loadEnvironment: () => {},
      loadCatalog: () => {
        throw new Error("sentinela-privada-catalogo");
      },
      createRest: () => {
        created += 1;
      },
      logger,
    }),
    1,
  );
  assert.equal(created, 0);
  assert.doesNotMatch(JSON.stringify(logger.logs), /sentinela-privada/);
});

test("CLI confirmado retorna código não zero na falha REST sem retry ou dados brutos", async (t) => {
  guardNetwork(t);
  const logger = loggerFor();
  const fake = restFactory({ failure: "put" });
  assert.equal(
    await runRegistration({
      argv: [CONFIRM_ARGUMENT],
      env: TEST_ENV,
      loadEnvironment: () => {},
      loadCatalog: catalog,
      createRest: fake.createRest,
      logger,
    }),
    1,
  );
  assert.equal(fake.calls.filter((call) => call.method === "put").length, 1);
  assert.doesNotMatch(
    JSON.stringify(logger.logs),
    /sentinela-privada|opaque-unit-test/,
  );
});

test("CLI confirmado retorna zero somente após PUT simulado concluído", async (t) => {
  guardNetwork(t);
  const logger = loggerFor();
  const fake = restFactory();
  assert.equal(
    await runRegistration({
      argv: [CONFIRM_ARGUMENT],
      env: TEST_ENV,
      loadEnvironment: () => {},
      loadCatalog: catalog,
      createRest: fake.createRest,
      logger,
    }),
    0,
  );
  assert.equal(fake.calls.filter((call) => call.method === "put").length, 1);
  assert.match(JSON.stringify(logger.logs), /Registro global concluído/);
});

test("importar entrypoint é inerte; main aceita somente dependências simuladas", async (t) => {
  guardNetwork(t);
  const before = process.exitCode;
  const entryPath = require.resolve("../deploy-commands");
  delete require.cache[entryPath];
  const { main } = require(entryPath);
  assert.equal(typeof main, "function");
  assert.equal(process.exitCode, before);
  const logger = loggerFor();
  assert.equal(
    await main({
      argv: ["--dry-run"],
      env: {},
      loadEnvironment: () => {
        throw new Error("dotenv não permitido");
      },
      loadCatalog: catalog,
      logger,
    }),
    0,
  );
  assert.equal(await main({ argv: [], logger }), 1);
  assert.equal(process.exitCode, before);
});
