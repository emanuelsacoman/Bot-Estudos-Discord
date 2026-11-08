const assert = require("node:assert/strict");
const http = require("node:http");
const https = require("node:https");
const net = require("node:net");
const test = require("node:test");
const {
  TODO_LIMITS,
  DUPLICATE_PREFIX,
  DUPLICATE_SUFFIX,
  TodoStoreError,
  createTodoStore,
} = require("../lib/todo-store");
const { DISCORD_LIMITS } = require("../lib/content-limits");

const context = (userId, guildId = "guild-1") => ({ userId, guildId });

function isStoreError(code) {
  return (error) => error instanceof TodoStoreError && error.code === code;
}

function freshCommand(t) {
  const refuse = () => {
    throw new Error("Rede real proibida no teste.");
  };
  for (const transport of [http, https])
    t.mock.method(transport, "request", refuse);
  t.mock.method(net.Socket.prototype, "connect", refuse);
  t.mock.method(globalThis, "fetch", refuse);
  const file = require.resolve("../commands/todo");
  delete require.cache[file];
  return require(file);
}

function interaction(subcommand, task, number, fail = false) {
  const events = [];
  return {
    events,
    user: { id: "todo-user" },
    guildId: "guild-1",
    createdTimestamp: Date.now(),
    replied: false,
    deferred: false,
    options: {
      getSubcommand: () => subcommand,
      getString: () => task,
      getInteger: () => number,
    },
    async reply(payload) {
      events.push(payload);
      if (fail) throw new Error("SENSITIVE_SENTINEL_SEND");
      this.replied = true;
    },
  };
}

async function run(command, subcommand, task, number) {
  const current = interaction(subcommand, task, number);
  await command.execute(current);
  assert.equal(current.events.length, 1);
  return current.events[0];
}

test("todo: teto de tarefa e budgets da P2.1 permanecem preservados", () => {
  assert.equal(
    TODO_LIMITS.taskLength + DUPLICATE_PREFIX.length + DUPLICATE_SUFFIX.length,
    DISCORD_LIMITS.content,
  );
  assert.equal(TODO_LIMITS.tasksPerUser, 100);
  assert.equal(TODO_LIMITS.bytesPerUser, 64 * 1024);
  assert.equal(TODO_LIMITS.totalBytes, 8 * 1024 * 1024);
  assert.equal(TODO_LIMITS.users, 1024);
});

test("todo store: leitura vazia e entradas inválidas não alocam listas", () => {
  const store = createTodoStore();
  assert.deepEqual(store.list(context("missing")), []);
  for (const task of [
    undefined,
    null,
    1,
    {},
    "",
    " \n\t ",
    "\ud800",
    "x".repeat(TODO_LIMITS.taskLength + 1),
  ]) {
    assert.throws(
      () => store.add(context("user"), task),
      isStoreError("INVALID_TASK"),
    );
  }
  for (const userId of [null, "", "u".repeat(21)]) {
    assert.throws(
      () => store.add(context(userId), "valid task"),
      isStoreError("INVALID_CONTEXT"),
    );
  }
  assert.deepEqual(store.usage(), { users: 0, totalBytes: 0 });
});

test("todo store: tarefa no limite e emojis são preservados sem normalização", () => {
  const store = createTodoStore();
  const task =
    "😀".repeat(Math.floor(TODO_LIMITS.taskLength / 2)) +
    "a".repeat(TODO_LIMITS.taskLength % 2);
  store.add(context("user"), task);
  assert.deepEqual(store.list(context("user")), [task]);
  assert.throws(
    () => store.add(context("user"), task),
    isStoreError("DUPLICATE"),
  );
  assert.deepEqual(store.usage(), {
    users: 1,
    totalBytes: Buffer.byteLength(task),
  });
});

test("todo store: número máximo de itens aceita limite e recusa excesso sem mutação", () => {
  const store = createTodoStore();
  for (let i = 0; i < TODO_LIMITS.tasksPerUser; i += 1)
    store.add(context("user"), `task-${i}`);
  const before = store.usage();
  assert.throws(
    () => store.add(context("user"), "extra"),
    isStoreError("USER_TASKS"),
  );
  assert.equal(store.list(context("user")).length, TODO_LIMITS.tasksPerUser);
  assert.deepEqual(store.usage(), before);
});

test("todo store: orçamento por usuário conta bytes UTF-8 e permite liberar espaço", () => {
  const store = createTodoStore({ bytesPerUser: 8 });
  store.add(context("user"), "😀😀");
  assert.throws(
    () => store.add(context("user"), "x"),
    isStoreError("USER_BYTES"),
  );
  assert.equal(store.remove(context("user"), 1), "😀😀");
  assert.deepEqual(store.usage(), { users: 0, totalBytes: 0 });
  store.add(context("user"), "12345678");
  assert.equal(store.usage().totalBytes, 8);
});

test("todo store: orçamento global aceita exato e rejeita sem expulsar listas", () => {
  const store = createTodoStore({ totalBytes: 8 });
  store.add(context("one"), "1234");
  store.add(context("two"), "5678");
  assert.throws(
    () => store.add(context("three"), "x"),
    isStoreError("CAPACITY"),
  );
  assert.deepEqual(store.list(context("one")), ["1234"]);
  assert.deepEqual(store.list(context("two")), ["5678"]);
  assert.deepEqual(store.usage(), { users: 2, totalBytes: 8 });
  store.remove(context("one"), 1);
  store.add(context("three"), "new");
  assert.deepEqual(store.usage(), { users: 2, totalBytes: 7 });
});

test("todo store: teto de usuários controla metadados e exclusão final libera vaga", () => {
  const store = createTodoStore({ users: 2 });
  store.add(context("one"), "a");
  store.add(context("two"), "b");
  assert.throws(
    () => store.add(context("three"), "c"),
    isStoreError("CAPACITY"),
  );
  store.remove(context("two"), 1);
  store.add(context("three"), "c");
  assert.deepEqual(store.usage(), { users: 2, totalBytes: 2 });
});

test("todo store: remoção rejeita índices inválidos sem coerção nem mutação", () => {
  const store = createTodoStore();
  store.add(context("user"), "first");
  for (const number of [
    null,
    undefined,
    NaN,
    Infinity,
    0,
    -1,
    1.5,
    "1",
    2,
    Number.MAX_SAFE_INTEGER + 1,
  ]) {
    assert.throws(
      () => store.remove(context("user"), number),
      isStoreError("INVALID_NUMBER"),
    );
  }
  assert.deepEqual(store.list(context("user")), ["first"]);
  assert.equal(store.remove(context("user"), 1), "first");
  assert.throws(
    () => store.remove(context("user"), 1),
    isStoreError("INVALID_NUMBER"),
  );
});

test("todo store: cópia de leitura não altera estado ou cálculo dos bytes", () => {
  const store = createTodoStore();
  store.add(context("user"), "first");
  store.list(context("user")).push("outside");
  assert.deepEqual(store.list(context("user")), ["first"]);
  assert.equal(store.usage().totalBytes, 5);
});

test("/todo: fluxo normal mantém mensagens, cores, lista e duplicata", async (t) => {
  const command = freshCommand(t);
  const task = "Estudar café, <tag> e 👩🏽‍💻";
  const added = await run(command, "add", task);
  const embed = added.embeds[0].toJSON();
  assert.equal(embed.title, "TO-DO");
  assert.equal(embed.color, 0x00e903);
  assert.equal(embed.description, `Tarefa **${task}** adicionada à sua lista.`);
  assert.equal(embed.footer.text, "CodeBucket");
  const duplicate = await run(command, "add", task);
  assert.equal(
    duplicate.content,
    "Essa tarefa já está na sua lista neste contexto.",
  );
  assert.ok(!duplicate.content.includes(task));
  assert.ok(duplicate.flags & 64);
  const listed = await run(command, "list");
  assert.equal(
    listed.embeds[0].toJSON().description,
    `Sua Lista de Tarefas:\n1. ${task}\n`,
  );
  const removed = await run(command, "remove", undefined, 1);
  assert.equal(
    removed.embeds[0].toJSON().description,
    `Tarefa **${task}** removida da sua lista.`,
  );
  const empty = await run(command, "list");
  assert.equal(empty.content, "Sua lista de tarefas está vazia.");
  assert.ok(empty.flags & 64);
});

test("/todo: entrada vazia, acima do limite e Unicode inválido são informativos", async (t) => {
  const command = freshCommand(t);
  for (const value of [
    "",
    "  ",
    null,
    Object.create(null),
    "\ud800",
    "x".repeat(TODO_LIMITS.taskLength + 1),
  ]) {
    const payload = await run(command, "add", value);
    assert.match(payload.content, /tarefa não vazia/);
    assert.ok(payload.flags & 64);
  }
  assert.equal(
    (await run(command, "list")).content,
    "Sua lista de tarefas está vazia.",
  );
});

test("/todo: tarefa máxima preserva confirmação privada sem ecoar na duplicata", async (t) => {
  const command = freshCommand(t);
  const task = "x".repeat(TODO_LIMITS.taskLength);
  const added = await run(command, "add", task);
  assert.ok(added.embeds[0].toJSON().description.includes(task));
  const duplicate = await run(command, "add", task);
  assert.ok(duplicate.content.length <= DISCORD_LIMITS.content);
  assert.ok(!duplicate.content.includes(task));
  assert.ok(duplicate.flags & 64);
});

test("/todo: descrição com 4096 caracteres cabe e excesso vira anexo completo", async (t) => {
  const command = freshCommand(t);
  const first = "a".repeat(TODO_LIMITS.taskLength);
  const second = "b".repeat(TODO_LIMITS.taskLength);
  const prefix = "Sua Lista de Tarefas:\n";
  const third = "c".repeat(
    DISCORD_LIMITS.description -
      prefix.length -
      12 -
      first.length -
      second.length,
  );
  for (const task of [first, second, third]) await run(command, "add", task);
  const atLimit = await run(command, "list");
  assert.equal(
    atLimit.embeds[0].toJSON().description.length,
    DISCORD_LIMITS.description,
  );
  await run(command, "add", "👩🏽‍💻");
  const excessive = await run(command, "list");
  assert.equal(excessive.embeds, undefined);
  assert.equal(excessive.files.length, 1);
  assert.ok(Buffer.isBuffer(excessive.files[0].attachment));
  const text = excessive.files[0].attachment.toString("utf8");
  assert.ok(text.includes(`1. ${first}\n2. ${second}\n3. ${third}\n4. 👩🏽‍💻\n`));
  assert.equal(excessive.files[0].name, "tarefas.txt");
});

test("/todo: lista extensa rejeita novo item e preserva os cem anteriores", async (t) => {
  const command = freshCommand(t);
  for (let i = 0; i < TODO_LIMITS.tasksPerUser; i += 1)
    await run(command, "add", `task-${i}`);
  const rejected = await run(command, "add", "extra");
  assert.match(rejected.content, /limite de 100 tarefas/);
  assert.ok(rejected.flags & 64);
  const list = (await run(command, "list")).embeds[0].toJSON().description;
  assert.ok(list.endsWith("100. task-99\n"));
  assert.ok(!list.includes("extra"));
});

test("/todo: índice fracionário não remove item; outro servidor não exibe a lista", async (t) => {
  const command = freshCommand(t);
  await run(command, "add", "existing");
  const invalid = await run(command, "remove", undefined, 1.5);
  assert.match(invalid.content, /número válido/);
  const anotherGuild = interaction("list");
  anotherGuild.guildId = "guild-2";
  await command.execute(anotherGuild);
  assert.equal(
    anotherGuild.events[0].content,
    "Sua lista de tarefas está vazia.",
  );
  assert.ok(
    (await run(command, "list")).embeds[0]
      .toJSON()
      .description.includes("existing"),
  );
});

test("/todo: falha ao confirmar mantém efeito local e não repete envio", async (t) => {
  const command = freshCommand(t);
  const failedAdd = interaction("add", "kept", undefined, true);
  await assert.rejects(command.execute(failedAdd));
  assert.equal(failedAdd.events.length, 1);
  assert.ok(
    (await run(command, "list")).embeds[0]
      .toJSON()
      .description.includes("kept"),
  );
  const failedRemove = interaction("remove", undefined, 1, true);
  await assert.rejects(command.execute(failedRemove));
  assert.equal(failedRemove.events.length, 1);
  assert.equal(
    (await run(command, "list")).content,
    "Sua lista de tarefas está vazia.",
  );
});
