const { readConfig, configurationMessage } = require("./config");
const { safeLog } = require("./logging");

function withinDeadline(operation, milliseconds, schedule, cancel) {
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = schedule(
      () => reject(new Error("Prazo de inicialização excedido.")),
      milliseconds,
    );
  });
  // Promise.race also handles a late rejection after the deadline has won.
  const work = Promise.resolve().then(operation);
  return Promise.race([work, deadline]).finally(() => cancel(timer));
}

async function startBot({
  env,
  loadEnvironment = () => {},
  loadCatalog,
  createClient,
  setupClient,
  logger = console,
  processState = process,
  schedule = setTimeout,
  cancel = clearTimeout,
  loginTimeoutMs = 30000,
  cleanupTimeoutMs = 2000,
  forceExitAfterMs = 5000,
}) {
  let client;
  let cleanup;
  let phase = "config";
  try {
    await loadEnvironment();
    const config = readConfig(env);
    phase = "catalog";
    const catalog = await loadCatalog();
    phase = "client";
    client = createClient();
    phase = "setup";
    cleanup = await setupClient(client, catalog);
    phase = "login";
    await withinDeadline(
      () => client.login(config.token),
      loginTimeoutMs,
      schedule,
      cancel,
    );
    // login's return value can contain the token; it is never logged/returned.
    return { ok: true, client };
  } catch (error) {
    processState.exitCode = 1;
    safeLog(
      "error",
      configurationMessage(error) ||
        (phase === "login"
          ? "Falha no login do Discord. Confira a configuração e a conectividade."
          : "Falha ao preparar o bot. Confira a configuração e o catálogo local."),
      logger,
    );

    // exitCode alone cannot stop active SDK sockets or an incomplete cleanup.
    // Unref permits a clean process to exit naturally; remaining handles get a
    // bounded final exit. Tests inject a process facade and a simulated clock.
    const forceExit = schedule(() => processState.exit(1), forceExitAfterMs);
    forceExit.unref?.();

    if (client || typeof cleanup === "function") {
      try {
        const results = await withinDeadline(
          () =>
            Promise.allSettled([
              Promise.resolve().then(
                () => typeof cleanup === "function" && cleanup(),
              ),
              Promise.resolve().then(() => client?.destroy()),
            ]),
          cleanupTimeoutMs,
          schedule,
          cancel,
        );
        if (results.some((result) => result.status === "rejected")) {
          safeLog(
            "error",
            "Falha ao limpar recursos da inicialização.",
            logger,
          );
        }
      } catch {
        safeLog("error", "Prazo de limpeza da inicialização excedido.", logger);
      }
    }
    return { ok: false };
  }
}

module.exports = { startBot };
