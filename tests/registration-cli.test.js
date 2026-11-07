const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { test } = require("node:test");

// Preload guards in the child BEFORE the real CLI is loaded. These modes must
// not read .env, authenticate, create a connection or submit a REST request.
const guard = `
  import { createRequire } from "node:module";
  const require = createRequire(process.cwd() + "/package.json");
  const refuse = () => { throw new Error("Real service forbidden in CLI test"); };
  const fs = require("node:fs");
  const read = fs.readFileSync;
  fs.readFileSync = function(file, ...args) {
    if (typeof file === "string" && /(?:^|[\\\\/])\\.env(?:$|\\.)/.test(file)) refuse();
    return read.call(this, file, ...args);
  };
  require("node:dns").lookup = refuse;
  require("node:dns/promises").lookup = refuse;
  require("node:net").Socket.prototype.connect = refuse;
  require("node:tls").connect = refuse;
  for (const transport of [require("node:http"), require("node:https")]) {
    transport.request = transport.get = refuse;
  }
  globalThis.fetch = refuse;
  require("dotenv").config = refuse;
  const sdk = require("discord.js");
  sdk.Client.prototype.login = refuse;
  sdk.REST.prototype.put = refuse;
`;

for (const { name, args, status, message } of [
  {
    name: "sem confirmação",
    args: [],
    status: 1,
    message: /Registro bloqueado/,
  },
  {
    name: "validação offline explícita",
    args: ["--dry-run"],
    status: 0,
    message:
      /Catálogo validado offline: 23 comandos\. Nenhum registro enviado\./,
  },
  {
    name: "valor falso anexado à confirmação",
    args: ["--confirm-global-replacement=false"],
    status: 1,
    message: /Registro bloqueado/,
  },
  {
    name: "flags conflitantes",
    args: ["--dry-run", "--confirm-global-replacement"],
    status: 1,
    message: /Registro bloqueado/,
  },
]) {
  test(`CLI de registro: ${name}, sem credenciais ou rede`, () => {
    const result = spawnSync(
      process.execPath,
      [
        "--preserve-symlinks",
        "--preserve-symlinks-main",
        "--import",
        `data:text/javascript;base64,${Buffer.from(guard).toString("base64")}`,
        path.resolve(__dirname, "../deploy-commands.js"),
        ...args,
      ],
      {
        cwd: path.resolve(__dirname, ".."),
        env: { ...process.env, TOKEN: "", CLIENT_ID: "", NODE_OPTIONS: "" },
        encoding: "utf8",
        // A stuck CLI must fail the check, never stall the entire test run.
        timeout: 10000,
      },
    );
    assert.equal(result.error, undefined);
    assert.equal(result.signal, null);
    assert.equal(result.status, status);
    const output = result.stdout + result.stderr;
    assert.match(output, message);
    assert.doesNotMatch(
      output,
      /Real service forbidden|Registro global concluído/,
    );
  });
}
