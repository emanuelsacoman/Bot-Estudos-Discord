// Offline preparation probe. This process never starts the bot or reads .env.
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const { fileURLToPath } = require("node:url");

async function measure() {
  if (
    process.argv.length !== 2 ||
    process.versions.node.split(".")[0] !== "24"
  ) {
    throw new Error("PROBE_CONFIGURATION");
  }

  // Only this short-lived probe's environment changes; no parent/local secret
  // is read, emitted, modified or copied into a generated artifact.
  for (const key of Object.keys(process.env)) delete process.env[key];
  const attempts = {
    network: 0,
    credentials: 0,
    filesystemWrites: 0,
    login: 0,
  };
  const refuse = (category) => () => {
    attempts[category] += 1;
    throw new Error("OFFLINE_PROBE_BLOCKED");
  };
  const noNetwork = refuse("network");
  const noCredentials = refuse("credentials");
  const noWrites = refuse("filesystemWrites");
  const noLogin = refuse("login");

  require("node:net").Socket.prototype.connect = noNetwork;
  require("node:net").Server.prototype.listen = noNetwork;
  require("node:tls").connect = noNetwork;
  require("node:dgram").createSocket = noNetwork;
  for (const transport of [require("node:http"), require("node:https")]) {
    transport.request = transport.get = noNetwork;
  }
  for (const dns of [require("node:dns"), require("node:dns/promises")]) {
    for (const name of Object.keys(dns)) {
      if (
        name === "lookup" ||
        name === "lookupService" ||
        name.startsWith("resolve")
      ) {
        if (typeof dns[name] === "function") dns[name] = noNetwork;
      }
    }
    for (const name of Object.getOwnPropertyNames(dns.Resolver.prototype)) {
      if (name.startsWith("resolve")) dns.Resolver.prototype[name] = noNetwork;
    }
  }
  globalThis.fetch = noNetwork;

  const secretPath = (file) => {
    if (file instanceof URL) file = fileURLToPath(file);
    if (Buffer.isBuffer(file)) file = file.toString("utf8");
    return (
      typeof file === "string" && /^\.env(?:\.|$)/i.test(path.basename(file))
    );
  };
  for (const target of [fs, fs.promises]) {
    for (const method of [
      "readFile",
      "readFileSync",
      "open",
      "openSync",
      "createReadStream",
    ]) {
      if (typeof target[method] !== "function") continue;
      const original = target[method];
      target[method] = function (file, ...args) {
        if (secretPath(file)) noCredentials();
        return original.call(this, file, ...args);
      };
    }
    for (const method of [
      "writeFile",
      "appendFile",
      "truncate",
      "unlink",
      "mkdir",
      "rename",
      "copyFile",
      "rm",
      "rmdir",
      "createWriteStream",
    ]) {
      if (typeof target[method] === "function") target[method] = noWrites;
      if (typeof target[`${method}Sync`] === "function")
        target[`${method}Sync`] = noWrites;
    }
  }
  const originalLoad = Module._load;
  Module._load = function (request, ...args) {
    if (request === "dotenv" || request.startsWith("dotenv/")) noCredentials();
    return originalLoad.call(this, request, ...args);
  };

  const samples = [];
  const sample = (stage) => {
    const bytes = process.memoryUsage();
    const mib = Object.fromEntries(
      Object.entries(bytes).map(([key, value]) => [
        key,
        Number((value / 1024 ** 2).toFixed(2)),
      ]),
    );
    samples.push({ stage, bytes, mib });
  };
  sample("baseline");
  const catalog = require("../lib/command-catalog").loadCommandCatalog();
  await new Promise((resolve) => setImmediate(resolve));
  sample("catalog-loaded");
  const { Client, GatewayIntentBits, REST } = require("discord.js");
  Client.prototype.login = noLogin;
  REST.prototype.put = noNetwork;
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  let qrBytes;
  try {
    sample("client-without-login-empty-caches");
    const prettier = require("prettier");
    const sources = {
      babel: "const a={b:1};",
      html: "<div><span>probe</span></div>",
      css: "a{color:red}",
      json: '{"probe":1}',
      markdown: "# Probe\n\nLocal input",
    };
    for (const [parser, source] of Object.entries(sources)) {
      await prettier.format(source, { parser });
    }
    sample("five-prettier-parsers-warmed");
    const png = await require("qrcode").toBuffer("1".repeat(5596), {
      type: "png",
      errorCorrectionLevel: "M",
    });
    qrBytes = png.length;
    sample("qr-5596-numeric-characters");
  } finally {
    await client.destroy();
  }
  if (Object.values(attempts).some((value) => value !== 0)) {
    throw new Error("PROBE_ATTEMPT_DETECTED");
  }
  return {
    kind: "offline-synthetic-memory-probe",
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    remote: "NOT_CONFIRMED",
    connectedGuilds: 0,
    commands: catalog.commands.length,
    qrBytes,
    attempts,
    samples,
  };
}

if (require.main === module) {
  measure().then(
    (result) => console.log(JSON.stringify(result, null, 2)),
    () => {
      console.error(
        "Medição offline indisponível; nenhum diagnóstico bruto foi emitido.",
      );
      process.exitCode = 1;
    },
  );
}
