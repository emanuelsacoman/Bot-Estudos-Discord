const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  readConfig,
  configurationMessage,
  ConfigurationError,
} = require("../lib/config");

const FAKE_TOKEN = "x".repeat(32);
const CLIENT_ID = "1234567890123456789";

function failsWith(code) {
  return (error) => {
    assert.ok(error instanceof ConfigurationError);
    assert.equal(error.code, code);
    assert.doesNotMatch(error.message, /SENSITIVE_SENTINEL|xxxxxxxxxxxxxxxx/);
    assert.equal(error.cause, undefined);
    const message = configurationMessage(error);
    assert.equal(typeof message, "string");
    assert.ok(message.length > 0);
    assert.doesNotMatch(message, /SENSITIVE_SENTINEL|xxxxxxxxxxxxxxxx/);
    return true;
  };
}

test("runtime exige somente TOKEN e devolve configuração mínima", () => {
  assert.deepEqual(readConfig({ TOKEN: FAKE_TOKEN }), { token: FAKE_TOKEN });
  assert.deepEqual(
    readConfig({ TOKEN: FAKE_TOKEN, CLIENT_ID: "invalid-ignored" }),
    { token: FAKE_TOKEN },
  );
});

test("TOKEN é tratado como valor opaco sem exigir partes JWT ou decodificação", () => {
  for (const token of [
    "x".repeat(20),
    "x".repeat(512),
    "opaque_TOKEN-1234567890.value",
  ]) {
    assert.deepEqual(readConfig({ TOKEN: token }), { token });
  }
});

test("prefixos convencionais Bot e Bearer são removidos como no SDK", () => {
  for (const prefix of ["Bot ", "bot ", "Bearer ", "bEaReR\t"]) {
    assert.deepEqual(readConfig({ TOKEN: `${prefix}${FAKE_TOKEN}` }), {
      token: FAKE_TOKEN,
    });
  }
});

test("TOKEN ausente ou vazio falha antes de qualquer autenticação", async (t) => {
  for (const value of [undefined, null, ""]) {
    await t.test(String(value), () => {
      assert.throws(
        () => readConfig({ TOKEN: value }),
        failsWith("TOKEN_REQUIRED"),
      );
    });
  }
});

test("TOKEN rejeita whitespace residual, controles, Unicode e valores malformados", async (t) => {
  const invalid = [
    "short",
    "x".repeat(513),
    ` ${FAKE_TOKEN}`,
    `${FAKE_TOKEN} `,
    `${FAKE_TOKEN}\n`,
    `${FAKE_TOKEN}\r`,
    `${FAKE_TOKEN}\t`,
    `${FAKE_TOKEN}\u0000`,
    `${FAKE_TOKEN}é`,
    `${FAKE_TOKEN}/`,
    `${FAKE_TOKEN}=`,
    `${FAKE_TOKEN}+`,
    `${FAKE_TOKEN.slice(0, 10)} ${FAKE_TOKEN.slice(10)}`,
    `Bot ${FAKE_TOKEN} `,
    12345,
    {},
    [],
    true,
  ];
  for (const [index, token] of invalid.entries()) {
    await t.test(`caso ${index + 1}`, () => {
      assert.throws(
        () => readConfig({ TOKEN: token }),
        failsWith("TOKEN_INVALID"),
      );
    });
  }
});

test("TOKEN rejeita placeholders reconhecidos sem simular credenciais reais", async (t) => {
  for (const token of [
    "COLOQUE_SEU_TOKEN_AQUI",
    "your_discord_bot_token_here",
    "SEU_TOKEN_DO_DISCORD_AQUI",
    "SUBSTITUA_PELO_TOKEN_DO_BOT",
    "REPLACE_WITH_TOKEN_HERE",
  ]) {
    await t.test(token, () => {
      assert.throws(
        () => readConfig({ TOKEN: token }),
        failsWith("TOKEN_INVALID"),
      );
    });
  }
});

test("registro exige CLIENT_ID e preserva strings decimais canônicas", () => {
  assert.deepEqual(
    readConfig({ TOKEN: FAKE_TOKEN, CLIENT_ID }, { registration: true }),
    { token: FAKE_TOKEN, clientId: CLIENT_ID },
  );
  for (const clientId of ["12345678901234567", "18446744073709551615"]) {
    assert.equal(
      readConfig(
        { TOKEN: FAKE_TOKEN, CLIENT_ID: clientId },
        { registration: true },
      ).clientId,
      clientId,
    );
  }
});

test("CLIENT_ID obrigatório é validado somente após TOKEN válido", () => {
  assert.throws(
    () => readConfig({}, { registration: true }),
    failsWith("TOKEN_REQUIRED"),
  );
  for (const clientId of [undefined, null, ""]) {
    assert.throws(
      () =>
        readConfig(
          { TOKEN: FAKE_TOKEN, CLIENT_ID: clientId },
          { registration: true },
        ),
      failsWith("CLIENT_ID_REQUIRED"),
    );
  }
});

test("registro rejeita CLIENT_ID não canônico, fora da faixa ou do tipo correto", async (t) => {
  const invalid = [
    "0",
    "00000000000000000",
    "0123456789012345678",
    "1234567890123456",
    "123456789012345678901",
    "18446744073709551616",
    ` ${CLIENT_ID}`,
    `${CLIENT_ID} `,
    `${CLIENT_ID}\n`,
    `+${CLIENT_ID}`,
    "1.234567890123456789e18",
    "SENSITIVE_SENTINEL",
    1234567890123456789,
    {},
    [],
    true,
  ];
  for (const [index, clientId] of invalid.entries()) {
    await t.test(`caso ${index + 1}`, () => {
      assert.throws(
        () =>
          readConfig(
            { TOKEN: FAKE_TOKEN, CLIENT_ID: clientId },
            { registration: true },
          ),
        failsWith("CLIENT_ID_INVALID"),
      );
    });
  }
});

test("mensagem de erro de configuração nunca usa o erro bruto como fallback", () => {
  assert.equal(
    configurationMessage(new Error("SENSITIVE_SENTINEL")),
    undefined,
  );
  assert.equal(configurationMessage(undefined), undefined);
});
