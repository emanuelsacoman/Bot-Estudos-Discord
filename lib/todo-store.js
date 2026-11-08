const { DISCORD_LIMITS, validText } = require("./content-limits");

const DUPLICATE_PREFIX = 'A tarefa "';
const DUPLICATE_SUFFIX = '" já está na sua lista.';
const TODO_LIMITS = Object.freeze({
  // The duplicate notice must fit one message, including its surrounding text.
  taskLength:
    DISCORD_LIMITS.content - DUPLICATE_PREFIX.length - DUPLICATE_SUFFIX.length,
  // Local admission budgets, not Discord limits: bound text and array/Map
  // cardinality independently. Reject new work; never evict existing tasks.
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

function createTodoStore(overrides = {}) {
  const limits = { ...TODO_LIMITS, ...overrides };
  const lists = new Map();
  let totalBytes = 0;

  function list(userId) {
    return lists.get(userId)?.tasks.slice() || [];
  }

  function add(userId, task) {
    // Discord user IDs are uint64 snowflakes (at most 20 decimal digits).
    if (!validText(userId, 20) || !validText(task, limits.taskLength)) {
      throw new TodoStoreError("INVALID_TASK");
    }
    const entry = lists.get(userId);
    const bytes = Buffer.byteLength(task, "utf8");
    if (entry?.tasks.includes(task)) throw new TodoStoreError("DUPLICATE");
    if ((entry?.tasks.length || 0) >= limits.tasksPerUser) {
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
    const current = entry || { tasks: [], bytes: 0 };
    current.tasks.push(task);
    current.bytes += bytes;
    totalBytes += bytes;
    lists.set(userId, current);
  }

  function remove(userId, number) {
    const entry = lists.get(userId);
    if (
      !Number.isSafeInteger(number) ||
      number < 1 ||
      number > (entry?.tasks.length || 0)
    ) {
      throw new TodoStoreError("INVALID_NUMBER");
    }
    const [task] = entry.tasks.splice(number - 1, 1);
    const bytes = Buffer.byteLength(task, "utf8");
    entry.bytes -= bytes;
    totalBytes -= bytes;
    if (entry.tasks.length === 0) lists.delete(userId);
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
