const assert = require("node:assert/strict");
const dns = require("node:dns");
const net = require("node:net");
const tls = require("node:tls");
const { Readable, Writable } = require("node:stream");
const { gzipSync } = require("node:zlib");
const { beforeEach, test } = require("node:test");
const axios = require("axios");
const {
  createHttpClient,
  HTTP_MAX_BODY_BYTES,
  HttpRequestError,
} = require("../lib/http-client");

beforeEach((t) => {
  const refuse = () => {
    throw new Error("Rede real proibida");
  };
  t.mock.method(dns, "lookup", refuse);
  t.mock.method(net.Socket.prototype, "connect", refuse);
  t.mock.method(tls, "connect", refuse);
  t.mock.method(globalThis, "fetch", refuse);
});

function trackedBody(
  chunks,
  { length, failRead, failCancel, pendingRead } = {},
) {
  const calls = { reads: 0, cancels: 0, releases: 0 };
  const reader = {
    async read() {
      calls.reads++;
      if (failRead) throw new Error("SENSITIVE_SENTINEL read");
      if (pendingRead) return new Promise(() => {});
      return chunks.length
        ? { done: false, value: chunks.shift() }
        : { done: true };
    },
    async cancel() {
      calls.cancels++;
      if (failCancel) throw new Error("SENSITIVE_SENTINEL cancel");
    },
    releaseLock() {
      calls.releases++;
    },
  };
  return {
    calls,
    response: {
      status: 200,
      headers: new Headers(
        length === undefined ? {} : { "content-length": String(length) },
      ),
      body: { getReader: () => reader },
    },
  };
}

function safeError(error) {
  assert.ok(error instanceof HttpRequestError);
  assert.doesNotMatch(error.message, /SENSITIVE_SENTINEL/);
  assert.equal(error.cause, undefined);
  assert.equal(error.response?.data, undefined);
  return true;
}

test("orçamento HTTP é 1 MiB e não pode ser aumentado pelas opções axios", async () => {
  assert.equal(HTTP_MAX_BODY_BYTES, 1024 * 1024);
  const client = createHttpClient({
    axiosGet: async (_url, options) => {
      assert.equal(options.maxContentLength, HTTP_MAX_BODY_BYTES);
      assert.equal(options.maxBodyLength, HTTP_MAX_BODY_BYTES);
      assert.equal(options.responseType, "arraybuffer");
      return { status: 200, data: {} };
    },
  });
  await client.getJson("https://example.com", {
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    responseType: "stream",
  });
});

for (const advertised of [undefined, HTTP_MAX_BODY_BYTES]) {
  test(`fetch aceita JSON no limite exato em bytes (Content-Length ${advertised})`, async () => {
    const text = JSON.stringify("x".repeat(HTTP_MAX_BODY_BYTES - 2));
    const body = trackedBody([Buffer.from(text)], { length: advertised });
    const client = createHttpClient({ fetch: async () => body.response });
    const result = await client.fetchJson("https://example.com");
    assert.equal(result.data.length, HTTP_MAX_BODY_BYTES - 2);
    assert.equal(body.calls.cancels, 0);
    assert.equal(body.calls.releases, 1);
  });
}

test("fetch conta bytes UTF-8 de emojis separados entre chunks sem perder caracteres", async () => {
  const text = JSON.stringify({ value: "a😀é" });
  const encoded = Buffer.from(text);
  const body = trackedBody([...encoded].map((byte) => Uint8Array.of(byte)));
  const client = createHttpClient({ fetch: async () => body.response });
  assert.deepEqual((await client.fetchJson("https://example.com")).data, {
    value: "a😀é",
  });
  assert.equal(body.calls.releases, 1);
});

for (const advertised of [undefined, 1]) {
  test(`fetch cancela excesso real mesmo sem comprimento confiável (${advertised})`, async () => {
    const body = trackedBody(
      [Buffer.alloc(HTTP_MAX_BODY_BYTES), Uint8Array.of(1)],
      { length: advertised },
    );
    const client = createHttpClient({ fetch: async () => body.response });
    await assert.rejects(client.fetchJson("https://example.com"), (error) => {
      safeError(error);
      assert.equal(error.code, "HTTP_RESPONSE_TOO_LARGE");
      return true;
    });
    assert.equal(body.calls.reads, 2);
    assert.equal(body.calls.cancels, 1);
    assert.equal(body.calls.releases, 1);
  });
}

test("fetch rejeita Content-Length excessivo antes de ler e libera o leitor", async () => {
  const body = trackedBody([], { length: HTTP_MAX_BODY_BYTES + 1 });
  const client = createHttpClient({ fetch: async () => body.response });
  await assert.rejects(client.fetchJson("https://example.com"), safeError);
  assert.equal(body.calls.reads, 0);
  assert.equal(body.calls.cancels, 1);
  assert.equal(body.calls.releases, 1);
});

test("fetch rejeita corpo multibyte menor em caracteres mas maior em bytes", async () => {
  const body = trackedBody([
    Buffer.from(JSON.stringify("😀".repeat(HTTP_MAX_BODY_BYTES / 4))),
  ]);
  const client = createHttpClient({ fetch: async () => body.response });
  await assert.rejects(client.fetchJson("https://example.com"), safeError);
  assert.equal(body.calls.cancels, 1);
});

for (const chunks of [
  [],
  [Buffer.from("{")],
  [Uint8Array.of(0xff)],
  ["invalid chunk"],
]) {
  test(`fetch sanitiza JSON/corpo inválido (${JSON.stringify(chunks)})`, async () => {
    const body = trackedBody([...chunks], { failCancel: true });
    const client = createHttpClient({ fetch: async () => body.response });
    await assert.rejects(client.fetchJson("https://example.com"), safeError);
    assert.equal(body.calls.cancels, 1);
    assert.equal(body.calls.releases, 1);
  });
}

test("fetch rejeita transporte sem fluxo em vez de usar json sem limite", async () => {
  let parsed = false;
  const client = createHttpClient({
    fetch: async () => ({
      status: 200,
      json() {
        parsed = true;
        return {};
      },
    }),
  });
  await assert.rejects(client.fetchJson("https://example.com"), safeError);
  assert.equal(parsed, false);
});

test("falha de leitura não vaza erro e cancelamento rejeitado não vaza promise", async () => {
  const body = trackedBody([], { failRead: true, failCancel: true });
  const client = createHttpClient({ fetch: async () => body.response });
  await assert.rejects(client.fetchJson("https://example.com"), safeError);
  assert.equal(body.calls.cancels, 1);
  assert.equal(body.calls.releases, 1);
  await new Promise((resolve) => setImmediate(resolve));
});

test("timeout cancela/libera leitor pendente mesmo se cancel rejeita", async () => {
  const body = trackedBody([], { pendingRead: true, failCancel: true });
  const client = createHttpClient({
    timeoutMs: 20,
    fetch: async () => body.response,
  });
  await assert.rejects(client.fetchJson("https://example.com"), safeError);
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(body.calls.cancels >= 1);
  assert.equal(body.calls.releases, 1);
});

test("cancelamento pendente não prolonga a rejeição por excesso", async () => {
  const body = trackedBody([], { length: HTTP_MAX_BODY_BYTES + 1 });
  const reader = body.response.body.getReader();
  reader.cancel = () => new Promise(() => {});
  const client = createHttpClient({ fetch: async () => body.response });
  await assert.rejects(client.fetchJson("https://example.com"), (error) => {
    assert.equal(error.code, "HTTP_RESPONSE_TOO_LARGE");
    return safeError(error);
  });
  assert.equal(body.calls.releases, 1);
});

test("resposta fetch tardia é cancelada sem ler após timeout", async () => {
  const body = trackedBody([Buffer.from("{}")]);
  let finishFetch;
  const client = createHttpClient({
    timeoutMs: 20,
    fetch: () =>
      new Promise((resolve) => {
        finishFetch = resolve;
      }),
  });
  await assert.rejects(client.fetchJson("https://example.com"), safeError);
  finishFetch(body.response);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(body.calls.reads, 0);
  assert.equal(body.calls.cancels, 1);
  assert.equal(body.calls.releases, 1);
});

test("falha de releaseLock não substitui o erro sanitizado nem cria rejeição", async () => {
  const body = trackedBody([], { failRead: true });
  body.response.body.getReader().releaseLock = () => {
    throw new Error("SENSITIVE_SENTINEL release");
  };
  const client = createHttpClient({ fetch: async () => body.response });
  await assert.rejects(client.fetchJson("https://example.com"), safeError);
  assert.equal(body.calls.cancels, 1);
});

function memoryTransport(body, headers = {}) {
  return {
    request(_options, onResponse) {
      const req = new Writable({
        write(_chunk, _encoding, callback) {
          callback();
        },
        final(callback) {
          const res = Readable.from([body]);
          res.headers = { "content-type": "application/json", ...headers };
          res.statusCode = 200;
          res.req = req;
          onResponse(res);
          callback();
        },
      });
      req.setTimeout = () => req;
      return req;
    },
  };
}

for (const compressed of [false, true]) {
  for (const extra of [0, 1]) {
    test(`adapter axios real limita antes de parse (gzip=${compressed}, extra=${extra})`, async () => {
      const text = JSON.stringify("x".repeat(HTTP_MAX_BODY_BYTES - 2 + extra));
      const bytes = compressed ? gzipSync(text) : Buffer.from(text);
      let transformations = 0;
      const transport = memoryTransport(
        bytes,
        compressed ? { "content-encoding": "gzip" } : {},
      );
      const client = createHttpClient({
        axiosGet: (url, options) =>
          axios.get(url, {
            ...options,
            proxy: false,
            transport,
            transformResponse: [
              (data) => {
                transformations++;
                return JSON.parse(data);
              },
            ],
          }),
      });
      if (extra) {
        await assert.rejects(client.getJson("https://example.com"), safeError);
        assert.equal(transformations, 0);
      } else {
        const result = await client.getJson("https://example.com");
        assert.equal(result.data.length, HTTP_MAX_BODY_BYTES - 2);
        assert.equal(transformations, 1);
      }
    });
  }
}
