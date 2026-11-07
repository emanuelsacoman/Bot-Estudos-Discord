const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const http = require("node:http");
const https = require("node:https");
const net = require("node:net");
const path = require("node:path");
const test = require("node:test");
const tls = require("node:tls");
const {
  loadCommandCatalog,
  validateCommandCatalog,
  validateCommandPayloads,
  CommandCatalogError,
} = require("../lib/command-catalog");

function guardNetwork(t) {
  const refuse = () => {
    throw new Error("Rede real proibida no teste de catálogo");
  };
  for (const transport of [http, https]) {
    t.mock.method(transport, "request", refuse);
    t.mock.method(transport, "get", refuse);
  }
  t.mock.method(net.Socket.prototype, "connect", refuse);
  t.mock.method(tls, "connect", refuse);
  t.mock.method(globalThis, "fetch", refuse);
}

const payloadFor = (name = "exemplo", options = []) => ({
  options,
  name,
  description: "Comando de teste",
  type: 1,
});
const optionFor = (name = "entrada", type = 3) => ({
  type,
  name,
  description: "Entrada de teste",
  required: true,
});
const moduleFor = (payload) => ({
  data: { name: payload.name, toJSON: () => payload },
  execute: async () => {},
});
const invalid = (operation) =>
  assert.throws(operation, (error) => {
    assert.ok(error instanceof CommandCatalogError);
    assert.equal(
      error.message,
      "Não foi possível validar o catálogo de comandos.",
    );
    assert.equal(error.cause, undefined);
    return true;
  });

test("catálogo real carrega offline os 23 contratos sem alterar o hash público", (t) => {
  guardNetwork(t);
  const { commands, payload } = loadCommandCatalog();
  assert.equal(commands.length, 23);
  assert.equal(payload.length, 23);
  const entries = payload.map((data) => ({ file: `${data.name}.js`, data }));
  const digest = crypto
    .createHash("sha256")
    .update(JSON.stringify(entries))
    .digest("hex");
  assert.equal(
    digest,
    "e50cb9e0df937132bf0381b136a80cab6e46bdd0186f69490a825961b9d53f15",
  );
});

test("catálogo normaliza undefined de builders e produz snapshot independente imutável", () => {
  const original = payloadFor("exemplo", [
    { ...optionFor(), choices: [{ name: "Escolha", value: "valor" }] },
  ]);
  original.default_permission = undefined;
  const command = moduleFor(original);
  const result = validateCommandCatalog([command]);
  assert.equal(result.commands[0], command);
  assert.deepEqual(
    JSON.parse(JSON.stringify(result.payload)),
    JSON.parse(JSON.stringify([original])),
  );
  original.options[0].choices[0].value = "alterado";
  assert.equal(result.payload[0].options[0].choices[0].value, "valor");
  assert.ok(Object.isFrozen(result.commands));
  assert.ok(Object.isFrozen(result.payload));
  assert.ok(Object.isFrozen(result.payload[0].options[0].choices[0]));
});

test("catálogo aceita grupos, subcomandos e escolhas válidas dos tipos usados", () => {
  const options = [
    {
      type: 2,
      name: "grupo",
      description: "Grupo",
      options: [
        {
          type: 1,
          name: "subcomando",
          description: "Subcomando",
          options: [
            {
              ...optionFor("texto"),
              choices: [{ name: "Texto", value: "texto" }],
            },
            { ...optionFor("inteiro", 4), choices: [{ name: "Um", value: 1 }] },
            {
              ...optionFor("numero", 10),
              choices: [{ name: "Metade", value: 0.5 }],
            },
          ],
        },
      ],
    },
  ];
  assert.equal(
    validateCommandCatalog([moduleFor(payloadFor("exemplo", options))]).payload
      .length,
    1,
  );
});

for (const [name, modules] of [
  ["ausente", undefined],
  ["vazio", []],
  ["não array", {}],
  ["módulo ausente", [undefined]],
  ["execute ausente", [{ data: { toJSON() {} } }]],
  ["execute inválido", [{ data: { toJSON() {} }, execute: true }]],
  ["builder ausente", [{ execute() {} }]],
  ["builder sem serializador", [{ execute() {}, data: { name: "exemplo" } }]],
  [
    "mais de 100 comandos",
    Array.from({ length: 101 }, (_, index) =>
      moduleFor(payloadFor(`c${index}`)),
    ),
  ],
]) {
  test(`catálogo recusa ${name}`, () =>
    invalid(() => validateCommandCatalog(modules)));
}

test("catálogo recusa nome divergente entre runtime e payload", () => {
  const command = moduleFor(payloadFor("registro"));
  command.data.name = "runtime";
  invalid(() => validateCommandCatalog([command]));
});

test("catálogo recusa comandos com nomes duplicados", () => {
  assert.throws(
    () =>
      validateCommandCatalog([
        moduleFor(payloadFor()),
        moduleFor(payloadFor()),
      ]),
    (error) => error.code === "CATALOG_DUPLICATE_NAME",
  );
});

test("erro do builder é sanitizado sem dados de origem", () => {
  const command = moduleFor(payloadFor());
  command.data.toJSON = () => {
    throw new Error("sentinela-privada-builder");
  };
  invalid(() => validateCommandCatalog([command]));
});

const invalidPayloads = [
  ["tipo de comando", () => ({ ...payloadFor(), type: 2 })],
  ["nome vazio", () => ({ ...payloadFor(), name: "" })],
  ["nome maiúsculo", () => ({ ...payloadFor(), name: "Exemplo" })],
  ["nome Unicode fora da política", () => ({ ...payloadFor(), name: "ação" })],
  ["nome longo", () => ({ ...payloadFor(), name: "a".repeat(33) })],
  ["descrição vazia", () => ({ ...payloadFor(), description: " " })],
  [
    "descrição longa",
    () => ({ ...payloadFor(), description: "a".repeat(101) }),
  ],
  ["campo raiz inesperado", () => ({ ...payloadFor(), unexpected: true })],
  ["opções não array", () => payloadFor("exemplo", {})],
  [
    "mais de 25 opções",
    () =>
      payloadFor(
        "exemplo",
        Array.from({ length: 26 }, (_, i) => optionFor(`p${i}`)),
      ),
  ],
  [
    "nome de opção duplicado",
    () => payloadFor("exemplo", [optionFor(), optionFor()]),
  ],
  [
    "tipo de opção inválido",
    () => payloadFor("exemplo", [optionFor("entrada", 12)]),
  ],
  [
    "opção sem descrição",
    () => payloadFor("exemplo", [{ type: 3, name: "entrada" }]),
  ],
  [
    "required inválido",
    () => payloadFor("exemplo", [{ ...optionFor(), required: "true" }]),
  ],
  [
    "obrigatória depois de opcional",
    () =>
      payloadFor("exemplo", [
        { ...optionFor("opcional"), required: false },
        optionFor("obrigatoria"),
      ]),
  ],
  [
    "campo de opção inesperado",
    () => payloadFor("exemplo", [{ ...optionFor(), unexpected: 1 }]),
  ],
  [
    "subcomando misturado com parâmetro",
    () =>
      payloadFor("exemplo", [
        { ...optionFor("sub", 1), required: undefined },
        optionFor("valor"),
      ]),
  ],
  [
    "grupo vazio",
    () =>
      payloadFor("exemplo", [
        { ...optionFor("grupo", 2), required: undefined, options: [] },
      ]),
  ],
  [
    "parâmetro dentro de grupo",
    () =>
      payloadFor("exemplo", [
        {
          ...optionFor("grupo", 2),
          required: undefined,
          options: [optionFor()],
        },
      ]),
  ],
  [
    "subcomando com required",
    () => payloadFor("exemplo", [optionFor("sub", 1)]),
  ],
  [
    "opções dentro de parâmetro",
    () => payloadFor("exemplo", [{ ...optionFor(), options: [] }]),
  ],
  [
    "escolhas em boolean",
    () =>
      payloadFor("exemplo", [
        { ...optionFor("bool", 5), choices: [{ name: "Sim", value: true }] },
      ]),
  ],
  [
    "escolhas vazias",
    () => payloadFor("exemplo", [{ ...optionFor(), choices: [] }]),
  ],
  [
    "escolha inválida",
    () =>
      payloadFor("exemplo", [
        { ...optionFor(), choices: [{ name: "Valor", value: 3 }] },
      ]),
  ],
  [
    "escolha inteira fracionária",
    () =>
      payloadFor("exemplo", [
        { ...optionFor("num", 4), choices: [{ name: "Metade", value: 0.5 }] },
      ]),
  ],
  [
    "escolha duplicada",
    () =>
      payloadFor("exemplo", [
        {
          ...optionFor(),
          choices: [
            { name: "Mesmo", value: "a" },
            { name: "Mesmo", value: "b" },
          ],
        },
      ]),
  ],
];
for (const [name, makePayload] of invalidPayloads) {
  test(`payload recusa ${name}`, () =>
    invalid(() => validateCommandPayloads([makePayload()])));
}

for (const [name, makeValue] of [
  ["NaN", () => NaN],
  ["Infinity", () => Infinity],
  ["BigInt", () => 1n],
  ["function", () => () => {}],
  ["symbol", () => Symbol("sentinela")],
  ["Date", () => new Date(0)],
  ["RegExp", () => /teste/],
  ["undefined em array", () => [undefined]],
  ["array esparso", () => Array(1)],
  ["array com propriedade extra", () => Object.assign([], { extra: 1 })],
  [
    "referência circular",
    () => {
      const value = {};
      value.self = value;
      return value;
    },
  ],
  ["chave symbol", () => ({ [Symbol("chave")]: 1 })],
]) {
  test(`snapshot recusa ${name} sem coerção JSON silenciosa`, () => {
    invalid(() =>
      validateCommandPayloads([{ ...payloadFor(), unexpected: makeValue() }]),
    );
  });
}

test("snapshot recusa getter sem executá-lo", () => {
  let reads = 0;
  const payload = payloadFor();
  Object.defineProperty(payload, "unexpected", {
    enumerable: true,
    get() {
      reads += 1;
      throw new Error("sentinela-privada-getter");
    },
  });
  invalid(() => validateCommandPayloads([payload]));
  assert.equal(reads, 0);
});

test("loader ordena somente módulos JS e usa o diretório informado", () => {
  const loaded = [];
  const directory = path.resolve("catalogo-de-teste");
  const result = loadCommandCatalog({
    directory,
    readDirectory: (received) => {
      assert.equal(received, directory);
      return ["b.js", "README.md", "a.js"];
    },
    loadModule: (file) => {
      loaded.push(file);
      return moduleFor(payloadFor(path.basename(file, ".js")));
    },
  });
  assert.deepEqual(loaded, [
    path.join(directory, "a.js"),
    path.join(directory, "b.js"),
  ]);
  assert.deepEqual(
    result.payload.map((command) => command.name),
    ["a", "b"],
  );
});

test("loader recusa caminho de módulo fora do diretório", () => {
  let loads = 0;
  invalid(() =>
    loadCommandCatalog({
      readDirectory: () => ["../escape.js"],
      loadModule: () => {
        loads += 1;
      },
    }),
  );
  assert.equal(loads, 0);
});

for (const stage of ["readDirectory", "loadModule"]) {
  test(`loader sanitiza falha em ${stage}`, () => {
    const fail = () => {
      throw new Error("sentinela-privada-caminho");
    };
    invalid(() =>
      loadCommandCatalog({
        readDirectory: () => ["a.js"],
        loadModule: () => moduleFor(payloadFor()),
        [stage]: fail,
      }),
    );
  });
}
