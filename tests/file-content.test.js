const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const https = require("node:https");
const net = require("node:net");
const tls = require("node:tls");
const { beforeEach, test } = require("node:test");
const qrcode = require("qrcode");
const prettier = require("prettier");
const qrCommand = require("../commands/qrcode");
const formatCommand = require("../commands/formatar");
const { runWithErrorHandling } = require("../lib/interactions");
const {
  DISCORD_LIMITS: limits,
  MAX_TEXT_ATTACHMENT_BYTES,
  validText,
  textPayload,
  textAttachment,
  embedFits,
  embedPayload,
} = require("../lib/content-limits");

beforeEach((t) => {
  const refuse = () => {
    throw new Error("Rede/arquivo real proibido");
  };
  for (const transport of [http, https])
    t.mock.method(transport, "request", refuse);
  t.mock.method(net.Socket.prototype, "connect", refuse);
  t.mock.method(tls, "connect", refuse);
  t.mock.method(globalThis, "fetch", refuse);
  for (const method of [
    "writeFile",
    "writeFileSync",
    "createWriteStream",
    "unlink",
    "unlinkSync",
  ]) {
    t.mock.method(fs, method, refuse);
  }
  t.mock.method(fs.promises, "writeFile", refuse);
  t.mock.method(qrcode, "toFile", refuse);
});

function interaction(strings, fail) {
  return {
    createdTimestamp: Date.now(),
    deferred: false,
    replied: false,
    ephemeral: false,
    options: { getString: (key) => strings[key] },
    events: [],
    async deferReply() {
      this.events.push(["defer"]);
      this.deferred = true;
    },
    async reply(payload) {
      this.events.push(["reply", payload]);
      this.replied = true;
    },
    async editReply(payload) {
      this.events.push(["edit", payload]);
      if (fail) throw new Error("private-send-sentinel");
      this.replied = true;
    },
    async followUp(payload) {
      this.events.push(["follow", payload]);
    },
    async deleteReply() {
      this.events.push(["delete"]);
    },
  };
}
const lastPayload = (it) =>
  it.events.findLast(([, p]) => p?.files || p?.embeds || p?.ephemeral)?.[1];
const attachedText = (payload) => payload.files[0].attachment.toString("utf8");

test("textos: vazio, limite, excesso, Unicode e surrogate isolado", () => {
  for (const input of [undefined, null, 42, {}, "", " \n\t", "\ud800"])
    assert.equal(validText(input), false);
  assert.equal(validText("🧑🏽‍💻ação é\n<>&`"), true);
  assert.equal(validText("x".repeat(6000)), true);
  assert.equal(validText("x".repeat(6001)), false);
  assert.equal(textPayload("x".repeat(2000)).length, 2000);
  const text = "😀".repeat(1000) + "é";
  assert.equal(attachedText(textPayload(text)), text);
});

test("anexo tem orçamento em bytes UTF-8 sem truncamento", () => {
  const text = "😀".repeat(MAX_TEXT_ATTACHMENT_BYTES / 4);
  assert.equal(
    textAttachment(text).files[0].attachment.length,
    MAX_TEXT_ATTACHMENT_BYTES,
  );
  assert.throws(() => textAttachment(text + "a"), RangeError);
});

for (const [part, max] of [
  ["title", limits.title],
  ["description", limits.description],
]) {
  test(`embed ${part}: limite exato e excesso preservado em anexo`, () => {
    const raw = { [part]: "x".repeat(max) };
    assert.equal(embedFits(raw), true);
    assert.equal(embedPayload(raw).embeds[0].toJSON()[part].length, max);
    raw[part] += "😀";
    assert.equal(embedFits(raw), false);
    assert.equal(attachedText(embedPayload(raw)), raw[part]);
  });
}

test("campos/autor/rodapé: fronteiras e total agregado de 6000", () => {
  const raw = {
    title: "t".repeat(256),
    description: "d".repeat(4096),
    fields: [{ name: "n".repeat(256), value: "v".repeat(1024) }],
    footer: { text: "f".repeat(112) },
    author: { name: "a".repeat(256) },
  };
  assert.equal(embedFits(raw), true);
  raw.footer.text += "x";
  assert.equal(embedFits(raw), false);
  assert.ok(attachedText(embedPayload(raw)).includes(raw.description));
  for (const [key, max] of [
    ["name", 256],
    ["value", 1024],
  ]) {
    assert.equal(
      embedFits({
        fields: [{ name: "n", value: "v", [key]: "x".repeat(max) }],
      }),
      true,
    );
    assert.equal(
      embedFits({
        fields: [{ name: "n", value: "v", [key]: "x".repeat(max + 1) }],
      }),
      false,
    );
  }
  assert.equal(
    embedFits({
      fields: Array.from({ length: 25 }, () => ({ name: "n", value: "v" })),
    }),
    true,
  );
  assert.equal(
    embedFits({
      fields: Array.from({ length: 26 }, () => ({ name: "n", value: "v" })),
    }),
    false,
  );
  assert.equal(
    embedFits({
      footer: { text: "x".repeat(2048) },
      author: { name: "x".repeat(256) },
    }),
    true,
  );
  assert.equal(embedFits({ footer: { text: "x".repeat(2049) } }), false);
  assert.equal(embedFits({ author: { name: "x".repeat(257) } }), false);
});

test("QR real gera PNG em Buffer sem tocar filesystem", async () => {
  const it = interaction({ link: "https://example.com/ação?emoji=😀" });
  await qrCommand.execute(it);
  const payload = lastPayload(it);
  assert.equal(it.events[0][0], "defer");
  assert.equal(payload.files[0].name, "qrcode.png");
  assert.equal(
    payload.files[0].attachment.subarray(0, 8).toString("hex"),
    "89504e470d0a1a0a",
  );
  assert.equal(payload.embeds[0].toJSON().image.url, "attachment://qrcode.png");
});

for (const value of [null, "", "  ", "\ud800", "0".repeat(5597)]) {
  test(`QR recusa entrada inválida (${typeof value}/${value?.length}) sem gerar`, async (t) => {
    t.mock.method(qrcode, "toBuffer", () => assert.fail("geração indevida"));
    const it = interaction({ link: value });
    await qrCommand.execute(it);
    assert.equal(it.events[0][0], "reply");
    assert.equal(Boolean(it.events[0][1].flags & 64), true);
  });
}

test("QR limite numérico/M e descrição extensa preservam texto integral", async () => {
  const link = "1".repeat(5596);
  const it = interaction({ link });
  await qrCommand.execute(it);
  const payload = lastPayload(it);
  assert.equal(payload.files[1].attachment.toString(), link);
  assert.ok(payload.embeds[0].toJSON().description.length < 4096);
});

test("QR acima da capacidade UTF-8 tem erro privado depois do defer", async () => {
  const it = interaction({ link: "😀".repeat(600) });
  await qrCommand.execute(it);
  assert.deepEqual(
    it.events.map(([event]) => event),
    ["defer", "edit", "follow", "delete"],
  );
  assert.equal(Boolean(it.events[2][1].flags & 64), true);
  assert.equal(
    it.events.some(([, p]) => p?.files),
    false,
  );
});

test("QR captura rejeição de geração sem vazar erro bruto", async (t) => {
  t.mock.method(qrcode, "toBuffer", async () => {
    throw new Error("private-generate-sentinel");
  });
  const it = interaction({ link: "ok" });
  await qrCommand.execute(it);
  assert.equal(
    it.events.some(([, p]) => p?.files),
    false,
  );
  assert.doesNotMatch(JSON.stringify(it.events), /private-generate-sentinel/);
});

test("QR concorrentes têm Buffers independentes mesmo com mesmo nome", async (t) => {
  const pending = new Map();
  t.mock.method(
    qrcode,
    "toBuffer",
    (link) => new Promise((resolve) => pending.set(link, resolve)),
  );
  const a = interaction({ link: "primeiro" });
  const b = interaction({ link: "segundo" });
  const executions = [qrCommand.execute(a), qrCommand.execute(b)];
  await new Promise(setImmediate);
  pending.get("segundo")(Buffer.from("segundo"));
  pending.get("primeiro")(Buffer.from("primeiro"));
  await Promise.all(executions);
  assert.equal(attachedText(lastPayload(a)), "primeiro");
  assert.equal(attachedText(lastPayload(b)), "segundo");
  assert.notEqual(
    lastPayload(a).files[0].attachment,
    lastPayload(b).files[0].attachment,
  );
});

test("QR falha de envio após defer é capturada uma vez sem retry/arquivo", async (t) => {
  t.mock.method(console, "error", () => {});
  t.mock.method(qrcode, "toBuffer", async () => Buffer.from("png"));
  const it = interaction({ link: "ok" }, true);
  await runWithErrorHandling(it, () => qrCommand.execute(it));
  assert.deepEqual(
    it.events.map(([event]) => event),
    ["defer", "edit"],
  );
});

for (const codigo of ["", "  ", null, "x".repeat(6001), "\ud800"]) {
  test(`formatar rejeita entrada inválida (${typeof codigo}/${codigo?.length}) antes do Prettier`, async (t) => {
    t.mock.method(prettier, "format", () => assert.fail("formatação indevida"));
    const it = interaction({ linguagem: "babel", codigo });
    await formatCommand.execute(it);
    assert.deepEqual(
      it.events.map(([event]) => event),
      ["reply"],
    );
  });
}

test("formatar aceita entrada no teto slash e recusa parser fora das choices", async (t) => {
  let calls = 0;
  t.mock.method(prettier, "format", async (code) => {
    calls += 1;
    assert.equal(code.length, 6000);
    return "const a = 1;\n";
  });
  await formatCommand.execute(
    interaction({ linguagem: "babel", codigo: "x".repeat(6000) }),
  );
  await formatCommand.execute(
    interaction({ linguagem: "typescript", codigo: "x" }),
  );
  assert.equal(calls, 1);
});

test("formatar respeita 1024 incluindo cercas e anexa excesso sem perda Unicode", async (t) => {
  const budget = 1024 - "```babel\n\n```".length;
  let result = "x".repeat(budget);
  t.mock.method(prettier, "format", async () => result);
  const exact = interaction({ linguagem: "babel", codigo: "input" });
  await formatCommand.execute(exact);
  assert.equal(
    lastPayload(exact).embeds[0].toJSON().fields[0].value.length,
    1024,
  );
  result += "😀é";
  const large = interaction({ linguagem: "babel", codigo: "input" });
  await formatCommand.execute(large);
  assert.equal(attachedText(lastPayload(large)), result);
});

test("formatar Markdown com cercas é anexo integral", async () => {
  const input = "# Código\n\n```js\nconst a=1;\n```\n";
  const expected = await prettier.format(input, { parser: "markdown" });
  const it = interaction({ linguagem: "markdown", codigo: input });
  await formatCommand.execute(it);
  assert.equal(lastPayload(it).files[0].name, "codigo-formatado.md");
  assert.equal(attachedText(lastPayload(it)), expected);
});

test("formatar saída excessiva tem aviso específico privado após defer", async (t) => {
  t.mock.method(prettier, "format", async () =>
    "😀".repeat(MAX_TEXT_ATTACHMENT_BYTES / 4 + 1),
  );
  const it = interaction({ linguagem: "babel", codigo: "input" });
  await formatCommand.execute(it);
  const payload = it.events.find(([event]) => event === "follow")[1];
  assert.match(payload.content, /1 MiB/);
  assert.doesNotMatch(payload.content, /sintaxe/);
  assert.equal(Boolean(payload.flags & 64), true);
  assert.equal(
    it.events.some(([, p]) => p?.files),
    false,
  );
});
