const { REST, Routes } = require("discord.js");
const { readConfig, configurationMessage } = require("./config");
const { safeLog } = require("./logging");
const {
  loadCommandCatalog,
  validateCommandPayloads,
  CommandCatalogError,
} = require("./command-catalog");

const CONFIRM_ARGUMENT = "--confirm-global-replacement";
const REST_TIMEOUT_MS = 15000;

class RegistrationError extends Error {
  constructor(code) {
    super("Não foi possível concluir o registro global de comandos.");
    this.name = "RegistrationError";
    this.code = code;
  }
}

function prepareRegistration({
  env = process.env,
  loadCatalog = loadCommandCatalog,
} = {}) {
  const config = readConfig(env, { registration: true });
  const { payload } = loadCatalog();
  return { config, payload: validateCommandPayloads(payload) };
}

function cleanupRest(rest) {
  // Sweepers belong to this REST instance. Never close a global dispatcher.
  for (const method of ["clearHashSweeper", "clearHandlerSweeper"]) {
    try {
      rest?.[method]?.();
    } catch {
      /* Never expose cleanup errors. */
    }
  }
  try {
    rest?.setToken?.(null);
  } catch {
    /* Drop the local token when possible. */
  }
  try {
    const cleanup = rest?.agent?.destroy?.();
    cleanup?.catch?.(() => {});
  } catch {
    /* Cleanup must never trigger another global PUT. */
  }
}

async function sendRegistration({
  config,
  payload,
  confirmed,
  createRest = (options) => new REST(options),
} = {}) {
  if (confirmed !== true)
    throw new RegistrationError("REGISTRATION_NOT_CONFIRMED");
  const validated = readConfig(
    { TOKEN: config?.token, CLIENT_ID: config?.clientId },
    { registration: true },
  );
  const body = validateCommandPayloads(payload);
  let rest;
  try {
    rest = createRest({
      version: "10",
      timeout: REST_TIMEOUT_MS,
      retries: 0,
      rejectOnRateLimit: () => true,
    });
    rest.setToken(validated.token);
    await rest.put(Routes.applicationCommands(validated.clientId), {
      body,
      signal: AbortSignal.timeout(REST_TIMEOUT_MS),
    });
    return { count: body.length };
  } catch {
    throw new RegistrationError("REGISTRATION_SEND_FAILED");
  } finally {
    cleanupRest(rest);
  }
}

async function runRegistration({
  argv = process.argv.slice(2),
  env = process.env,
  loadEnvironment = () => require("dotenv").config(),
  loadCatalog = loadCommandCatalog,
  createRest,
  logger = console,
} = {}) {
  if (
    !Array.isArray(argv) ||
    argv.length !== 1 ||
    !["--dry-run", CONFIRM_ARGUMENT].includes(argv[0])
  ) {
    safeLog(
      "error",
      "Registro bloqueado. Use --dry-run para validar offline ou --confirm-global-replacement para confirmar a substituição global.",
      logger,
    );
    return 1;
  }
  try {
    if (argv[0] === "--dry-run") {
      const { payload } = loadCatalog();
      const validated = validateCommandPayloads(payload);
      safeLog(
        "log",
        `Catálogo validado offline: ${validated.length} comandos. Nenhum registro enviado.`,
        logger,
      );
      return 0;
    }
    loadEnvironment();
    const prepared = prepareRegistration({ env, loadCatalog });
    const result = await sendRegistration({
      ...prepared,
      confirmed: true,
      createRest,
    });
    safeLog(
      "log",
      `Registro global concluído: ${result.count} comandos.`,
      logger,
    );
    return 0;
  } catch (error) {
    safeLog(
      "error",
      configurationMessage(error) ||
        (error instanceof CommandCatalogError
          ? "Não foi possível validar o catálogo de comandos."
          : "Não foi possível concluir o registro global de comandos."),
      logger,
    );
    return 1;
  }
}

module.exports = {
  prepareRegistration,
  sendRegistration,
  runRegistration,
  main: runRegistration,
  RegistrationError,
  CONFIRM_ARGUMENT,
  REST_TIMEOUT_MS,
};
