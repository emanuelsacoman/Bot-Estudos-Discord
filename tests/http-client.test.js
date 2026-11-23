const assert = require("node:assert/strict");
const dns = require("node:dns");
const dnsPromises = require("node:dns/promises");
const net = require("node:net");
const tls = require("node:tls");
const { beforeEach, test } = require("node:test");
const {
  createHttpClient,
  withHttpTimeout,
  HTTP_TIMEOUT_MS,
  HttpRequestError,
} = require("../lib/http-client");

beforeEach((t) => {
  const blockNetwork = () => {
    throw new Error("A suíte permite somente transporte HTTP controlado.");
  };
  t.mock.method(dns, "lookup", blockNetwork);
  t.mock.method(dnsPromises, "lookup", blockNetwork);
  t.mock.method(net.Socket.prototype, "connect", blockNetwork);
  t.mock.method(tls, "connect", blockNetwork);
  t.mock.method(globalThis, "fetch", blockNetwork);
});

function controlledPromise() {
  let resolve;
  let reject;
  const promise = new Promise((accept, decline) => {
    resolve = accept;
    reject = decline;
  });
  return { promise, resolve, reject };
}

function isSafeHttpError(error) {
  assert.ok(error instanceof HttpRequestError);
  assert.doesNotMatch(
    error.message,
    /SENSITIVE_SENTINEL|ECONNREFUSED|ENOTFOUND/,
  );
  assert.equal(error.cause, undefined);
  assert.equal(error.config, undefined);
  assert.equal(error.response?.data, undefined);
  assert.equal(error.response?.headers, undefined);
  return true;
}

test("prazo HTTP comum é de cinco segundos", () => {
  assert.equal(HTTP_TIMEOUT_MS, 5000);
});

test("getJson usa timeout explícito e AbortSignal sem perder validateStatus", async () => {
  const calls = [];
  const validateStatus = () => true;
  const client = createHttpClient({
    axiosGet: async (url, options) => {
      calls.push({ url, options });
      return {
        status: 404,
        data: { code: 404 },
        config: { sensitive: true },
        headers: { sensitive: true },
      };
    },
  });
  const result = await client.getJson("https://example.com/status", {
    validateStatus,
    timeout: 0,
    headers: { Accept: "application/json" },
  });
  assert.deepEqual(result, { status: 404, data: { code: 404 } });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://example.com/status");
  assert.equal(calls[0].options.timeout, HTTP_TIMEOUT_MS);
  assert.ok(calls[0].options.signal instanceof AbortSignal);
  assert.equal(calls[0].options.signal.aborted, false);
  assert.equal(calls[0].options.validateStatus, validateStatus);
  assert.deepEqual(calls[0].options.headers, { Accept: "application/json" });
});

test("getJson preserva status numérico útil sem reter erro axios bruto", async () => {
  const client = createHttpClient({
    axiosGet: async () => {
      throw Object.assign(new Error("SENSITIVE_SENTINEL ECONNREFUSED"), {
        config: { auth: "SENSITIVE_SENTINEL" },
        response: {
          status: 404,
          data: "SENSITIVE_SENTINEL",
          headers: { secret: "SENSITIVE_SENTINEL" },
        },
      });
    },
  });
  await assert.rejects(client.getJson("https://example.com"), (error) => {
    isSafeHttpError(error);
    assert.deepEqual(error.response, { status: 404 });
    return true;
  });
});

test("status inválido de erro axios não atravessa a fronteira sanitizada", async (t) => {
  for (const status of [
    undefined,
    "SENSITIVE_SENTINEL",
    NaN,
    Infinity,
    99,
    600,
    200.5,
    {},
  ]) {
    await t.test(String(status), async () => {
      const client = createHttpClient({
        axiosGet: async () => {
          throw {
            response: { status },
            config: { secret: "SENSITIVE_SENTINEL" },
          };
        },
      });
      await assert.rejects(client.getJson("https://example.com"), (error) => {
        isSafeHttpError(error);
        assert.equal(error.response, undefined);
        return true;
      });
    });
  }
});

test("getJson cancela transporte que não termina no prazo", async () => {
  let signal;
  const client = createHttpClient({
    timeoutMs: 20,
    axiosGet: (_url, options) => {
      signal = options.signal;
      return new Promise(() => {});
    },
  });
  await assert.rejects(client.getJson("https://example.com"), isSafeHttpError);
  assert.equal(signal.aborted, true);
});

test("fetchJson entrega JSON de sucesso e sanitiza falhas usando AbortSignal", async (t) => {
  for (const status of [200, 404, 500]) {
    await t.test(String(status), async () => {
      const calls = [];
      const client = createHttpClient({
        fetch: async (url, options) => {
          calls.push({ url, options });
          return new Response(JSON.stringify({ message: "controlled" }), {
            status,
          });
        },
      });
      if (status === 200) {
        assert.deepEqual(await client.fetchJson("https://example.com"), {
          status,
          data: { message: "controlled" },
        });
      } else {
        await assert.rejects(
          client.fetchJson("https://example.com"),
          (error) => {
            isSafeHttpError(error);
            assert.equal(error.code, "HTTP_STATUS_ERROR");
            assert.equal(error.response.status, status);
            return true;
          },
        );
      }
      assert.equal(calls.length, 1);
      assert.ok(calls[0].options.signal instanceof AbortSignal);
      assert.equal(calls[0].options.signal.aborted, false);
    });
  }
});

test("fetchJson inclui leitura e parse do corpo no mesmo prazo total", async () => {
  let signal;
  let parsed = false;
  const client = createHttpClient({
    timeoutMs: 20,
    fetch: async (_url, options) => {
      signal = options.signal;
      return {
        status: 200,
        body: new ReadableStream({
          pull() {
            parsed = true;
            return new Promise(() => {});
          },
        }),
      };
    },
  });
  await assert.rejects(
    client.fetchJson("https://example.com"),
    isSafeHttpError,
  );
  assert.equal(parsed, true);
  assert.equal(signal.aborted, true);
});

test("fetchJson sanitiza falha de conexão e JSON inválido", async (t) => {
  for (const failAt of ["fetch", "json"]) {
    await t.test(failAt, async () => {
      const fail = () => {
        throw new Error("SENSITIVE_SENTINEL ENOTFOUND");
      };
      const client = createHttpClient({
        fetch:
          failAt === "fetch" ? fail : async () => new Response("{INVALID_JSON"),
      });
      await assert.rejects(
        client.fetchJson("https://example.com"),
        isSafeHttpError,
      );
    });
  }
});

test("withHttpTimeout aguarda operação inteira e devolve resultado concluído", async () => {
  const result = await withHttpTimeout(async (signal) => {
    assert.ok(signal instanceof AbortSignal);
    assert.equal(signal.aborted, false);
    return { completed: true };
  }, 100);
  assert.deepEqual(result, { completed: true });
});

test("withHttpTimeout captura throw síncrono e rejeição assíncrona", async () => {
  for (const operation of [
    () => {
      throw new Error("SENSITIVE_SENTINEL");
    },
    async () => {
      throw new Error("SENSITIVE_SENTINEL");
    },
  ]) {
    await assert.rejects(withHttpTimeout(operation, 100), isSafeHttpError);
  }
});

test("resultado tardio de operação cancelada não vira sucesso", async () => {
  const pending = controlledPromise();
  let signal;
  const operation = withHttpTimeout((currentSignal) => {
    signal = currentSignal;
    return pending.promise;
  }, 20);
  await assert.rejects(operation, isSafeHttpError);
  assert.equal(signal.aborted, true);
  pending.resolve({ late: true });
  await new Promise((resolve) => setImmediate(resolve));
});

test("rejeição tardia depois de timeout permanece tratada sem unhandledRejection", async (t) => {
  const pending = controlledPromise();
  const unhandled = [];
  const onUnhandled = (error) => unhandled.push(error);
  process.on("unhandledRejection", onUnhandled);
  t.after(() => process.off("unhandledRejection", onUnhandled));
  await assert.rejects(
    withHttpTimeout(() => pending.promise, 20),
    isSafeHttpError,
  );
  pending.reject(new Error("SENSITIVE_SENTINEL late transport failure"));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(unhandled.length, 0);
});

test("falhas HTTP não registram configuração, body ou erro bruto", async (t) => {
  const printed = [];
  for (const method of ["error", "warn", "log"])
    t.mock.method(console, method, (...args) => printed.push(...args));
  const client = createHttpClient({
    axiosGet: async () => {
      throw Object.assign(new Error("SENSITIVE_SENTINEL"), {
        config: { auth: "SENSITIVE_SENTINEL" },
      });
    },
  });
  await assert.rejects(client.getJson("https://example.com"), isSafeHttpError);
  assert.doesNotMatch(JSON.stringify(printed), /SENSITIVE_SENTINEL/);
});
