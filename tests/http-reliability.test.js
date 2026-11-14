const assert = require("node:assert/strict");
const dns = require("node:dns");
const dnsPromises = require("node:dns/promises");
const net = require("node:net");
const { Readable, Writable } = require("node:stream");
const tls = require("node:tls");
const { beforeEach, test } = require("node:test");
const axios = require("axios");
const {
  createHttpClient,
  HttpRequestError,
  HTTP_TIMEOUT_MS,
  HTTP_MAX_BODY_BYTES,
  RATE_LIMIT_FALLBACK_MS,
  MAX_RATE_LIMIT_MS,
} = require("../lib/http-client");

const SENTINEL = "SENSITIVE_SENTINEL_HTTP_RELIABILITY";
const GITHUB = "https://api.github.com/repos/controlled/example";
const SEARCH = "https://api.stackexchange.com/2.3/search?site=stackoverflow";
const NOW = Date.UTC(2026, 10, 8, 12, 0, 0);

beforeEach((t) => {
  const refuse = () => {
    throw new Error("Somente transporte em memória é permitido nesta suíte.");
  };
  t.mock.method(dns, "lookup", refuse);
  t.mock.method(dnsPromises, "lookup", refuse);
  t.mock.method(net.Socket.prototype, "connect", refuse);
  t.mock.method(tls, "connect", refuse);
  t.mock.method(globalThis, "fetch", refuse);
});

function errorIs(code, status, delay) {
  return (error) => {
    assert.ok(error instanceof HttpRequestError);
    assert.equal(error.code, code);
    assert.equal(error.cause, undefined);
    assert.equal(error.config, undefined);
    assert.equal(error.request, undefined);
    assert.equal(error.headers, undefined);
    assert.equal(error.response?.data, undefined);
    assert.equal(error.response?.headers, undefined);
    assert.deepEqual(
      error.response,
      status === undefined ? undefined : { status },
    );
    if (delay !== undefined) assert.equal(error.retryAfterMs, delay);
    assert.doesNotMatch(
      `${error.message} ${error.stack} ${JSON.stringify(error)}`,
      /SENSITIVE_SENTINEL|api\.github\.com|api\.stackexchange\.com|Authorization|retry-after|10\.0\.0\.1/,
    );
    return true;
  };
}

function memoryAxios({
  status = 200,
  headers = {},
  body = Buffer.from("{}"),
} = {}) {
  const calls = [];
  const transport = {
    request(options, onResponse) {
      calls.push(options);
      const req = new Writable({
        write(_chunk, _encoding, callback) {
          callback();
        },
        final(callback) {
          const res = Readable.from([body]);
          res.statusCode = status;
          res.headers = { "content-type": "application/json", ...headers };
          res.req = req;
          onResponse(res);
          callback();
        },
      });
      req.setTimeout = () => req;
      return req;
    },
  };
  const adapter = axios.create({ adapter: "http", proxy: false, transport });
  return { calls, axiosGet: (url, options) => adapter.get(url, options) };
}

function fetchResponse({
  status = 200,
  headers = {},
  body = Buffer.from("{}"),
} = {}) {
  const calls = { reads: 0, cancels: 0, releases: 0, bodyCancels: 0 };
  let consumed = false;
  const reader = {
    async read() {
      calls.reads++;
      if (consumed) return { done: true };
      consumed = true;
      return { done: false, value: body };
    },
    async cancel() {
      calls.cancels++;
    },
    releaseLock() {
      calls.releases++;
    },
  };
  return {
    calls,
    reader,
    response: {
      status,
      headers: new Headers(headers),
      body: {
        getReader: () => reader,
        async cancel() {
          calls.bodyCancels++;
          throw new Error(`${SENTINEL} cancel body`);
        },
      },
      json() {
        assert.fail("A leitura JSON sem limite não deve ser usada.");
      },
    },
  };
}

function harness(kind, response = {}, options = {}) {
  if (kind === "axios") {
    const memory = memoryAxios(response);
    const client = createHttpClient({ axiosGet: memory.axiosGet, ...options });
    return {
      client,
      calls: memory.calls,
      request: (url = GITHUB, config) => client.getJson(url, config),
    };
  }
  const body = fetchResponse(response);
  const calls = [];
  const client = createHttpClient({
    fetch: async (url, config) => {
      calls.push({ url, config });
      return body.response;
    },
    ...options,
  });
  return {
    client,
    calls,
    body,
    request: (url = GITHUB, config) => client.fetchJson(url, config),
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((accept, decline) => {
    resolve = accept;
    reject = decline;
  });
  return { promise, resolve, reject };
}

const nextTurn = () => new Promise((resolve) => setImmediate(resolve));

test("políticas HTTP têm prazo, orçamento e pausas máximas explícitos", () => {
  assert.equal(HTTP_TIMEOUT_MS, 5000);
  assert.equal(HTTP_MAX_BODY_BYTES, 1024 * 1024);
  assert.equal(RATE_LIMIT_FALLBACK_MS, 60000);
  assert.equal(MAX_RATE_LIMIT_MS, 86400000);
});

for (const kind of ["axios", "fetch"]) {
  for (const [name, bytes] of [
    ["JSON incompleto", Buffer.from(`{\"secret\":\"${SENTINEL}`)],
    ["HTML", Buffer.from(`<html>${SENTINEL}</html>`)],
    ["vazio", Buffer.alloc(0)],
    ["somente espaços", Buffer.from(" \r\n\t ")],
    [
      "UTF-8 inválido dentro de string JSON",
      Buffer.from([0x22, 0xc3, 0x28, 0x22]),
    ],
  ]) {
    test(`${kind}: recusa ${name} com erro de corpo sanitizado`, async () => {
      const run = harness(kind, { body: bytes });
      await assert.rejects(run.request(), errorIs("HTTP_INVALID_BODY"));
      assert.equal(run.calls.length, 1);
      if (kind === "fetch") {
        assert.equal(run.body.calls.cancels, 1);
        assert.equal(run.body.calls.releases, 1);
      }
    });
  }

  test(`${kind}: preserva Unicode válido sem substituições`, async () => {
    const data = { texto: "ação 😀 漢字 e\u0301", nested: [false, null, 12] };
    const run = harness(kind, { body: Buffer.from(JSON.stringify(data)) });
    assert.deepEqual(await run.request(), { status: 200, data });
    assert.equal(run.calls.length, 1);
  });

  for (const status of [400, 401, 403, 404, 429, 500, 503]) {
    test(`${kind}: classifica HTTP ${status} antes de tentar parsear HTML`, async () => {
      const run = harness(kind, {
        status,
        headers: { "x-secret": SENTINEL },
        body: Buffer.from(`<html>${SENTINEL}</html>`),
      });
      await assert.rejects(
        run.request(),
        errorIs(
          status === 429 ? "HTTP_RATE_LIMITED" : "HTTP_STATUS_ERROR",
          status,
          status === 429 ? RATE_LIMIT_FALLBACK_MS : undefined,
        ),
      );
      assert.equal(run.calls.length, 1);
      if (kind === "fetch") {
        assert.equal(run.body.calls.reads, 0);
        assert.equal(run.body.calls.bodyCancels, 1);
      }
    });
  }

  for (const [name, headers, expected] of [
    ["Retry-After em segundos", { "retry-after": "12" }, 12000],
    [
      "Retry-After em data HTTP",
      { "retry-after": new Date(NOW + 17000).toUTCString() },
      17000,
    ],
    [
      "reset em epoch quando não há Retry-After",
      {
        "x-ratelimit-remaining": "0",
        "x-ratelimit-reset": String(NOW / 1000 + 9),
      },
      9000,
    ],
    ["cabeçalho inválido usa fallback", { "retry-after": SENTINEL }, 60000],
    ["zero usa fallback", { "retry-after": "0" }, 60000],
    [
      "data passada usa fallback",
      { "retry-after": new Date(NOW - 1000).toUTCString() },
      60000,
    ],
    [
      "pausa excessiva é limitada a 24 horas",
      { "retry-after": "999999" },
      86400000,
    ],
    [
      "Retry-After válido prevalece sobre reset",
      { "retry-after": "3", "x-ratelimit-reset": String(NOW / 1000 + 30) },
      3000,
    ],
  ]) {
    test(`${kind}: 429 ${name}, com relógio controlado e tentativa única`, async () => {
      const run = harness(kind, { status: 429, headers }, { now: () => NOW });
      await assert.rejects(
        run.request(),
        errorIs("HTTP_RATE_LIMITED", 429, expected),
      );
      await assert.rejects(
        run.request(),
        errorIs("HTTP_RATE_LIMITED", undefined, expected),
      );
      assert.equal(run.calls.length, 1);
    });
  }

  for (const headers of [
    { "x-ratelimit-remaining": "0" },
    { "retry-after": "2" },
  ]) {
    test(`${kind}: 403 com evidência de quota pausa a origem`, async () => {
      const expected = headers["retry-after"] ? 2000 : 60000;
      const run = harness(kind, { status: 403, headers }, { now: () => NOW });
      await assert.rejects(
        run.request(),
        errorIs("HTTP_RATE_LIMITED", 403, expected),
      );
      await assert.rejects(
        run.request(),
        errorIs("HTTP_RATE_LIMITED", undefined, expected),
      );
      assert.equal(run.calls.length, 1);
    });
  }

  test(`${kind}: 403 sem evidência é forbidden e não cria pausa`, async () => {
    const run = harness(kind, {
      status: 403,
      headers: { "x-ratelimit-remaining": "5" },
    });
    await assert.rejects(run.request(), errorIs("HTTP_STATUS_ERROR", 403));
    await assert.rejects(run.request(), errorIs("HTTP_STATUS_ERROR", 403));
    assert.equal(run.calls.length, 2);
  });

  test(`${kind}: pausa por origem não contamina outro provedor e expira no limite`, async () => {
    let time = NOW;
    const run = harness(
      kind,
      { status: 429, headers: { "retry-after": "2" } },
      { now: () => time },
    );
    await assert.rejects(
      run.request(GITHUB),
      errorIs("HTTP_RATE_LIMITED", 429, 2000),
    );
    time += 1999;
    await assert.rejects(
      run.request("https://api.github.com/search/repositories?q=javascript"),
      errorIs("HTTP_RATE_LIMITED", undefined, 1),
    );
    await assert.rejects(
      run.request("https://translate.googleapis.com/translate_a/single"),
      errorIs("HTTP_RATE_LIMITED", 429, 2000),
    );
    assert.equal(run.calls.length, 2);
    time += 1;
    await assert.rejects(
      run.request(GITHUB),
      errorIs("HTTP_RATE_LIMITED", 429, 2000),
    );
    assert.equal(run.calls.length, 3);
  });

  test(`${kind}: origem desconhecida não acumula pausas para URLs fornecidas`, async () => {
    const run = harness(kind, { status: 429 }, { now: () => NOW });
    for (const url of [
      "https://example.com/a",
      "https://example.com/a",
      "https://example.net/b",
    ]) {
      await assert.rejects(
        run.request(url),
        errorIs("HTTP_RATE_LIMITED", 429, 60000),
      );
    }
    assert.equal(run.calls.length, 3);
  });

  test(`${kind}: instância nova não restaura pausa de outra instância`, async () => {
    const first = harness(kind, { status: 429 }, { now: () => NOW });
    await assert.rejects(
      first.request(),
      errorIs("HTTP_RATE_LIMITED", 429, 60000),
    );
    const fresh = harness(
      kind,
      { body: Buffer.from('{"ok":true}') },
      { now: () => NOW },
    );
    assert.deepEqual(await fresh.request(), {
      status: 200,
      data: { ok: true },
    });
    assert.equal(fresh.calls.length, 1);
  });

  test(`${kind}: redirect é recusado, sem segunda tentativa ou corpo publicado`, async () => {
    const run = harness(kind, {
      status: 302,
      headers: { location: `https://example.com/${SENTINEL}` },
      body: Buffer.from(`<html>${SENTINEL}</html>`),
    });
    await assert.rejects(run.request(), errorIs("HTTP_STATUS_ERROR", 302));
    assert.equal(run.calls.length, 1);
    if (kind === "fetch") assert.equal(run.calls[0].config.redirect, "manual");
  });

  test(`${kind}: cancelamento prévio não inicia transporte`, async () => {
    const controller = new AbortController();
    controller.abort(new Error(SENTINEL));
    const run = harness(kind);
    await assert.rejects(
      run.request(GITHUB, { signal: controller.signal }),
      errorIs("HTTP_CANCELLED"),
    );
    assert.equal(run.calls.length, 0);
  });

  for (const late of ["resolve", "reject"]) {
    test(`${kind}: cancelamento durante transporte trata ${late} tardio sem retry/rejeição solta`, async (t) => {
      const pending = deferred();
      const started = deferred();
      const controller = new AbortController();
      const unhandled = [];
      const onUnhandled = (error) => unhandled.push(error);
      process.on("unhandledRejection", onUnhandled);
      t.after(() => process.off("unhandledRejection", onUnhandled));
      let calls = 0;
      let internalSignal;
      const operation = (_url, options) => {
        calls++;
        internalSignal = options.signal;
        started.resolve();
        return pending.promise;
      };
      const client = createHttpClient(
        kind === "axios" ? { axiosGet: operation } : { fetch: operation },
      );
      const request =
        kind === "axios"
          ? client.getJson(GITHUB, { signal: controller.signal })
          : client.fetchJson(GITHUB, { signal: controller.signal });
      const rejected = assert.rejects(request, errorIs("HTTP_CANCELLED"));
      await started.promise;
      controller.abort(new Error(SENTINEL));
      await rejected;
      assert.equal(internalSignal.aborted, true);
      if (late === "reject") pending.reject(new Error(`${SENTINEL} late`));
      else
        pending.resolve(
          kind === "axios"
            ? { status: 200, data: {} }
            : fetchResponse().response,
        );
      await nextTurn();
      assert.equal(calls, 1);
      assert.deepEqual(unhandled, []);
    });
  }

  test(`${kind}: timeout captura rejeição tardia e aborta uma única tentativa`, async (t) => {
    const pending = deferred();
    const unhandled = [];
    const onUnhandled = (error) => unhandled.push(error);
    process.on("unhandledRejection", onUnhandled);
    t.after(() => process.off("unhandledRejection", onUnhandled));
    let attempts = 0;
    let signal;
    const operation = (_url, options) => {
      attempts++;
      signal = options.signal;
      return pending.promise;
    };
    const client = createHttpClient({
      timeoutMs: 10,
      ...(kind === "axios" ? { axiosGet: operation } : { fetch: operation }),
    });
    await assert.rejects(
      kind === "axios" ? client.getJson(GITHUB) : client.fetchJson(GITHUB),
      errorIs("HTTP_TIMEOUT"),
    );
    assert.equal(signal.aborted, true);
    pending.reject(new Error(`${SENTINEL} late timeout`));
    await nextTurn();
    assert.equal(attempts, 1);
    assert.deepEqual(unhandled, []);
  });
}

for (const origin of [
  "https://api.github.com/a",
  "https://translate.googleapis.com/a",
  "https://api.exchangerate-api.com/a",
  "https://httpstat.us/429",
  SEARCH,
]) {
  test(`pausa de quota é admitida para escopo conhecido ${new URL(origin).hostname}`, async () => {
    const run = harness("axios", { status: 429 }, { now: () => NOW });
    await assert.rejects(
      run.request(origin),
      errorIs("HTTP_RATE_LIMITED", 429, 60000),
    );
    await assert.rejects(
      run.request(origin),
      errorIs("HTTP_RATE_LIMITED", undefined, 60000),
    );
    assert.equal(run.calls.length, 1);
  });
}

test("backoff de Stack Exchange não pausa outros endpoints nem outros provedores", async () => {
  let now = NOW;
  const run = harness("axios", {}, { now: () => now });
  run.client.pauseStackExchange(2);
  await assert.rejects(
    run.request(SEARCH),
    errorIs("HTTP_RATE_LIMITED", undefined, 2000),
  );
  assert.deepEqual(
    await run.request("https://api.stackexchange.com/2.3/answers"),
    { status: 200, data: {} },
  );
  assert.deepEqual(await run.request(GITHUB), { status: 200, data: {} });
  assert.equal(run.calls.length, 2);
  now += 2000;
  assert.deepEqual(await run.request(SEARCH), { status: 200, data: {} });
  assert.equal(run.calls.length, 3);
});

test("backoff aceita zero e 24 horas sem timers de espera, nem encurta pausa vigente", async (t) => {
  let now = NOW;
  const run = harness("axios", {}, { now: () => now });
  const schedule = t.mock.method(globalThis, "setTimeout");
  run.client.pauseStackExchange(0);
  run.client.pauseStackExchange(86400);
  run.client.pauseStackExchange(1);
  run.client.pauseStackExchange(0);
  assert.equal(schedule.mock.callCount(), 0);
  await assert.rejects(
    run.request(SEARCH),
    errorIs("HTTP_RATE_LIMITED", undefined, MAX_RATE_LIMIT_MS),
  );
  assert.equal(run.calls.length, 0);
  now += MAX_RATE_LIMIT_MS;
  assert.deepEqual(await run.request(SEARCH), { status: 200, data: {} });
});

for (const seconds of [-1, 86401, 1.5, NaN, Infinity, "1", undefined, null]) {
  test(`backoff inválido não cria pausa (${String(seconds)})`, async () => {
    const run = harness("axios", {}, { now: () => NOW });
    assert.throws(
      () => run.client.pauseStackExchange(seconds),
      errorIs("HTTP_INVALID_BODY"),
    );
    assert.deepEqual(await run.request(SEARCH), { status: 200, data: {} });
    assert.equal(run.calls.length, 1);
  });
}

test("axios real mantém validateStatus de /http sem afrouxar parse JSON", async () => {
  const run = harness("axios", {
    status: 404,
    body: Buffer.from('{"code":404}'),
  });
  assert.deepEqual(
    await run.request("https://httpstat.us/404", {
      validateStatus: () => true,
    }),
    { status: 404, data: { code: 404 } },
  );
  const html = harness("axios", {
    status: 404,
    body: Buffer.from(`<html>${SENTINEL}</html>`),
  });
  await assert.rejects(
    html.request("https://httpstat.us/404", { validateStatus: () => true }),
    errorIs("HTTP_INVALID_BODY"),
  );
});

test("opções não sobrescrevem limites, parser, redirect ou signal internos do axios", async () => {
  let received;
  const transport = memoryAxios({
    body: Buffer.from(`<html>${SENTINEL}</html>`),
  });
  const client = createHttpClient({
    axiosGet(url, options) {
      received = options;
      return transport.axiosGet(url, options);
    },
  });
  let overriddenParse = false;
  await assert.rejects(
    client.getJson(GITHUB, {
      timeout: Infinity,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      maxRedirects: 20,
      responseType: "stream",
      transformResponse: [
        () => {
          overriddenParse = true;
          return {};
        },
      ],
    }),
    errorIs("HTTP_INVALID_BODY"),
  );
  assert.equal(overriddenParse, false);
  assert.equal(received.timeout, 5000);
  assert.equal(received.maxContentLength, HTTP_MAX_BODY_BYTES);
  assert.equal(received.maxBodyLength, HTTP_MAX_BODY_BYTES);
  assert.equal(received.maxRedirects, 0);
  assert.equal(received.responseType, "arraybuffer");
  assert.ok(received.signal instanceof AbortSignal);
  assert.equal(transport.calls.length, 1);
});

test("fetch força redirect manual mesmo se a chamada pede follow", async () => {
  const run = harness("fetch", {
    status: 301,
    headers: { location: `https://example.com/${SENTINEL}` },
  });
  await assert.rejects(
    run.request(GITHUB, { redirect: "follow" }),
    errorIs("HTTP_STATUS_ERROR", 301),
  );
  assert.equal(run.calls[0].config.redirect, "manual");
  assert.equal(run.calls.length, 1);
});

test("erro de rede não expõe URL, cabeçalhos, corpo, causa ou logs", async (t) => {
  const logs = [];
  for (const method of ["log", "warn", "error"])
    t.mock.method(console, method, (...args) => logs.push(args));
  const client = createHttpClient({
    axiosGet: async () => {
      throw Object.assign(new Error(`${SENTINEL} http://10.0.0.1`), {
        cause: new Error(SENTINEL),
        config: { url: GITHUB, headers: { Authorization: SENTINEL } },
        request: { body: SENTINEL },
      });
    },
  });
  await assert.rejects(client.getJson(GITHUB), errorIs("HTTP_REQUEST_FAILED"));
  assert.deepEqual(logs, []);
});
