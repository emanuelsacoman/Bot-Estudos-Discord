const assert = require("node:assert/strict");
const dns = require("node:dns");
const dnsPromises = require("node:dns/promises");
const http = require("node:http");
const https = require("node:https");
const net = require("node:net");
const tls = require("node:tls");
const { beforeEach, test } = require("node:test");
const {
  DOCUMENTATION_SELECT_ID,
  documentationCatalog,
  validateDocumentationCatalog,
  getDocumentationOptions,
  findDocumentation,
} = require("../lib/documentation-catalog");
const {
  handleDocumentationSelect,
} = require("../lib/documentation-interactions");
const {
  InteractionResponseError,
  runWithErrorHandling,
} = require("../lib/interactions");

beforeEach((t) => {
  const blockNetwork = () => {
    throw new Error("Os testes de documentação são exclusivamente offline.");
  };
  for (const transport of [http, https]) {
    t.mock.method(transport, "request", blockNetwork);
    t.mock.method(transport, "get", blockNetwork);
  }
  t.mock.method(dns, "lookup", blockNetwork);
  t.mock.method(dnsPromises, "lookup", blockNetwork);
  t.mock.method(net.Socket.prototype, "connect", blockNetwork);
  t.mock.method(tls, "connect", blockNetwork);
  t.mock.method(globalThis, "fetch", blockNetwork);
  t.mock.method(console, "error", () => {});
  t.mock.method(console, "warn", () => {});
});

// Snapshot do menu de develop antes da P2.3: ordem e textos visíveis públicos.
const historicalOptions = [
  ["angular", "Angular", "Veja a documentação do Angular"],
  ["csharp", "C#", "Veja a documentação de C#"],
  ["cpp", "C++", "Veja a documentação de C++"],
  ["css", "CSS", "Veja a documentação de CSS"],
  ["dart", "Dart", "Veja a documentação do Dart"],
  ["discordjs", "Discord.js", "Veja a documentação de Discord.js"],
  ["git", "Git", "Veja a documentação do Git"],
  ["go", "Go", "Veja a documentação do Go"],
  ["godot", "Godot", "Veja a documentação do Godot"],
  ["html", "HTML", "Veja a documentação de HTML"],
  ["ionic", "Ionic", "Veja a documentação do Ionic"],
  ["java", "Java", "Veja a documentação de Java"],
  ["javascript", "Javascript", "Veja a documentação de Javascript"],
  ["kotlin", "Kotlin", "Veja a documentação do Kotlin"],
  ["python", "Python", "Veja a documentação de Python"],
  ["react", "React", "Veja a documentação do React"],
  ["ruby", "Ruby", "Veja a documentação do Ruby"],
  ["swift", "Swift", "Veja a documentação do Swift"],
  ["typescript", "TypeScript", "Veja a documentação de TypeScript"],
  ["unreal", "Unreal Engine", "Veja a documentação da Unreal Engine"],
  ["unity", "Unity", "Veja a documentação do Unity"],
  ["rust", "Rust", "Veja a documentação do Rust"],
  ["php", "PHP", "Veja a documentação do PHP"],
  ["vuejs", "Vue.js", "Veja a documentação do Vue.js"],
  ["jquery", "jQuery", "Veja a documentação do jQuery"],
].map(([value, label, description]) => ({ value, label, description }));

function entry(overrides = {}) {
  return {
    id: "example",
    label: "Exemplo",
    description: "Veja a documentação do exemplo",
    url: "https://example.com/docs/",
    ...overrides,
  };
}

function fixture({
  values = ["javascript"],
  customId = DOCUMENTATION_SELECT_ID,
  isSelect = true,
  deferred = false,
  replied = false,
  ephemeral = false,
  ageMs = 0,
  fail,
} = {}) {
  const calls = [];
  const interaction = {
    values,
    customId,
    deferred,
    replied,
    ephemeral,
    createdTimestamp: Date.now() - ageMs,
    isStringSelectMenu: () => isSelect,
  };
  for (const method of ["reply", "editReply", "followUp", "deleteReply"]) {
    interaction[method] = async (payload) => {
      calls.push({ method, payload });
      if (method === fail) {
        throw Object.assign(new Error("SENSITIVE_DOCUMENTATION_SENTINEL"), {
          code: 10062,
        });
      }
      if (method === "reply" || method === "editReply")
        interaction.replied = true;
      if (method === "reply")
        interaction.ephemeral = Boolean(payload?.flags & 64);
      return { id: "controlled-documentation-message" };
    };
  }
  return { interaction, calls };
}

const methods = (calls) => calls.map((call) => call.method);
const contentOf = (payload) =>
  typeof payload === "string" ? payload : payload?.content;

test("catálogo real válido preserva as 25 opções históricas e sua ordem", () => {
  assert.equal(documentationCatalog.length, 25);
  assert.deepEqual(getDocumentationOptions(), historicalOptions);
  assert.deepEqual(
    validateDocumentationCatalog(documentationCatalog),
    documentationCatalog,
  );
  assert.ok(Object.isFrozen(documentationCatalog));
  assert.ok(documentationCatalog.every(Object.isFrozen));
  assert.equal(new Set(documentationCatalog.map(({ id }) => id)).size, 25);
  for (const option of getDocumentationOptions()) {
    const technology = findDocumentation(option.value);
    assert.ok(technology);
    assert.equal(technology.label, option.label);
    assert.equal(technology.description, option.description);
    const url = new URL(technology.url);
    assert.equal(url.protocol, "https:");
    assert.equal(url.username, "");
    assert.equal(url.password, "");
  }
  assert.equal(findDocumentation("laravel"), undefined);
});

test("snapshot validado é independente e imutável", () => {
  const original = [entry()];
  const result = validateDocumentationCatalog(original);
  original[0].url = "https://changed.example.com/";
  original.push(entry({ id: "another" }));
  assert.equal(result.length, 1);
  assert.equal(result[0].url, "https://example.com/docs/");
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result[0]));
});

test("validador aceita limites de IDs/textos e exatamente 25 opções", () => {
  const entries = Array.from({ length: 25 }, (_, index) =>
    entry({ id: `technology-${index}` }),
  );
  entries[0] = entry({
    id: "a".repeat(100),
    label: "L".repeat(100),
    description: "D".repeat(100),
  });
  assert.equal(validateDocumentationCatalog(entries).length, 25);
});

test("validador aceita mensagem de 2000 unidades e recusa a próxima unidade", () => {
  const baseUrl = "https://example.com/";
  const responsePrefix = "Documentação do Exemplo: ";
  const url =
    baseUrl + "a".repeat(2000 - responsePrefix.length - baseUrl.length);
  assert.equal(validateDocumentationCatalog([entry({ url })])[0].url, url);
  assert.throws(() =>
    validateDocumentationCatalog([entry({ url: `${url}a` })]),
  );
});

test("opções derivadas não permitem alterar o catálogo nem a próxima leitura", () => {
  const options = getDocumentationOptions();
  options[0].value = "modified";
  options[0].label = "Modified";
  options.pop();
  assert.deepEqual(getDocumentationOptions(), historicalOptions);
  assert.equal(documentationCatalog[0].id, "angular");
});

for (const [name, makeEntries] of [
  ["catálogo ausente", () => undefined],
  ["catálogo não array", () => ({})],
  ["catálogo vazio", () => []],
  ["entrada ausente", () => [undefined]],
  ["entrada null", () => [null]],
  ["entrada não objeto", () => ["example"]],
  ["IDs duplicados", () => [entry(), entry()]],
  [
    "26 opções",
    () =>
      Array.from({ length: 26 }, (_, index) =>
        entry({ id: `technology-${index}` }),
      ),
  ],
]) {
  test(`validador recusa ${name}`, () => {
    assert.throws(() => validateDocumentationCatalog(makeEntries()));
  });
}

for (const id of [
  "",
  " ",
  "Example",
  "1example",
  "a_b",
  "a/b",
  "a:b",
  "á",
  "a".repeat(101),
  null,
  1,
]) {
  test(`validador recusa identificador inválido ${JSON.stringify(id)}`, () => {
    assert.throws(() => validateDocumentationCatalog([entry({ id })]));
  });
}

for (const field of ["label", "description"]) {
  for (const [name, value] of [
    ["ausente", undefined],
    ["não string", 1],
    ["vazio", ""],
    ["somente espaços", "  "],
    ["101 unidades UTF-16", "a".repeat(101)],
    ["Unicode malformado", "a\ud800"],
  ]) {
    test(`validador recusa ${field} ${name}`, () => {
      assert.throws(() =>
        validateDocumentationCatalog([entry({ [field]: value })]),
      );
    });
  }
}

for (const [name, url] of [
  ["ausente", undefined],
  ["não string", 1],
  ["vazia", ""],
  ["relativa", "/docs"],
  ["sem esquema", "example.com/docs"],
  ["HTTP", "http://example.com/docs"],
  ["javascript", "javascript:alert(1)"],
  ["file", "file:///docs"],
  ["credenciais", "https://user:password@example.com/docs"],
  ["espaço", "https://example.com/a b"],
  ["espaço inicial", " https://example.com/docs"],
  ["tab", "https://example.com/\tdocs"],
  ["quebra de linha", "https://example.com/\ndocs"],
  ["controle", "https://example.com/\u0000docs"],
  ["DEL", "https://example.com/\u007fdocs"],
  ["backslash", "https://example.com/\\docs"],
  ["sem barras do esquema", "https:example.com/docs"],
  ["menor que", "https://example.com/<docs"],
  ["maior que", "https://example.com/>docs"],
  ["backtick", "https://example.com/`docs"],
  ["Unicode malformado", "https://example.com/\ud800"],
  ["mais de 2048 unidades", `https://example.com/${"a".repeat(2048)}`],
  ["resposta acima de 2000", `https://example.com/${"a".repeat(1980)}`],
]) {
  test(`validador recusa URL ${name}`, () => {
    assert.throws(() => validateDocumentationCatalog([entry({ url })]));
  });
}

test("/docs serializa o menu específico a partir das mesmas 25 entradas", async () => {
  const command = require("../commands/docs");
  const { interaction, calls } = fixture();
  await command.execute(interaction);
  assert.deepEqual(methods(calls), ["reply"]);
  const payload = calls[0].payload;
  assert.equal(Boolean(payload.flags & 64), false);
  assert.equal(payload.embeds[0].toJSON().title, "Documentação");
  assert.equal(payload.components.length, 1);
  const row = payload.components[0].toJSON();
  assert.equal(row.components.length, 1);
  const menu = row.components[0];
  assert.equal(menu.type, 3);
  assert.equal(menu.custom_id, "codebucket:docs:select");
  assert.equal(menu.placeholder, "Nenhuma linguagem selecionada");
  // Builders retain undefined option fields; REST JSON omits those fields.
  assert.deepEqual(
    JSON.parse(JSON.stringify(menu.options)),
    getDocumentationOptions(),
  );
  assert.equal(menu.options.length, 25);
  assert.equal(command.data.toJSON().name, "docs");
  assert.equal(
    command.data.toJSON().description,
    "Acesse as documentações que quiser",
  );
});

test("handler resolve todas as 25 seleções sem consultar serviços externos", async () => {
  for (const technology of documentationCatalog) {
    const { interaction, calls } = fixture({ values: [technology.id] });
    assert.equal(await handleDocumentationSelect(interaction), true);
    assert.deepEqual(methods(calls), ["reply"]);
    assert.equal(
      contentOf(calls[0].payload),
      `Documentação ${technology.id === "unreal" ? "da" : "do"} ${technology.label}: ${technology.url}`,
    );
    assert.equal(Boolean(calls[0].payload.flags & 64), false);
  }
});

for (const [name, values] of [
  ["desconhecida", ["unknown"]],
  ["Laravel histórico", ["laravel"]],
  ["URL arbitrária", ["https://arbitrary.example.com/private"]],
  ["chave herdada toString", ["toString"]],
  ["chave herdada constructor", ["constructor"]],
  ["chave de protótipo", ["__proto__"]],
  ["array vazio", []],
  ["array com dois valores", ["javascript", "python"]],
  ["string fora de array", "javascript"],
  ["null", null],
  ["número", [1]],
  ["objeto", [{ toString: () => "javascript" }]],
  ["valor vazio", [""]],
]) {
  test(`seleção ${name} recebe fallback sem ecoar valor`, async () => {
    const { interaction, calls } = fixture({ values });
    assert.equal(await handleDocumentationSelect(interaction), true);
    assert.deepEqual(methods(calls), ["reply"]);
    assert.equal(contentOf(calls[0].payload), "Opção não reconhecida.");
  });
}

test("seleção sem values recebe fallback", async () => {
  const { interaction, calls } = fixture();
  delete interaction.values;
  assert.equal(await handleDocumentationSelect(interaction), true);
  assert.equal(contentOf(calls[0].payload), "Opção não reconhecida.");
});

for (const customId of [
  "select",
  "codebucket:other:select",
  "codebucket:docs:select:extra",
  "",
  undefined,
  null,
]) {
  test(`handler ignora customId alheio ${JSON.stringify(customId)}`, async () => {
    const { interaction, calls } = fixture();
    interaction.customId = customId;
    Object.defineProperty(interaction, "values", {
      get() {
        assert.fail("valores de outro componente não devem ser lidos");
      },
    });
    assert.equal(await handleDocumentationSelect(interaction), false);
    assert.deepEqual(calls, []);
  });
}

for (const [name, interaction] of [
  ["null", null],
  ["ausente", undefined],
  ["objeto vazio", {}],
  [
    "tipo errado",
    { customId: DOCUMENTATION_SELECT_ID, isStringSelectMenu: () => false },
  ],
  [
    "discriminador não função",
    { customId: DOCUMENTATION_SELECT_ID, isStringSelectMenu: true },
  ],
]) {
  test(`handler ignora interação inválida: ${name}`, async () => {
    assert.equal(await handleDocumentationSelect(interaction), false);
  });
}

for (const [name, state, expectedMethods] of [
  ["defer público", { deferred: true }, ["editReply"]],
  ["resposta anterior", { replied: true }, ["followUp"]],
  [
    "defer privado",
    { deferred: true, ephemeral: true },
    ["editReply", "followUp", "deleteReply"],
  ],
]) {
  test(`seleção após ${name} usa continuação segura`, async () => {
    const { interaction, calls } = fixture(state);
    assert.equal(await handleDocumentationSelect(interaction), true);
    assert.deepEqual(methods(calls), expectedMethods);
    const result = calls.find(({ payload }) =>
      contentOf(payload)?.startsWith("Documentação do Javascript:"),
    );
    assert.ok(result);
    assert.equal(Boolean(result.payload.flags & 64), false);
    if (state.ephemeral) {
      assert.equal(contentOf(calls[0].payload), "\u200b");
    }
  });
}

for (const [state, fail] of [
  [{}, "reply"],
  [{ deferred: true }, "editReply"],
  [{ replied: true }, "followUp"],
]) {
  test(`falha de ${fail} é sanitizada e não repete envio`, async (t) => {
    const logs = [];
    t.mock.method(console, "error", (...args) => logs.push(args));
    const request = fixture({ ...state, fail });
    await assert.rejects(
      handleDocumentationSelect(request.interaction),
      (error) =>
        error instanceof InteractionResponseError &&
        !error.message.includes("SENSITIVE_DOCUMENTATION_SENTINEL"),
    );
    await runWithErrorHandling(request.interaction, () =>
      handleDocumentationSelect(request.interaction),
    );
    assert.deepEqual(methods(request.calls), [fail]);
    assert.doesNotMatch(
      JSON.stringify(logs),
      /SENSITIVE_DOCUMENTATION_SENTINEL/,
    );
  });
}

for (const state of [
  { ageMs: 3000 },
  { deferred: true, ageMs: 15 * 60 * 1000 },
  { replied: true, ageMs: 15 * 60 * 1000 },
]) {
  test(`seleção expirada não envia nem tenta responder ao erro ${JSON.stringify(state)}`, async (t) => {
    t.mock.method(Date, "now", () => 2_000_000);
    const { interaction, calls } = fixture(state);
    await runWithErrorHandling(interaction, () =>
      handleDocumentationSelect(interaction),
    );
    assert.deepEqual(calls, []);
  });
}

test("lookup não converte valores arbitrários nem aceita propriedades herdadas", () => {
  for (const id of [
    undefined,
    null,
    "toString",
    "constructor",
    "__proto__",
    {},
    1,
  ]) {
    assert.equal(findDocumentation(id), undefined);
  }
});
