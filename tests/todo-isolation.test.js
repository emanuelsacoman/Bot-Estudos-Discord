const assert = require("node:assert/strict");
const dns = require("node:dns");
const http = require("node:http");
const https = require("node:https");
const net = require("node:net");
const tls = require("node:tls");
const { beforeEach, test } = require("node:test");
const {
  TODO_LIMITS,
  TodoStoreError,
  createTodoStore,
} = require("../lib/todo-store");
const { runWithErrorHandling } = require("../lib/interactions");

beforeEach((t) => {
  const refuse = () => {
    throw new Error("Somente estado e interações locais são permitidos.");
  };
  for (const transport of [http, https]) {
    t.mock.method(transport, "request", refuse);
    t.mock.method(transport, "get", refuse);
  }
  t.mock.method(dns, "lookup", refuse);
  t.mock.method(net.Socket.prototype, "connect", refuse);
  t.mock.method(tls, "connect", refuse);
  t.mock.method(globalThis, "fetch", refuse);
  // Expiry has its own suite; scheduling/module loading cannot age these mocks.
  const now = Date.now();
  t.mock.method(Date, "now", () => now);
});

const context = (userId = "user-a", guildId = "guild-a") => ({
  userId,
  guildId,
});
const isStoreError = (code) => (error) =>
  error instanceof TodoStoreError && error.code === code;

function freshCommand() {
  const file = require.resolve("../commands/todo");
  delete require.cache[file];
  return require(file);
}

function interaction({
  userId = "user-a",
  guildId = "guild-a",
  channelId = "channel-a",
  subcommand = "list",
  task,
  number,
  deferred = false,
  ephemeral = false,
  replyGate,
  fail,
  optionsError,
} = {}) {
  const events = [];
  return {
    events,
    user: { id: userId },
    guildId,
    channelId,
    inGuild: () => guildId !== null,
    createdTimestamp: Date.now(),
    deferred,
    replied: false,
    ephemeral,
    options: {
      getSubcommand() {
        if (optionsError) throw new Error(optionsError);
        return subcommand;
      },
      getString: () => task,
      getInteger: () => number,
    },
    async reply(payload) {
      assert.equal(this.deferred || this.replied, false);
      events.push({
        method: "reply",
        payload,
        private: Boolean(payload.flags & 64),
      });
      if (fail) throw new Error("SENSITIVE_SENTINEL_SEND");
      if (replyGate) await replyGate;
      this.replied = true;
      this.ephemeral = Boolean(payload.flags & 64);
    },
    async editReply(payload) {
      assert.equal(this.deferred || this.replied, true);
      events.push({ method: "editReply", payload, private: this.ephemeral });
      if (fail) throw new Error("SENSITIVE_SENTINEL_SEND");
      this.replied = true;
    },
    async followUp(payload) {
      events.push({
        method: "followUp",
        payload,
        private: Boolean(payload.flags & 64),
      });
      if (fail) throw new Error("SENSITIVE_SENTINEL_SEND");
      this.replied = true;
    },
    async deleteReply() {
      events.push({ method: "deleteReply" });
    },
  };
}

function result(it) {
  const meaningful = it.events.filter(
    ({ payload }) =>
      payload &&
      (payload.embeds ||
        payload.files ||
        (payload.content && payload.content !== "\u200b")),
  );
  assert.equal(meaningful.length, 1);
  return meaningful[0];
}

async function run(command, options) {
  const it = interaction(options);
  await command.execute(it);
  return { it, ...result(it) };
}

function body(payload) {
  if (payload.files) return payload.files[0].attachment.toString("utf8");
  if (payload.embeds) return payload.embeds[0].toJSON().description;
  return payload.content;
}

test("P2.2 store: usuários distintos no mesmo servidor têm criação e remoção isoladas", () => {
  const store = createTodoStore();
  const alice = context("alice");
  const bob = context("bob");
  store.add(alice, "tarefa da Alice");
  store.add(bob, "tarefa do Bob");
  assert.deepEqual(store.list(alice), ["tarefa da Alice"]);
  assert.deepEqual(store.list(bob), ["tarefa do Bob"]);
  assert.equal(store.remove(alice, 1), "tarefa da Alice");
  assert.deepEqual(store.list(alice), []);
  assert.deepEqual(store.list(bob), ["tarefa do Bob"]);
  assert.equal(store.usage().users, 1);
});

test("P2.2 store: mesmo usuário em dois servidores e DM não mistura listas ou números", () => {
  const store = createTodoStore();
  const first = context("alice", "guild-a");
  const second = context("alice", "guild-b");
  const dm = context("alice", null);
  for (const [scope, text] of [
    [first, "primeiro"],
    [second, "segundo"],
    [dm, "direto"],
  ]) {
    store.add(scope, text);
  }
  assert.deepEqual(store.list(first), ["primeiro"]);
  assert.deepEqual(store.list(second), ["segundo"]);
  assert.deepEqual(store.list(dm), ["direto"]);
  assert.equal(store.remove(second, 1), "segundo");
  assert.deepEqual(store.list(second), []);
  assert.deepEqual(store.list(first), ["primeiro"]);
  assert.deepEqual(store.list(dm), ["direto"]);
  assert.equal(store.usage().users, 1);
});

test("P2.2 store: escopo distingue DM literal, delimitadores e ordem das identidades", () => {
  const store = createTodoStore();
  const scopes = [
    context("a:b", "c"),
    context("a", "b:c"),
    context("a", "DM"),
    context("a", null),
    context("c", "a:b"),
    context("__proto__", "constructor"),
  ];
  scopes.forEach((scope, index) => store.add(scope, `task-${index}`));
  scopes.forEach((scope, index) =>
    assert.deepEqual(store.list(scope), [`task-${index}`]),
  );
});

test("P2.2 store: contextos inválidos falham fechados sem acessar DM ou alterar uso", () => {
  const store = createTodoStore();
  store.add(context("alice", null), "privado");
  const before = store.usage();
  const invalid = [
    undefined,
    null,
    "alice",
    {},
    { userId: "alice" },
    { userId: "alice", guildId: undefined },
    context("alice", ""),
    context("alice", " "),
    context("alice", {}),
    context("alice", "g".repeat(21)),
    context("alice", "\ud800"),
    context("", null),
    context("u".repeat(21), null),
    context(null, "guild"),
  ];
  for (const scope of invalid) {
    assert.throws(() => store.list(scope), isStoreError("INVALID_CONTEXT"));
    assert.throws(
      () => store.add(scope, "nova"),
      isStoreError("INVALID_CONTEXT"),
    );
    assert.throws(
      () => store.remove(scope, 1),
      isStoreError("INVALID_CONTEXT"),
    );
  }
  assert.deepEqual(store.usage(), before);
  assert.deepEqual(store.list(context("alice", null)), ["privado"]);
});

test("P2.2 store: leitura ausente não aloca escopo e duplicatas só valem na própria lista", () => {
  const store = createTodoStore();
  const a = context();
  const b = context("user-a", "guild-b");
  assert.deepEqual(store.list(a), []);
  assert.deepEqual(store.usage(), { users: 0, totalBytes: 0 });
  store.add(a, "mesma tarefa");
  store.add(b, "mesma tarefa");
  assert.throws(() => store.add(a, "mesma tarefa"), isStoreError("DUPLICATE"));
  assert.deepEqual(store.list(b), ["mesma tarefa"]);
  assert.equal(store.usage().totalBytes, Buffer.byteLength("mesma tarefa") * 2);
});

test("P2.2 store: cem itens agregados não podem ser multiplicados entre servidores e DM", () => {
  const store = createTodoStore();
  for (let i = 0; i < TODO_LIMITS.tasksPerUser; i++) {
    store.add(context("alice", `guild-${i}`), `task-${i}`);
  }
  const before = store.usage();
  for (const guildId of ["guild-extra", null, "guild-0"]) {
    assert.throws(
      () => store.add(context("alice", guildId), "excesso"),
      isStoreError("USER_TASKS"),
    );
  }
  assert.deepEqual(store.usage(), before);
  store.add(context("bob", "guild-extra"), "outro usuário");
  assert.equal(store.remove(context("alice", "guild-37"), 1), "task-37");
  store.add(context("alice", null), "nova após liberar");
  assert.deepEqual(store.list(context("alice", null)), ["nova após liberar"]);
});

test("P2.2 store: 64 KiB UTF-8 agregados entre guilds e DM aceitam exato e liberam bytes", () => {
  const store = createTodoStore();
  const chunk = "😀".repeat(256); // 1024 bytes, within the task-length budget.
  for (let i = 0; i < TODO_LIMITS.bytesPerUser / 1024; i++) {
    store.add(context("alice", `guild-${i}`), chunk);
  }
  assert.equal(store.usage().totalBytes, TODO_LIMITS.bytesPerUser);
  assert.throws(
    () => store.add(context("alice", null), "x"),
    isStoreError("USER_BYTES"),
  );
  store.remove(context("alice", "guild-0"), 1);
  store.add(context("alice", null), chunk);
  assert.equal(store.usage().totalBytes, TODO_LIMITS.bytesPerUser);
});

test("P2.2 store: orçamento global permanece compartilhado entre todos os escopos", () => {
  const store = createTodoStore({ totalBytes: 8 });
  store.add(context("alice", "guild-a"), "1234");
  store.add(context("alice", "guild-b"), "56");
  store.add(context("bob", null), "78");
  const before = store.usage();
  for (const scope of [
    context("alice", "guild-c"),
    context("bob", "guild-a"),
    context("eve", null),
  ]) {
    assert.throws(() => store.add(scope, "x"), isStoreError("CAPACITY"));
  }
  assert.deepEqual(store.usage(), before);
  assert.deepEqual(store.list(context("alice", "guild-a")), ["1234"]);
  assert.equal(store.remove(context("alice", "guild-b"), 1), "56");
  store.add(context("bob", "guild-c"), "ab");
  assert.deepEqual(store.usage(), { users: 2, totalBytes: 8 });
});

test("P2.2 store: teto conta usuários reais e só libera vaga após remover todos os escopos", () => {
  const store = createTodoStore({ users: 2 });
  store.add(context("alice", "guild-a"), "a");
  store.add(context("alice", "guild-b"), "b");
  store.add(context("bob", null), "c");
  assert.deepEqual(store.usage(), { users: 2, totalBytes: 3 });
  assert.throws(
    () => store.add(context("eve", "guild-a"), "d"),
    isStoreError("CAPACITY"),
  );
  store.add(context("alice", null), "e");
  store.remove(context("alice", "guild-a"), 1);
  assert.throws(
    () => store.add(context("eve", null), "d"),
    isStoreError("CAPACITY"),
  );
  store.remove(context("alice", "guild-b"), 1);
  store.remove(context("alice", null), 1);
  store.add(context("eve", "guild-a"), "d");
  assert.deepEqual(store.usage(), { users: 2, totalBytes: 2 });
});

test("P2.2 store: remoção e leitura inválidas não criam usuário nem escopo", () => {
  const store = createTodoStore();
  const scope = context();
  store.list(scope);
  assert.throws(() => store.remove(scope, 1), isStoreError("INVALID_NUMBER"));
  assert.throws(() => store.add(scope, " "), isStoreError("INVALID_TASK"));
  assert.deepEqual(store.usage(), { users: 0, totalBytes: 0 });
});

test("P2.2 store: entradas concorrentes próximas ao teto não ultrapassam cotas", async () => {
  const store = createTodoStore({ tasksPerUser: 3 });
  const attempts = await Promise.allSettled(
    Array.from({ length: 10 }, (_, i) =>
      Promise.resolve().then(() =>
        store.add(context("alice", `guild-${i}`), `t${i}`),
      ),
    ),
  );
  assert.equal(
    attempts.filter(({ status }) => status === "fulfilled").length,
    3,
  );
  assert.ok(
    attempts
      .filter(({ status }) => status === "rejected")
      .every(({ reason }) => isStoreError("USER_TASKS")(reason)),
  );
  assert.deepEqual(store.usage(), { users: 1, totalBytes: 6 });
  for (let i = 0; i < 10; i++) {
    assert.deepEqual(
      store.list(context("alice", `guild-${i}`)),
      i < 3 ? [`t${i}`] : [],
    );
  }
});

test("P2.2 store: duas remoções concorrentes da última tarefa só liberam uma vez", async () => {
  const store = createTodoStore();
  const scope = context();
  store.add(scope, "😀");
  const attempts = await Promise.allSettled(
    [1, 2].map(() => Promise.resolve().then(() => store.remove(scope, 1))),
  );
  assert.equal(
    attempts.filter(({ status }) => status === "fulfilled").length,
    1,
  );
  assert.equal(
    attempts.filter(({ status }) => status === "rejected").length,
    1,
  );
  assert.deepEqual(store.usage(), { users: 0, totalBytes: 0 });
});

test("P2.2 store: instância nova simula reinicialização sem sincronização ou recuperação", () => {
  const firstProcess = createTodoStore();
  const scope = context();
  firstProcess.add(scope, "somente neste processo");
  const secondProcess = createTodoStore();
  assert.deepEqual(secondProcess.list(scope), []);
  assert.deepEqual(secondProcess.usage(), { users: 0, totalBytes: 0 });
  secondProcess.add(scope, "independente");
  assert.deepEqual(firstProcess.list(scope), ["somente neste processo"]);
  assert.deepEqual(secondProcess.list(scope), ["independente"]);
});

test("P2.2 /todo: criação, listagem e remoção usam guild e usuário em todas as operações", async () => {
  const command = freshCommand();
  const scopes = [
    { userId: "alice", guildId: "guild-a", task: "ALICE_A" },
    { userId: "alice", guildId: "guild-b", task: "ALICE_B" },
    { userId: "bob", guildId: "guild-a", task: "BOB_A" },
    { userId: "alice", guildId: null, task: "ALICE_DM" },
  ];
  for (const scope of scopes) {
    const response = await run(command, { ...scope, subcommand: "add" });
    assert.equal(response.private, true);
  }
  for (const scope of scopes) {
    const listed = await run(command, { ...scope, subcommand: "list" });
    assert.equal(listed.private, true);
    assert.match(body(listed.payload), new RegExp(scope.task));
    for (const other of scopes.filter(({ task }) => task !== scope.task)) {
      assert.ok(!body(listed.payload).includes(other.task));
    }
  }
  await run(command, {
    userId: "alice",
    guildId: "guild-b",
    subcommand: "remove",
    number: 1,
  });
  const emptied = await run(command, { userId: "alice", guildId: "guild-b" });
  assert.match(body(emptied.payload), /vazia/);
  const kept = await run(command, { userId: "alice", guildId: "guild-a" });
  assert.match(body(kept.payload), /ALICE_A/);
});

test("P2.2 /todo: DM do mesmo usuário compartilha lista sem usar channelId", async () => {
  const command = freshCommand();
  await run(command, {
    guildId: null,
    channelId: "dm-a",
    subcommand: "add",
    task: "privado DM",
  });
  const listed = await run(command, { guildId: null, channelId: "dm-b" });
  assert.equal(listed.private, true);
  assert.match(body(listed.payload), /privado DM/);
  await run(command, {
    guildId: null,
    channelId: "dm-c",
    subcommand: "remove",
    number: 1,
  });
  assert.match(
    body((await run(command, { guildId: null, channelId: "dm-a" })).payload),
    /vazia/,
  );
});

test("P2.2 /todo: canais do mesmo servidor acessam o mesmo escopo com respostas privadas", async () => {
  const command = freshCommand();
  await run(command, {
    channelId: "first-channel",
    subcommand: "add",
    task: "mesmo servidor",
  });
  const listed = await run(command, { channelId: "other-channel" });
  assert.equal(listed.private, true);
  assert.match(body(listed.payload), /mesmo servidor/);
});

test("P2.2 /todo: todas as confirmações, listas e falhas usuais são efêmeras", async () => {
  const command = freshCommand();
  const operations = [
    {},
    { subcommand: "add", task: "pessoal" },
    { subcommand: "add", task: "pessoal" },
    {},
    { subcommand: "remove", number: 0 },
    { subcommand: "remove", number: 1 },
    { subcommand: "add", task: " " },
    { subcommand: "unsupported" },
  ];
  for (const operation of operations) {
    const response = await run(command, operation);
    assert.equal(response.private, true);
    assert.ok(response.payload.flags & 64);
  }
});

test("P2.2 /todo: duplicata e erro inesperado não repetem conteúdo sensível ou logs", async (t) => {
  const command = freshCommand();
  const logs = [];
  for (const method of ["log", "warn", "error"]) {
    t.mock.method(console, method, (...args) => logs.push(args));
  }
  const task = "SENSITIVE_SENTINEL_TASK";
  await run(command, { subcommand: "add", task });
  const duplicate = await run(command, { subcommand: "add", task });
  assert.equal(duplicate.private, true);
  assert.doesNotMatch(
    JSON.stringify(duplicate.payload),
    /SENSITIVE_SENTINEL_TASK/,
  );
  const malformed = await run(command, {
    optionsError: "SENSITIVE_SENTINEL_OPTIONS",
  });
  assert.equal(malformed.private, true);
  assert.doesNotMatch(JSON.stringify(malformed.payload), /SENSITIVE_SENTINEL/);
  assert.doesNotMatch(JSON.stringify(logs), /SENSITIVE_SENTINEL/);
});

test("P2.2 /todo: contexto inválido não divulga a lista DM", async () => {
  const command = freshCommand();
  await run(command, {
    guildId: null,
    subcommand: "add",
    task: "SENSITIVE_DM",
  });
  for (const guildId of ["", {}, "g".repeat(21), "\ud800"]) {
    const response = await run(command, { guildId });
    assert.equal(response.private, true);
    assert.doesNotMatch(JSON.stringify(response.payload), /SENSITIVE_DM/);
    assert.equal(response.payload.embeds, undefined);
    assert.equal(response.payload.files, undefined);
  }
  const missingGuild = interaction();
  delete missingGuild.guildId;
  await command.execute(missingGuild);
  assert.equal(result(missingGuild).private, true);
  assert.doesNotMatch(
    JSON.stringify(result(missingGuild).payload),
    /SENSITIVE_DM/,
  );
});

test("P2.2 /todo: contexto incoerente com inGuild é recusado sem ler DM ou servidor", async () => {
  const command = freshCommand();
  await run(command, {
    guildId: null,
    subcommand: "add",
    task: "SENSITIVE_DM_SCOPE",
  });
  await run(command, { subcommand: "add", task: "SENSITIVE_GUILD_SCOPE" });
  for (const [guildId, inGuild] of [
    [null, true],
    ["guild-a", false],
  ]) {
    const it = interaction({ guildId });
    it.inGuild = () => inGuild;
    await command.execute(it);
    const response = result(it);
    assert.equal(response.private, true);
    assert.doesNotMatch(JSON.stringify(response.payload), /SENSITIVE/);
    assert.match(response.payload.content, /contexto/);
  }
});

test("P2.2 /todo: múltiplos servidores não ampliam os cem itens e excesso não revela tarefa", async () => {
  const command = freshCommand();
  for (let i = 0; i < TODO_LIMITS.tasksPerUser; i++) {
    await run(command, {
      guildId: `guild-${i}`,
      subcommand: "add",
      task: `task-${i}`,
    });
  }
  const rejected = await run(command, {
    guildId: null,
    subcommand: "add",
    task: "SENSITIVE_REJECTED_TASK",
  });
  assert.equal(rejected.private, true);
  assert.match(rejected.payload.content, /100 tarefas/);
  assert.doesNotMatch(JSON.stringify(rejected.payload), /SENSITIVE/);
  assert.match(
    (await run(command, { guildId: null })).payload.content,
    /vazia/,
  );
  assert.match(
    body((await run(command, { guildId: "guild-99" })).payload),
    /task-99/,
  );
  await run(command, { guildId: "guild-0", subcommand: "remove", number: 1 });
  const admitted = await run(command, {
    guildId: null,
    subcommand: "add",
    task: "após liberação",
  });
  assert.equal(admitted.private, true);
  assert.match(body(admitted.payload), /após liberação/);
});

test("P2.2 /todo: lista extensa mantém anexo integral e efêmero somente no escopo correto", async () => {
  const command = freshCommand();
  for (const letter of ["a", "b", "c"]) {
    await run(command, {
      subcommand: "add",
      task: letter.repeat(TODO_LIMITS.taskLength),
    });
  }
  const listed = await run(command, {});
  assert.equal(listed.private, true);
  assert.ok(listed.payload.flags & 64);
  assert.equal(listed.payload.files[0].name, "tarefas.txt");
  const text = body(listed.payload);
  for (const letter of ["a", "b", "c"])
    assert.ok(text.includes(letter.repeat(TODO_LIMITS.taskLength)));
  const other = await run(command, { guildId: "guild-b" });
  assert.match(other.payload.content, /vazia/);
  assert.equal(other.payload.files, undefined);
});

test("P2.2 /todo: defer público anterior recebe somente placeholder antes do resultado privado", async () => {
  const command = freshCommand();
  await run(command, { subcommand: "add", task: "SENSITIVE_DEFERRED" });
  const it = interaction({ deferred: true, ephemeral: false });
  await command.execute(it);
  assert.deepEqual(
    it.events.map(({ method }) => method),
    ["editReply", "followUp", "deleteReply"],
  );
  assert.deepEqual(it.events[0].payload, { content: "\u200b" });
  assert.equal(it.events[0].private, false);
  assert.doesNotMatch(
    JSON.stringify(it.events[0].payload),
    /SENSITIVE_DEFERRED/,
  );
  assert.equal(result(it).private, true);
  assert.match(body(result(it).payload), /SENSITIVE_DEFERRED/);
});

test("P2.2 /todo: envio pendente não duplica inserção e não bloqueia outros escopos", async () => {
  const command = freshCommand();
  let release;
  const replyGate = new Promise((resolve) => {
    release = resolve;
  });
  const first = interaction({ subcommand: "add", task: "uma vez", replyGate });
  const execution = command.execute(first);
  await new Promise(setImmediate);
  const duplicate = await run(command, { subcommand: "add", task: "uma vez" });
  assert.match(duplicate.payload.content, /já/);
  assert.doesNotMatch(duplicate.payload.content, /uma vez/);
  const elsewhere = await run(command, { guildId: "guild-b" });
  assert.match(elsewhere.payload.content, /vazia/);
  const listed = await run(command, {});
  assert.equal((body(listed.payload).match(/uma vez/g) || []).length, 1);
  release();
  await execution;
  assert.equal(result(first).private, true);
});

test("P2.2 /todo: falha ao enviar não desfaz estado, não repete e não registra tarefa", async (t) => {
  const command = freshCommand();
  const logs = [];
  t.mock.method(console, "error", (...args) => logs.push(args));
  const it = interaction({
    subcommand: "add",
    task: "SENSITIVE_FAILED_TASK",
    fail: true,
  });
  await runWithErrorHandling(it, () => command.execute(it));
  assert.equal(it.events.length, 1);
  assert.equal(it.events[0].private, true);
  assert.doesNotMatch(JSON.stringify(logs), /SENSITIVE/);
  const listed = await run(command, {});
  assert.match(body(listed.payload), /SENSITIVE_FAILED_TASK/);
  assert.equal(listed.private, true);
  const elsewhere = await run(command, { guildId: "guild-b" });
  assert.match(elsewhere.payload.content, /vazia/);
});

test("P2.2 /todo: instância recarregada começa vazia sem copiar lista do módulo anterior", async () => {
  const original = freshCommand();
  await run(original, { subcommand: "add", task: "processo anterior" });
  const restarted = freshCommand();
  const empty = await run(restarted, {});
  assert.match(empty.payload.content, /vazia/);
  assert.equal(empty.private, true);
  assert.match(body((await run(original, {})).payload), /processo anterior/);
});
