const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const dns = require("node:dns");
const dnsPromises = require("node:dns/promises");
const http = require("node:http");
const https = require("node:https");
const net = require("node:net");
const { Duplex, PassThrough } = require("node:stream");
const { beforeEach, test } = require("node:test");
const tls = require("node:tls");
const {
  createStatusChecker,
  isPublicAddress,
  normalizeUrl,
  StatusCheckError,
} = require("../lib/status-http");

const PUBLIC_IPV4 = "93.184.216.34";
const PUBLIC_IPV6 = "2606:4700:4700::1111";

beforeEach((t) => {
  const blockNetwork = () => {
    throw new Error("A suíte permite somente DNS e sockets em memória.");
  };
  t.mock.method(dns, "lookup", blockNetwork);
  t.mock.method(dnsPromises, "lookup", blockNetwork);
  t.mock.method(net.Socket.prototype, "connect", blockNetwork);
  t.mock.method(tls, "connect", blockNetwork);
});

function fakeTransport({
  status = 200,
  headers = {},
  chunks = [Buffer.from("ok")],
  error,
  stall = false,
  abort = false,
} = {}) {
  const calls = [];
  function request(options, onResponse) {
    const req = new EventEmitter();
    const response = new PassThrough();
    response.statusCode = status;
    response.headers = headers;
    response.complete = false;
    req.destroyed = false;
    req.destroy = (cause) => {
      req.destroyed = true;
      response.destroy();
      if (cause) queueMicrotask(() => req.emit("error", cause));
      return req;
    };
    req.end = () => {
      queueMicrotask(() => {
        if (req.destroyed) return;
        if (error) {
          req.emit("error", error);
          return;
        }
        onResponse(response);
        if (stall || req.destroyed || response.destroyed) return;
        if (abort) {
          response.emit("aborted");
          response.destroy();
          return;
        }
        for (const chunk of chunks) {
          if (req.destroyed || response.destroyed) return;
          response.write(chunk);
        }
        response.complete = true;
        response.end();
      });
      return req;
    };
    calls.push({ options, req, response });
    return req;
  }
  return { request, calls };
}

function checker({
  addresses = [{ address: PUBLIC_IPV4, family: 4 }],
  lookup,
  transport = fakeTransport(),
  ...limits
} = {}) {
  const lookups = [];
  const check = createStatusChecker({
    lookup: async (hostname, options) => {
      lookups.push({ hostname, options });
      return lookup ? lookup(hostname, options) : addresses;
    },
    httpRequest: transport.request,
    httpsRequest: transport.request,
    ...limits,
  });
  return { check, lookups, transport };
}

function failsWith(code) {
  return (error) => {
    assert.ok(error instanceof StatusCheckError);
    assert.equal(error.code, code);
    assert.doesNotMatch(
      error.message,
      /secret|ENOTFOUND|ECONNREFUSED|certificate|169\.254|127\.0\.0|192\.168/i,
    );
    return true;
  };
}

test("normaliza domínio público para HTTPS e aceita porta, caminho e IDN", () => {
  assert.equal(normalizeUrl("example.com").href, "https://example.com/");
  assert.equal(
    normalizeUrl("example.com:8080/path?q=1").href,
    "https://example.com:8080/path?q=1",
  );
  assert.equal(
    normalizeUrl("HTTP://EXAMPLE.COM/path").href,
    "http://example.com/path",
  );
  assert.equal(
    normalizeUrl("https://café.example").hostname,
    "xn--caf-dma.example",
  );
});

test("rejeita URLs inválidas, esquemas externos e credenciais antes de DNS/transporte", async (t) => {
  const inputs = [
    "",
    " ",
    "http://",
    "https://[::1",
    "https://example.com:99999",
    "//example.com",
    "ftp://example.com",
    "file:///etc/passwd",
    "gopher://example.com",
    "data:text/plain,hello",
    "javascript:alert(1)",
    "https:example.com",
    "https://user:secret@example.com",
    "https://user@example.com",
    "https://:secret@example.com",
    "https://@example.com",
    "https://:@example.com",
    "https:///@example.com",
    "https:////:@example.com",
    "https://example.com/\r\nheader",
    `https://example.com/${"a".repeat(2048)}`,
  ];
  for (const input of inputs) {
    await t.test(JSON.stringify(input).slice(0, 90), async () => {
      const fixture = checker();
      await assert.rejects(fixture.check(input), failsWith("INVALID_URL"));
      assert.equal(fixture.lookups.length, 0);
      assert.equal(fixture.transport.calls.length, 0);
    });
  }
});

test("política IPv4 bloqueia redes internas, metadata, reservadas e multicast", async (t) => {
  const blocked = [
    "0.0.0.0",
    "0.1.2.3",
    "10.0.0.1",
    "10.255.255.255",
    "100.64.0.1",
    "100.127.255.255",
    "127.0.0.1",
    "127.255.255.254",
    "169.254.0.1",
    "169.254.169.254",
    "169.254.170.2",
    "168.63.129.16",
    "172.16.0.1",
    "172.31.255.255",
    "192.0.0.1",
    "192.0.0.9",
    "192.0.2.1",
    "192.88.99.1",
    "192.168.0.1",
    "192.168.255.255",
    "198.18.0.1",
    "198.19.255.255",
    "198.51.100.1",
    "203.0.113.1",
    "224.0.0.1",
    "239.255.255.255",
    "240.0.0.1",
    "255.255.255.255",
  ];
  for (const address of blocked) {
    await t.test(address, async () => {
      assert.equal(isPublicAddress(address), false);
      const fixture = checker();
      await assert.rejects(
        fixture.check(`http://${address}`),
        failsWith("BLOCKED_ADDRESS"),
      );
      assert.equal(fixture.lookups.length, 0);
      assert.equal(fixture.transport.calls.length, 0);
    });
  }
  for (const address of [
    "1.1.1.1",
    PUBLIC_IPV4,
    "100.63.255.255",
    "100.128.0.0",
    "172.15.255.255",
    "172.32.0.0",
    "198.17.255.255",
    "198.20.0.0",
  ]) {
    assert.equal(isPublicAddress(address), true, address);
  }
});

test("política IPv6 bloqueia loopback, ULA, link-local, mapped, tradução e faixas especiais", async (t) => {
  const blocked = [
    "::",
    "::1",
    "::ffff:127.0.0.1",
    "::ffff:192.168.1.1",
    "::ffff:169.254.169.254",
    "::ffff:93.184.216.34",
    "::ffff:7f00:1",
    "::127.0.0.1",
    "fc00::1",
    "fd00::1",
    "fd00:ec2::254",
    "fe80::1",
    "febf::1",
    "fec0::1",
    "ff02::1",
    "64:ff9b::7f00:1",
    "64:ff9b:1::a00:1",
    "100::1",
    "2001::1",
    "2001:2::1",
    "2001:1ff:ffff::1",
    "2001:db8::1",
    "2002:7f00:1::",
    "3fff::1",
    "3fff:fff:ffff::1",
    "5f00::1",
  ];
  for (const address of blocked) {
    await t.test(address, async () => {
      assert.equal(isPublicAddress(address), false);
      const fixture = checker();
      await assert.rejects(
        fixture.check(`https://[${address}]`),
        failsWith("BLOCKED_ADDRESS"),
      );
      assert.equal(fixture.lookups.length, 0);
      assert.equal(fixture.transport.calls.length, 0);
    });
  }
  for (const address of [
    PUBLIC_IPV6,
    "2001:4860:4860::8888",
    "2001:200::1",
    "3ffe:ffff::1",
  ]) {
    assert.equal(isPublicAddress(address), true, address);
  }
  for (const address of [
    "not-an-ip",
    "fe80::1%eth0",
    "127.1",
    "2130706433",
    "::ffff:999.0.0.1",
  ]) {
    assert.equal(isPublicAddress(address), false, address);
  }
});

test("representações alternativas de loopback são canonizadas e bloqueadas", async (t) => {
  for (const host of [
    "127.1",
    "2130706433",
    "0x7f000001",
    "0177.0.0.1",
    "127.0.0.1.",
    "%31%32%37.0.0.1",
    "[0:0:0:0:0:0:0:1]",
  ]) {
    await t.test(host, async () => {
      const fixture = checker();
      await assert.rejects(
        fixture.check(`http://${host}`),
        failsWith("BLOCKED_ADDRESS"),
      );
      assert.equal(fixture.transport.calls.length, 0);
    });
  }
});

test("nomes locais são bloqueados mesmo se o DNS simulado devolver IP público", async (t) => {
  for (const hostname of [
    "localhost",
    "LOCALHOST.",
    "app.localhost",
    "printer.local",
  ]) {
    await t.test(hostname, async () => {
      const fixture = checker();
      await assert.rejects(
        fixture.check(`http://${hostname}`),
        failsWith("BLOCKED_ADDRESS"),
      );
      assert.equal(fixture.lookups.length, 0);
      assert.equal(fixture.transport.calls.length, 0);
    });
  }
});

test("GET público usa exclusivamente o IP validado, preservando Host, SNI e caminho", async () => {
  const fixture = checker();
  assert.deepEqual(
    await fixture.check("https://example.com:8443/path?q=1#ignored"),
    { status: 200, origin: "https://example.com:8443" },
  );
  assert.deepEqual(fixture.lookups, [
    { hostname: "example.com", options: { all: true, verbatim: true } },
  ]);
  assert.equal(fixture.transport.calls.length, 1);
  const { options } = fixture.transport.calls[0];
  assert.equal(options.hostname, PUBLIC_IPV4);
  assert.equal(options.family, 4);
  assert.equal(Number(options.port), 8443);
  assert.equal(options.method, "GET");
  assert.equal(options.path, "/path?q=1");
  assert.equal(options.headers.Host, "example.com:8443");
  assert.equal(options.headers["Accept-Encoding"], "identity");
  assert.equal(options.servername, "example.com");
  assert.equal(options.rejectUnauthorized, true);
  assert.equal(options.agent, false);
  assert.equal(options.maxHeaderSize, 16 * 1024);
});

test("IP público literal não aciona DNS e IPv6 conserva Host com colchetes", async () => {
  for (const address of [PUBLIC_IPV4, PUBLIC_IPV6]) {
    const fixture = checker();
    const authority = address.includes(":") ? `[${address}]` : address;
    const result = await fixture.check(`https://${authority}:8443`);
    assert.equal(result.status, 200);
    assert.equal(fixture.lookups.length, 0);
    assert.equal(fixture.transport.calls[0].options.hostname, address);
    assert.equal(
      fixture.transport.calls[0].options.headers.Host,
      `${authority}:8443`,
    );
    assert.equal(fixture.transport.calls[0].options.servername, "");
  }
});

test("DNS privado e respostas mistas são recusados antes da conexão", async (t) => {
  const answers = [
    [{ address: "192.168.1.10", family: 4 }],
    [
      { address: PUBLIC_IPV4, family: 4 },
      { address: "10.0.0.1", family: 4 },
    ],
    [
      { address: PUBLIC_IPV6, family: 6 },
      { address: "::1", family: 6 },
    ],
    [
      { address: PUBLIC_IPV4, family: 4 },
      { address: "fd00::1", family: 6 },
    ],
    [{ address: "169.254.169.254", family: 4 }],
    [{ address: "::ffff:127.0.0.1", family: 6 }],
  ];
  for (const addresses of answers) {
    await t.test(JSON.stringify(addresses), async () => {
      const fixture = checker({ addresses });
      await assert.rejects(
        fixture.check("https://example.com"),
        failsWith("BLOCKED_ADDRESS"),
      );
      assert.equal(fixture.transport.calls.length, 0);
    });
  }
});

test("DNS vazio, inválido ou falho produz erro sanitizado e nenhuma conexão", async (t) => {
  for (const addresses of [
    [],
    null,
    [{ address: "bad-address", family: 4 }],
    [{ address: PUBLIC_IPV4, family: 6 }],
  ]) {
    await t.test(JSON.stringify(addresses), async () => {
      const fixture = checker({ addresses });
      await assert.rejects(fixture.check("example.com"), (error) => {
        assert.ok(error instanceof StatusCheckError);
        assert.ok(["DNS_ERROR", "BLOCKED_ADDRESS"].includes(error.code));
        return true;
      });
      assert.equal(fixture.transport.calls.length, 0);
    });
  }
  const fixture = checker({
    lookup: async () => {
      throw new Error("ENOTFOUND secret.internal");
    },
  });
  await assert.rejects(fixture.check("example.com"), failsWith("DNS_ERROR"));
  assert.equal(fixture.transport.calls.length, 0);
});

test("DNS rebinding não faz nova resolução nem altera o endereço de conexão", async () => {
  let answers = 0;
  const fixture = checker({
    lookup: async () =>
      ++answers === 1
        ? [{ address: PUBLIC_IPV4, family: 4 }]
        : [{ address: "127.0.0.1", family: 4 }],
  });
  await fixture.check("https://rebind.example");
  assert.equal(answers, 1);
  assert.equal(fixture.transport.calls[0].options.hostname, PUBLIC_IPV4);
  assert.equal(fixture.transport.calls[0].options.agent, false);
});

test("todos os endereços DNS públicos são aceitos, incluindo IPv6", async () => {
  const fixture = checker({
    addresses: [
      { address: PUBLIC_IPV6, family: 6 },
      { address: PUBLIC_IPV4, family: 4 },
    ],
  });
  await fixture.check("example.com");
  assert.equal(fixture.transport.calls[0].options.hostname, PUBLIC_IPV6);
  assert.equal(fixture.transport.calls[0].options.family, 6);
});

test("2xx, 3xx, 4xx e 5xx retornam somente status, sem seguir redirects ou expor corpo", async (t) => {
  for (const status of [200, 204, 301, 302, 307, 308, 404, 429, 500, 503]) {
    await t.test(String(status), async () => {
      const transport = fakeTransport({
        status,
        headers: {
          location: "http://169.254.169.254/latest/meta-data/",
          "x-secret": "not-for-output",
        },
        chunks: [Buffer.from("remote secret body")],
      });
      const fixture = checker({ transport });
      assert.deepEqual(
        await fixture.check("https://example.com/path?private=value"),
        { status, origin: "https://example.com" },
      );
      assert.equal(fixture.lookups.length, 1);
      assert.equal(transport.calls.length, 1);
    });
  }
});

test("timeout cobre DNS e ignora resultado tardio sem iniciar transporte", async () => {
  let finishDns;
  const fixture = checker({
    timeoutMs: 20,
    lookup: () =>
      new Promise((resolve) => {
        finishDns = resolve;
      }),
  });
  await assert.rejects(fixture.check("example.com"), failsWith("TIMEOUT"));
  finishDns([{ address: PUBLIC_IPV4, family: 4 }]);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(fixture.transport.calls.length, 0);
});

test("timeout cobre espera por conexão e destrói requisição", async () => {
  const transport = fakeTransport();
  transport.request = (options) => {
    const req = new EventEmitter();
    req.destroyed = false;
    req.end = () => req;
    req.destroy = () => {
      req.destroyed = true;
      return req;
    };
    transport.calls.push({ options, req });
    return req;
  };
  const fixture = checker({ transport, timeoutMs: 20 });
  await assert.rejects(fixture.check("example.com"), failsWith("TIMEOUT"));
  assert.equal(transport.calls[0].req.destroyed, true);
});

test("timeout total também encerra resposta que não termina", async () => {
  const transport = fakeTransport({ stall: true });
  const fixture = checker({ transport, timeoutMs: 20 });
  await assert.rejects(fixture.check("example.com"), failsWith("TIMEOUT"));
  assert.equal(transport.calls[0].req.destroyed, true);
  assert.equal(transport.calls[0].response.destroyed, true);
});

test("limite de corpo usa bytes recebidos mesmo sem Content-Length", async () => {
  const transport = fakeTransport({
    chunks: [Buffer.from("áá"), Buffer.from("á")],
  });
  const fixture = checker({ transport, maxResponseBytes: 5 });
  await assert.rejects(
    fixture.check("example.com"),
    failsWith("RESPONSE_TOO_LARGE"),
  );
  assert.equal(transport.calls[0].req.destroyed, true);
  assert.equal(transport.calls[0].response.destroyed, true);
});

test("corpo exatamente no limite permitido passa", async () => {
  const fixture = checker({
    transport: fakeTransport({ chunks: [Buffer.from("12345")] }),
    maxResponseBytes: 5,
  });
  assert.equal((await fixture.check("example.com")).status, 200);
});

test("Content-Length acima do limite é rejeitado sem consumir corpo", async () => {
  const transport = fakeTransport({
    headers: { "content-length": "100" },
    stall: true,
  });
  const fixture = checker({ transport, maxResponseBytes: 5 });
  await assert.rejects(
    fixture.check("example.com"),
    failsWith("RESPONSE_TOO_LARGE"),
  );
  assert.equal(transport.calls[0].req.destroyed, true);
});

test("erros de conexão, TLS e cabeçalhos são sanitizados", async (t) => {
  for (const message of [
    "ECONNREFUSED 127.0.0.1:80 secret",
    "certificate secret.internal failed",
    "HPE_HEADER_OVERFLOW secret",
  ]) {
    await t.test(message.split(" ")[0], async () => {
      const fixture = checker({
        transport: fakeTransport({ error: new Error(message) }),
      });
      await assert.rejects(
        fixture.check("example.com"),
        failsWith("CONNECTION_ERROR"),
      );
    });
  }
});

test("falha síncrona de transporte é sanitizada", async () => {
  const fixture = checker({
    transport: {
      calls: [],
      request() {
        throw new Error("secret transport failure");
      },
    },
  });
  await assert.rejects(
    fixture.check("example.com"),
    failsWith("CONNECTION_ERROR"),
  );
});

test("resposta abortada é falha de conexão e não sucesso parcial", async () => {
  const fixture = checker({ transport: fakeTransport({ abort: true }) });
  await assert.rejects(
    fixture.check("example.com"),
    failsWith("CONNECTION_ERROR"),
  );
});

class MemorySocket extends Duplex {
  constructor(rawResponse) {
    super();
    this.rawResponse = rawResponse;
    this.written = "";
    this.responded = false;
    this.connecting = false;
  }
  _read() {}
  _write(chunk, encoding, callback) {
    this.written += chunk.toString();
    callback();
    if (!this.responded && this.written.includes("\r\n\r\n")) {
      this.responded = true;
      queueMicrotask(() => {
        if (!this.destroyed) {
          this.push(this.rawResponse);
          this.push(null);
        }
      });
    }
  }
  setTimeout() {
    return this;
  }
  setNoDelay() {
    return this;
  }
  setKeepAlive() {
    return this;
  }
  ref() {
    return this;
  }
  unref() {
    return this;
  }
}

test("transporte HTTP nativo conecta ao IP validado mesmo com DNS rebind e proxy no ambiente", async (t) => {
  let resolutions = 0;
  let connectionOptions;
  let socket;
  t.mock.method(http.Agent.prototype, "createConnection", (options) => {
    connectionOptions = options;
    socket = new MemorySocket(
      "HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nok",
    );
    return socket;
  });
  const restoreProxy = http.setGlobalProxyFromEnv({
    HTTP_PROXY: "http://127.0.0.1:9",
    HTTPS_PROXY: "http://127.0.0.1:9",
  });
  t.after(restoreProxy);
  const check = createStatusChecker({
    lookup: async () =>
      ++resolutions === 1
        ? [{ address: PUBLIC_IPV4, family: 4 }]
        : [{ address: "127.0.0.1", family: 4 }],
  });
  assert.deepEqual(await check("http://rebind.example/check"), {
    status: 200,
    origin: "http://rebind.example",
  });
  assert.equal(resolutions, 1);
  assert.equal(connectionOptions.host, PUBLIC_IPV4);
  assert.equal(connectionOptions.family, 4);
  assert.match(socket.written, /^GET \/check HTTP\/1\.1\r\n/);
  assert.match(socket.written, /\r\nHost: rebind\.example\r\n/i);
});

test("transporte HTTP nativo conecta diretamente ao IPv6 público literal", async (t) => {
  let connectionOptions;
  let socket;
  t.mock.method(http.Agent.prototype, "createConnection", (options) => {
    connectionOptions = options;
    socket = new MemorySocket(
      "HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nok",
    );
    return socket;
  });
  const check = createStatusChecker();
  assert.deepEqual(await check(`http://[${PUBLIC_IPV6}]/check`), {
    status: 200,
    origin: `http://[${PUBLIC_IPV6}]`,
  });
  assert.equal(connectionOptions.host, PUBLIC_IPV6);
  assert.equal(connectionOptions.family, 6);
  assert.match(socket.written, /\r\nHost: \[2606:4700:4700::1111\]\r\n/i);
});

test("transporte HTTPS nativo recebe IP validado, SNI original e verificação TLS obrigatória", async (t) => {
  let connectionOptions;
  t.mock.method(https.Agent.prototype, "createConnection", (options) => {
    connectionOptions = options;
    return new MemorySocket(
      "HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nok",
    );
  });
  const check = createStatusChecker({
    lookup: async () => [{ address: PUBLIC_IPV4, family: 4 }],
  });
  assert.deepEqual(await check("https://example.com"), {
    status: 200,
    origin: "https://example.com",
  });
  assert.equal(connectionOptions.host, PUBLIC_IPV4);
  assert.equal(connectionOptions.servername, "example.com");
  assert.equal(connectionOptions.rejectUnauthorized, true);
});

test("parser HTTP nativo rejeita cabeçalhos acima de 16 KiB", async (t) => {
  let socket;
  t.mock.method(http.Agent.prototype, "createConnection", () => {
    socket = new MemorySocket(
      `HTTP/1.1 200 OK\r\nX-Large: ${"x".repeat(17 * 1024)}\r\nContent-Length: 0\r\n\r\n`,
    );
    return socket;
  });
  const check = createStatusChecker({
    lookup: async () => [{ address: PUBLIC_IPV4, family: 4 }],
  });
  await assert.rejects(
    check("http://example.com"),
    failsWith("CONNECTION_ERROR"),
  );
  assert.equal(socket.destroyed, true);
});

test("stream HTTP nativo encerra corpo chunked acima do limite", async (t) => {
  let socket;
  t.mock.method(http.Agent.prototype, "createConnection", () => {
    socket = new MemorySocket(
      "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n3\r\none\r\n3\r\ntwo\r\n0\r\n\r\n",
    );
    return socket;
  });
  const check = createStatusChecker({
    lookup: async () => [{ address: PUBLIC_IPV4, family: 4 }],
    maxResponseBytes: 5,
  });
  await assert.rejects(
    check("http://example.com"),
    failsWith("RESPONSE_TOO_LARGE"),
  );
  assert.equal(socket.destroyed, true);
});

test("redirect HTTP nativo para metadata não cria segunda conexão", async (t) => {
  let connections = 0;
  t.mock.method(http.Agent.prototype, "createConnection", () => {
    connections++;
    return new MemorySocket(
      "HTTP/1.1 302 Found\r\nLocation: http://169.254.169.254/latest/meta-data/\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
    );
  });
  const check = createStatusChecker({
    lookup: async () => [{ address: PUBLIC_IPV4, family: 4 }],
  });
  assert.deepEqual(await check("http://example.com"), {
    status: 302,
    origin: "http://example.com",
  });
  assert.equal(connections, 1);
});

test("upgrade HTTP nativo é rejeitado e socket é destruído", async (t) => {
  let socket;
  t.mock.method(http.Agent.prototype, "createConnection", () => {
    socket = new MemorySocket(
      "HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n",
    );
    return socket;
  });
  const check = createStatusChecker({
    lookup: async () => [{ address: PUBLIC_IPV4, family: 4 }],
  });
  await assert.rejects(
    check("http://example.com"),
    failsWith("CONNECTION_ERROR"),
  );
  assert.equal(socket.destroyed, true);
});
