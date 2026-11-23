const { safeLog } = require("./logging");

const MIN_TIMER_MINUTES = 1;
const MAX_TIMER_MINUTES = 1440;
const MINUTE_MS = 60 * 1000;

class TimerDurationError extends RangeError {
  constructor() {
    super("Informe um tempo inteiro entre 1 e 1440 minutos.");
    this.name = "TimerDurationError";
  }
}

function validateDuration(minutes) {
  if (
    !Number.isSafeInteger(minutes) ||
    minutes < MIN_TIMER_MINUTES ||
    minutes > MAX_TIMER_MINUTES
  ) {
    throw new TimerDurationError();
  }
  // The maximum is 86400000 ms, safely below Node's 2147483647 ms limit.
  return minutes * MINUTE_MS;
}

function createTimerKey({ userId, guildId, channelId } = {}) {
  const isIdentifier = (value) =>
    typeof value === "string" && value.trim() !== "";
  if (!isIdentifier(userId))
    throw new TypeError("Contexto do temporizador inválido.");
  if (guildId !== null && guildId !== undefined) {
    if (!isIdentifier(guildId))
      throw new TypeError("Contexto do temporizador inválido.");
    return JSON.stringify(["guild", guildId, userId]);
  }
  if (!isIdentifier(channelId))
    throw new TypeError("Contexto do temporizador inválido.");
  return JSON.stringify(["dm", channelId, userId]);
}

function createTimerManager({
  setTimeout: schedule = (...args) => setTimeout(...args),
  clearTimeout: cancel = (...args) => clearTimeout(...args),
  now = () => Date.now(),
  onError = () => safeLog("warn", "Falha ao enviar aviso do temporizador."),
} = {}) {
  const entries = new Map();

  return {
    set(key, minutes, onExpire) {
      const delay = validateDuration(minutes);
      if (typeof key !== "string" || !key || typeof onExpire !== "function") {
        throw new TypeError("Agendamento do temporizador inválido.");
      }
      const previous = entries.get(key);
      const entry = { handle: undefined };
      const expiresAt = now() + delay;

      const expire = async () => {
        // clearTimeout cannot undo a callback already queued. Identity prevents
        // an old callback from sending or removing a replacement timer.
        if (entries.get(key) !== entry) return false;
        entries.delete(key);
        try {
          await onExpire();
        } catch {
          // Neither a Discord failure nor the diagnostic callback may escape
          // as an unhandled rejection. No raw error or user data is retained.
          try {
            await onError();
          } catch {
            // A diagnostic failure must not retry an already attempted send.
          }
        }
        return true;
      };

      entries.set(key, entry);
      try {
        entry.handle = schedule(expire, delay);
      } catch (error) {
        if (entries.get(key) === entry) {
          if (previous) entries.set(key, previous);
          else entries.delete(key);
        }
        throw error;
      }
      // Preserve the previous timer if scheduling the replacement throws.
      if (previous) cancel(previous.handle);
      return { replaced: Boolean(previous), expiresAt };
    },

    stop(key) {
      const entry = entries.get(key);
      if (!entry) return false;
      entries.delete(key);
      cancel(entry.handle);
      return true;
    },

    has(key) {
      return entries.has(key);
    },

    get size() {
      return entries.size;
    },

    clearAll() {
      const active = [...entries.values()];
      entries.clear();
      for (const entry of active) cancel(entry.handle);
      return active.length;
    },
  };
}

module.exports = {
  MIN_TIMER_MINUTES,
  MAX_TIMER_MINUTES,
  TimerDurationError,
  validateDuration,
  createTimerKey,
  createTimerManager,
};
