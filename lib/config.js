const MESSAGES = Object.freeze({
  TOKEN_REQUIRED:
    "TOKEN ausente. Configure o token do bot no ambiente ou no .env.",
  TOKEN_INVALID:
    "TOKEN evidentemente inválido. Confira o valor do token do bot.",
  CLIENT_ID_REQUIRED:
    "Identidade Discord ausente. Configure CLIENT_ID com o ID da aplicação.",
  CLIENT_ID_INVALID:
    "CLIENT_ID inválido. Use o ID decimal da aplicação Discord.",
  INVITE_INVALID:
    "INVITE_URL inválida. Use o convite Discord com os scopes e permissões documentados ou deixe vazio.",
  INVITE_ID_MISMATCH:
    "Identidade do convite divergente da aplicação Discord. Confira CLIENT_ID e INVITE_URL.",
  LOFIRADIO_URL_INVALID:
    "LOFIRADIO_URL inválida. Use uma URL HTTPS pública sem credenciais, parâmetros ou fragmento.",
});

// External pages belong to the historical CodeBucket, not to a new Discord app.
const PUBLIC_LINKS = Object.freeze({
  vote: "https://top.gg/bot/1193011045577523300",
  lofi: "https://lofiradio.web.app",
});

// ViewChannel, SendMessages, EmbedLinks, AttachFiles, ReadMessageHistory,
// AddReactions. Threads need an additional permission for timer delivery.
const INVITE_PERMISSIONS = "117824";

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

function readClientId(value, { required = false } = {}) {
  if (value === undefined || value === null || value === "") {
    if (required) throw new ConfigurationError("CLIENT_ID_REQUIRED");
    return undefined;
  }
  if (
    typeof value !== "string" ||
    !/^[1-9]\d{16,19}$/.test(value) ||
    BigInt(value) > (1n << 64n) - 1n
  ) {
    throw new ConfigurationError("CLIENT_ID_INVALID");
  }
  return value;
}

function parsePublicUrl(value, code, { query = false } = {}) {
  try {
    if (
      typeof value !== "string" ||
      value.length === 0 ||
      value.length > 512 ||
      !value.isWellFormed() ||
      !/^https:\/\//i.test(value) ||
      /[\s\u0000-\u001f\u007f\\]/u.test(value) ||
      /%(?![\da-f]{2})/i.test(value) ||
      /[\u0000-\u001f\u007f]/u.test(decodeURIComponent(value))
    ) {
      throw new Error();
    }
    const url = new URL(value);
    const host = url.hostname;
    const authority = value.match(/^https:\/\/([^/?#]*)/i)?.[1];
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      !authority ||
      /[@:]/.test(authority) ||
      value.includes("#") ||
      (!query && value.includes("?")) ||
      !host.includes(".") ||
      host.length > 253 ||
      host.split(".").some((label) => label.length > 63) ||
      !/^(?:[a-z\d](?:[a-z\d-]*[a-z\d])?\.)+[a-z](?:[a-z\d-]*[a-z\d])?$/i.test(
        host,
      ) ||
      /\.(?:localhost|local|internal|test|invalid|example)$/i.test(host)
    ) {
      throw new Error();
    }
    if (url.href.length > 512) throw new Error();
    return url;
  } catch {
    // Never retain the input URL, parser exception or cause in diagnostics.
    throw new ConfigurationError(code);
  }
}

function validateInviteUrl(value, expectedId) {
  const url = parsePublicUrl(value, "INVITE_INVALID", { query: true });
  const params = url.searchParams;
  const keys = [...params.keys()];
  if (
    url.hostname !== "discord.com" ||
    !["/oauth2/authorize", "/api/oauth2/authorize"].includes(url.pathname) ||
    keys.length !== 3 ||
    !["client_id", "permissions", "scope"].every(
      (key) => params.getAll(key).length === 1,
    ) ||
    params.get("permissions") !== INVITE_PERMISSIONS ||
    !["bot applications.commands", "applications.commands bot"].includes(
      params.get("scope"),
    )
  ) {
    throw new ConfigurationError("INVITE_INVALID");
  }
  let clientId;
  try {
    clientId = readClientId(params.get("client_id"), { required: true });
  } catch {
    throw new ConfigurationError("INVITE_INVALID");
  }
  if (expectedId && expectedId !== clientId) {
    throw new ConfigurationError("INVITE_ID_MISMATCH");
  }
}

function buildInviteUrl(env, applicationId) {
  const configuredId = readClientId(env?.CLIENT_ID);
  const actualId = readClientId(applicationId);
  if (configuredId && actualId && configuredId !== actualId) {
    throw new ConfigurationError("INVITE_ID_MISMATCH");
  }
  const clientId = readClientId(actualId || configuredId, { required: true });
  if (env?.INVITE_URL) validateInviteUrl(env.INVITE_URL, clientId);
  else if (env?.INVITE_URL !== undefined && env.INVITE_URL !== "") {
    throw new ConfigurationError("INVITE_INVALID");
  }
  const url = new URL("https://discord.com/oauth2/authorize");
  url.search = new URLSearchParams({
    client_id: clientId,
    permissions: INVITE_PERMISSIONS,
    scope: "bot applications.commands",
  }).toString();
  return url.href;
}

function readLofiUrl(env) {
  const value = env?.LOFIRADIO_URL;
  if (value === undefined || value === "") return PUBLIC_LINKS.lofi;
  // Keep the same destination safe in the Markdown description and builders.
  const url = parsePublicUrl(value, "LOFIRADIO_URL_INVALID").href.replace(
    /[()[\]]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  if (url.length > 512) throw new ConfigurationError("LOFIRADIO_URL_INVALID");
  return url;
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
  const clientId = readClientId(env?.CLIENT_ID, { required: registration });
  if (clientId) config.clientId = clientId;
  if (env?.INVITE_URL !== undefined && env.INVITE_URL !== "") {
    validateInviteUrl(env.INVITE_URL, clientId);
  }
  readLofiUrl(env);
  return config;
}

module.exports = {
  readConfig,
  readClientId,
  buildInviteUrl,
  readLofiUrl,
  PUBLIC_LINKS,
  INVITE_PERMISSIONS,
  ConfigurationError,
  configurationMessage,
};
