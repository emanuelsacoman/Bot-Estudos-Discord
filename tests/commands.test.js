const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const https = require("node:https");
const net = require("node:net");
const path = require("node:path");
const test = require("node:test");
const tls = require("node:tls");

// A conexão é sempre simulada: uma regressão que tente abrir rede deve falhar.
function guardNetwork(t) {
  const refuse = () => {
    throw new Error("Rede real proibida nos testes de comandos");
  };
  for (const transport of [http, https]) {
    t.mock.method(transport, "request", refuse);
    t.mock.method(transport, "get", refuse);
  }
  t.mock.method(net.Socket.prototype, "connect", refuse);
  t.mock.method(tls, "connect", refuse);
  t.mock.method(globalThis, "fetch", refuse);
}

async function withStatusChecker(checkStatus, run) {
  const helperPath = require.resolve("../lib/status-http");
  const commandPath = require.resolve("../commands/status");
  const previousHelper = require.cache[helperPath];
  const previousCommand = require.cache[commandPath];
  require.cache[helperPath] = {
    id: helperPath,
    filename: helperPath,
    loaded: true,
    exports: { checkStatus },
  };
  delete require.cache[commandPath];
  try {
    await run(require(commandPath));
  } finally {
    if (previousHelper) require.cache[helperPath] = previousHelper;
    else delete require.cache[helperPath];
    if (previousCommand) require.cache[commandPath] = previousCommand;
    else delete require.cache[commandPath];
  }
}

function interactionFor(input, replies) {
  return {
    options: {
      getString(name) {
        assert.equal(name, "url");
        return input;
      },
    },
    async reply(payload) {
      replies.push(payload);
    },
  };
}

function getEmbed(replies) {
  assert.equal(replies.length, 1);
  assert.equal(replies[0].embeds.length, 1);
  const embed = replies[0].embeds[0].toJSON();
  assert.equal(embed.title, "Verificação de Status");
  assert.equal(embed.footer.text, "CodeBucket");
  assert.ok(!Number.isNaN(Date.parse(embed.timestamp)));
  assert.doesNotThrow(() => JSON.stringify(embed));
  return embed;
}

test("os 23 comandos carregam e preservam seus contratos públicos do P0", (t) => {
  guardNetwork(t);
  const commandsDir = path.resolve(__dirname, "../commands");
  const names = new Set();
  const entries = fs
    .readdirSync(commandsDir)
    .filter((file) => file.endsWith(".js"))
    .sort()
    .map((file) => {
      const command = require(path.join(commandsDir, file));
      assert.equal(typeof command.execute, "function", file);
      assert.equal(typeof command.data?.toJSON, "function", file);
      const data = command.data.toJSON();
      assert.ok(!names.has(data.name), `Nome duplicado: ${data.name}`);
      names.add(data.name);
      return { file, data };
    });
  assert.equal(entries.length, 23);
  // JSON público obtido da base develop / 49138e6, sem executar entradas.
  const digest = crypto
    .createHash("sha256")
    .update(JSON.stringify(entries))
    .digest("hex");
  assert.equal(
    digest,
    "e50cb9e0df937132bf0381b136a80cab6e46bdd0186f69490a825961b9d53f15",
  );
  const status = entries.find(({ data }) => data.name === "status").data;
  assert.equal(status.options.length, 1);
  assert.equal(status.options[0].name, "url");
  assert.equal(status.options[0].type, 3);
  assert.equal(status.options[0].required, true);
});

for (const status of [200, 204, 302, 404, 503]) {
  test(`/status responde uma vez e mantém o embed para HTTP ${status}`, async (t) => {
    guardNetwork(t);
    const input = "example.com/caminho?valor=sentinela-de-teste";
    const replies = [];
    let checks = 0;
    await withStatusChecker(
      async (received) => {
        checks += 1;
        assert.equal(received, input);
        return { origin: "https://example.com", status };
      },
      async (command) => command.execute(interactionFor(input, replies)),
    );
    assert.equal(checks, 1);
    const embed = getEmbed(replies);
    assert.equal(embed.color, status < 300 ? 0x00ff00 : 0xff0000);
    assert.match(embed.description, new RegExp(String(status)));
    assert.match(embed.description, /example\.com/);
    assert.match(embed.description, status < 300 ? /Online/ : /Offline/);
    assert.doesNotMatch(
      JSON.stringify(replies),
      /caminho|valor=|sentinela-de-teste/,
    );
  });
}

test("falhas de URL, DNS e conexão têm resposta genérica sem dados ou logs", async (t) => {
  guardNetwork(t);
  const logs = [];
  for (const method of ["log", "warn", "error"]) {
    t.mock.method(console, method, (...args) => logs.push(args));
  }
  const descriptions = new Set();
  for (const code of [
    "INVALID_URL",
    "BLOCKED_ADDRESS",
    "DNS_ERROR",
    "CONNECTION_ERROR",
    "TIMEOUT",
    "RESPONSE_TOO_LARGE",
  ]) {
    const input =
      "https://usuario-de-teste:senha-de-teste@example.com/privado?valor=sentinela";
    const replies = [];
    await withStatusChecker(
      async () => {
        const failure = new Error(
          "detalhe-interno-de-teste 10.0.0.1 corpo-remoto-de-teste",
        );
        failure.code = code;
        failure.response = {
          status: 502,
          data: "corpo-remoto-de-teste",
          headers: { "x-internal": "detalhe-interno-de-teste" },
        };
        throw failure;
      },
      async (command) => command.execute(interactionFor(input, replies)),
    );
    const embed = getEmbed(replies);
    assert.equal(embed.color, 0xff0000);
    assert.doesNotMatch(
      JSON.stringify(replies),
      /usuario-de-teste|senha-de-teste|example\.com|privado|sentinela|10\.0\.0\.1|detalhe-interno|corpo-remoto|502|DNS_ERROR|CONNECTION_ERROR/,
    );
    descriptions.add(embed.description);
  }
  assert.equal(descriptions.size, 1);
  assert.deepEqual(logs, []);
});

test("falha do reply propaga sem tentar enviar uma segunda resposta", async (t) => {
  guardNetwork(t);
  let replies = 0;
  const rejectedReply = new Error("falha simulada do Discord");
  const interaction = interactionFor("example.com", []);
  interaction.reply = async () => {
    replies += 1;
    throw rejectedReply;
  };
  await withStatusChecker(
    async () => ({ origin: "https://example.com", status: 200 }),
    async (command) => {
      await assert.rejects(command.execute(interaction), (error) => {
        assert.equal(error, rejectedReply);
        return true;
      });
    },
  );
  assert.equal(replies, 1);
});
