const MESSAGES = Object.freeze({
  TOKEN_REQUIRED:
    "TOKEN ausente. Configure o token do bot no ambiente ou no .env.",
  TOKEN_INVALID:
    "TOKEN evidentemente inválido. Confira o valor do token do bot.",
  CLIENT_ID_REQUIRED: "CLIENT_ID ausente. O registro exige o ID da aplicação.",
  CLIENT_ID_INVALID:
    "CLIENT_ID inválido. Use o ID decimal da aplicação Discord.",
});

class ConfigurationError extends Error {
  constructor(code) {
    super(MESSAGES[code] || "Configuração inválida.");
    this.name = "ConfigurationError";
    this.code = code;
  }
}

function configurationMessage(error) {
  return error instanceof ConfigurationError ? MESSAGES[error.code] : undefined;
}

function readConfig(env, { registration = false } = {}) {
  const rawToken = env?.TOKEN;
  // Match the SDK's conventional auth prefixes while keeping the token opaque.
  const token =
    typeof rawToken === "string"
      ? rawToken.replace(/^(?:Bot|Bearer)\s+/i, "")
      : rawToken;
  if (token === undefined || token === null || token === "") {
    throw new ConfigurationError("TOKEN_REQUIRED");
  }
  // Tokens are opaque: reject obvious mistakes, not a guessed token version,
  // encoded identity or application association. No credential is checked online.
  if (
    typeof token !== "string" ||
    token.length < 20 ||
    token.length > 512 ||
    !/^[A-Za-z0-9_.-]+$/.test(token) ||
    /(?:SEU|YOUR|COLOQUE|INSIRA|PASTE|SUBSTITUA|REPLACE)[_-].*TOKEN|TOKEN[_-](?:AQUI|HERE)|PLACEHOLDER|CHANGE[_-]?ME/i.test(
      token,
    )
  ) {
    throw new ConfigurationError("TOKEN_INVALID");
  }

  const config = { token };
  if (registration) {
    const clientId = env?.CLIENT_ID;
    if (clientId === undefined || clientId === null || clientId === "") {
      throw new ConfigurationError("CLIENT_ID_REQUIRED");
    }
    if (
      typeof clientId !== "string" ||
      !/^[1-9]\d{16,19}$/.test(clientId) ||
      BigInt(clientId) > (1n << 64n) - 1n
    ) {
      throw new ConfigurationError("CLIENT_ID_INVALID");
    }
    config.clientId = clientId;
  }
  return config;
}

module.exports = { readConfig, ConfigurationError, configurationMessage };
