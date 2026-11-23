const { DISCORD_LIMITS, validText } = require("./content-limits");

const DUPLICATE_PREFIX = 'A tarefa "';
const DUPLICATE_SUFFIX = '" já está na sua lista.';
const TODO_LIMITS = Object.freeze({
  // Retain P2.1's task length even though duplicate errors no longer echo text.
  taskLength:
    DISCORD_LIMITS.content - DUPLICATE_PREFIX.length - DUPLICATE_SUFFIX.length,
  // Local admission budgets, not Discord limits: bound text and array/Map
  // cardinality independently. User totals aggregate every guild and DM scope;
  // at most one nonempty scope per task also bounds scope metadata. Reject new
  // work; never evict existing tasks or expand quotas by joining more guilds.
  tasksPerUser: 100,
  bytesPerUser: 64 * 1024,
  totalBytes: 8 * 1024 * 1024,
  users: 1024,
});

class TodoStoreError extends Error {
  constructor(code) {
    super("Não foi possível atualizar a lista de tarefas.");
    this.name = "TodoStoreError";
    this.code = code;
  }
}

function readContext(context) {
  // Missing context must never fall back to a user's DM or to a global list.
  // Read each identity only once; retain strings, never the mutable caller object.
  let userId;
  let guildId;
  try {
    if (!context || typeof context !== "object" || Array.isArray(context)) {
      throw new TodoStoreError("INVALID_CONTEXT");
    }
    ({ userId, guildId } = context);
  } catch {
    throw new TodoStoreError("INVALID_CONTEXT");
  }
  // Discord IDs fit uint64 (20 decimal digits). Keep IDs opaque and avoid any
  // coercion/concatenation: Map keys separate DM's null from every guild string.
  if (!validText(userId, 20) || (guildId !== null && !validText(guildId, 20))) {
    throw new TodoStoreError("INVALID_CONTEXT");
  }
  return { userId, guildId };
}

function createTodoStore(overrides = {}) {
  const limits = { ...TODO_LIMITS, ...overrides };
  // User -> { scopes: Map<guildId | null, task[]>, count, bytes }.
  // null is exclusively the DM scope; channel IDs are intentionally irrelevant.
  const lists = new Map();
  let totalBytes = 0;

  function list(context) {
    const { userId, guildId } = readContext(context);
    return lists.get(userId)?.scopes.get(guildId)?.slice() || [];
  }

  function add(context, task) {
    const { userId, guildId } = readContext(context);
    if (!validText(task, limits.taskLength)) {
      throw new TodoStoreError("INVALID_TASK");
    }
    const entry = lists.get(userId);
    const tasks = entry?.scopes.get(guildId);
    const bytes = Buffer.byteLength(task, "utf8");
    if (tasks?.includes(task)) throw new TodoStoreError("DUPLICATE");
    if ((entry?.count || 0) >= limits.tasksPerUser) {
      throw new TodoStoreError("USER_TASKS");
    }
    if ((entry?.bytes || 0) + bytes > limits.bytesPerUser) {
      throw new TodoStoreError("USER_BYTES");
    }
    if (
      (!entry && lists.size >= limits.users) ||
      totalBytes + bytes > limits.totalBytes
    ) {
      throw new TodoStoreError("CAPACITY");
    }
    const current = entry || { scopes: new Map(), count: 0, bytes: 0 };
    const scopedTasks = tasks || [];
    scopedTasks.push(task);
    current.scopes.set(guildId, scopedTasks);
    current.count += 1;
    current.bytes += bytes;
    totalBytes += bytes;
    lists.set(userId, current);
  }

  function remove(context, number) {
    const { userId, guildId } = readContext(context);
    const entry = lists.get(userId);
    const tasks = entry?.scopes.get(guildId);
    if (
      !Number.isSafeInteger(number) ||
      number < 1 ||
      number > (tasks?.length || 0)
    ) {
      throw new TodoStoreError("INVALID_NUMBER");
    }
    const [task] = tasks.splice(number - 1, 1);
    const bytes = Buffer.byteLength(task, "utf8");
    entry.bytes -= bytes;
    entry.count -= 1;
    totalBytes -= bytes;
    if (tasks.length === 0) entry.scopes.delete(guildId);
    if (entry.count === 0) lists.delete(userId);
    return task;
  }

  return {
    list,
    add,
    remove,
    usage: () => ({ users: lists.size, totalBytes }),
  };
}

module.exports = {
  TODO_LIMITS,
  DUPLICATE_PREFIX,
  DUPLICATE_SUFFIX,
  TodoStoreError,
  createTodoStore,
};
