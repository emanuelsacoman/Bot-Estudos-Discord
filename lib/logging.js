// Callers provide fixed diagnostics or validated aggregate counts. Never pass
// raw errors, user input, interactions, HTTP metadata or credential values.
function safeLog(level, message, logger = console) {
  if (
    !["log", "warn", "error"].includes(level) ||
    typeof message !== "string" ||
    message.length > 500 ||
    !message.trim() ||
    !message.isWellFormed() ||
    /[\u0000-\u001f\u007f]/.test(message)
  ) {
    return false;
  }
  try {
    const write = logger?.[level];
    if (typeof write !== "function") return false;
    // A failing or pending diagnostic must not affect the operation being
    // reported. No recursive logging, retry, queue or persistent buffer.
    Promise.resolve(write.call(logger, message)).catch(() => {});
    return true;
  } catch {
    return false;
  }
}

module.exports = { safeLog };
