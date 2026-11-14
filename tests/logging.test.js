const assert = require("node:assert/strict");
const { test } = require("node:test");
const { safeLog } = require("../lib/logging");

const SENTINEL = "SENSITIVE_LOGGING_SENTINEL";
const nextTurn = () => new Promise((resolve) => setImmediate(resolve));

for (const level of ["log", "warn", "error"]) {
  test(`safeLog entrega uma string única no nível ${level}`, () => {
    const calls = [];
    const logger = {
      [level](...args) {
        assert.equal(this, logger);
        calls.push(args);
      },
    };
    assert.equal(safeLog(level, "Diagnóstico operacional.", logger), true);
    assert.deepEqual(calls, [["Diagnóstico operacional."]]);
  });
}

test("safeLog usa o console atual no momento da chamada", (t) => {
  const first = [];
  t.mock.method(console, "log", (...args) => first.push(args));
  assert.equal(safeLog("log", "Primeiro diagnóstico."), true);
  const second = [];
  t.mock.method(console, "log", (...args) => second.push(args));
  assert.equal(safeLog("log", "Segundo diagnóstico."), true);
  assert.deepEqual(first, [["Primeiro diagnóstico."]]);
  assert.deepEqual(second, [["Segundo diagnóstico."]]);
});

for (const [name, message] of [
  ["Unicode válido", "Diagnóstico com acentos e emoji 🌎"],
  ["500 unidades UTF-16", "a".repeat(500)],
  ["500 unidades em pares surrogate", "🌎".repeat(250)],
]) {
  test(`safeLog aceita ${name} sem alterar a mensagem`, () => {
    const calls = [];
    assert.equal(
      safeLog("log", message, { log: (...args) => calls.push(args) }),
      true,
    );
    assert.deepEqual(calls, [[message]]);
  });
}

for (const [name, message] of [
  ["string vazia", ""],
  ["somente espaços", "   "],
  ["501 unidades", "a".repeat(501)],
  ["emoji acima do limite", "🌎".repeat(251)],
  ["surrogate alto isolado", "a\ud800"],
  ["surrogate baixo isolado", "a\udfff"],
  ["null", null],
  ["undefined", undefined],
  ["número", 123],
  ["boolean", true],
  ["objeto", { token: SENTINEL }],
  ["array", [SENTINEL]],
  ["Error", new Error(SENTINEL)],
]) {
  test(`safeLog recusa mensagem ${name} sem chamar o destino`, () => {
    let calls = 0;
    assert.equal(safeLog("error", message, { error: () => calls++ }), false);
    assert.equal(calls, 0);
  });
}

for (const [name, code] of [
  ["NUL", 0],
  ["TAB", 9],
  ["LF", 10],
  ["CR", 13],
  ["ESC", 27],
  ["controle final", 31],
  ["DEL", 127],
]) {
  test(`safeLog recusa controle ${name} sem publicar a linha`, () => {
    let calls = 0;
    assert.equal(
      safeLog("log", `Diagnóstico${String.fromCharCode(code)}privado`, {
        log: () => calls++,
      }),
      false,
    );
    assert.equal(calls, 0);
  });
}

for (const level of [
  "info",
  "debug",
  "trace",
  "toString",
  "__proto__",
  null,
  1,
]) {
  test(`safeLog recusa nível inválido ${String(level)}`, () => {
    let reads = 0;
    const logger = new Proxy(
      {},
      {
        get() {
          reads++;
          throw new Error(SENTINEL);
        },
      },
    );
    assert.equal(safeLog(level, "Diagnóstico.", logger), false);
    assert.equal(reads, 0);
  });
}

test("safeLog não converte objetos de mensagem ou nível para string", () => {
  let conversions = 0;
  const privateValue = {
    toString() {
      conversions++;
      throw new Error(SENTINEL);
    },
  };
  const logger = { log: () => assert.fail("destino não deve ser chamado") };
  assert.equal(safeLog("log", privateValue, logger), false);
  assert.equal(safeLog(privateValue, "Diagnóstico.", logger), false);
  assert.equal(conversions, 0);
});

for (const [name, logger] of [
  ["null", null],
  ["método ausente", {}],
  ["método não função", { error: SENTINEL }],
  [
    "getter que lança",
    {
      get error() {
        throw new Error(SENTINEL);
      },
    },
  ],
]) {
  test(`safeLog trata destino ${name} sem nova exceção`, () => {
    assert.equal(safeLog("error", "Diagnóstico.", logger), false);
  });
}

test("safeLog captura falha síncrona sem retry ou fallback de console", (t) => {
  const fallback = [];
  for (const level of ["log", "warn", "error"]) {
    t.mock.method(console, level, (...args) => fallback.push(args));
  }
  let attempts = 0;
  assert.equal(
    safeLog("error", "Diagnóstico.", {
      error() {
        attempts++;
        throw new Error(SENTINEL);
      },
    }),
    false,
  );
  assert.equal(attempts, 1);
  assert.deepEqual(fallback, []);
});

test("safeLog captura rejeição posterior sem rejeição solta ou retry", async (t) => {
  const unhandled = [];
  const fallback = [];
  const onUnhandled = (error) => unhandled.push(error);
  process.on("unhandledRejection", onUnhandled);
  t.after(() => process.off("unhandledRejection", onUnhandled));
  for (const level of ["log", "warn", "error"]) {
    t.mock.method(console, level, (...args) => fallback.push(args));
  }
  let attempts = 0;
  assert.equal(
    safeLog("warn", "Diagnóstico.", {
      warn() {
        attempts++;
        return Promise.reject(new Error(SENTINEL));
      },
    }),
    true,
  );
  await nextTurn();
  assert.equal(attempts, 1);
  assert.deepEqual(unhandled, []);
  assert.deepEqual(fallback, []);
});

test("safeLog não aguarda um destino pendente", () => {
  let attempts = 0;
  const accepted = safeLog("log", "Diagnóstico.", {
    log() {
      attempts++;
      return new Promise(() => {});
    },
  });
  assert.equal(accepted, true);
  assert.equal(attempts, 1);
});
