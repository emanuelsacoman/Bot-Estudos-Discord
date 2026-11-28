const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { test } = require("node:test");

const script = path.resolve(__dirname, "../scripts/discloud-memory.js");
const marker = "PRIVATE_PROBE_TEST_MARKER";
const guard = `
  import { createRequire } from "node:module";
  const require = createRequire(${JSON.stringify(script)});
  const Module = require("node:module");
  const path = require("node:path");
  const root = ${JSON.stringify(path.resolve("."))};
  const load = Module._load;
  Module._load = function(request, parent, ...args) {
    const resolved = Module._resolveFilename(request, parent);
    if (request === "dotenv" || resolved === path.join(root, "index.js") || resolved === path.join(root, "deploy-commands.js")) {
      throw new Error("PROBE_IMPORTED_FORBIDDEN_ENTRY");
    }
    return load.call(this, request, parent, ...args);
  };
`;

function run(args = []) {
  return spawnSync(
    process.execPath,
    [
      "--import",
      `data:text/javascript;base64,${Buffer.from(guard).toString("base64")}`,
      script,
      ...args,
    ],
    {
      cwd: path.resolve(__dirname, ".."),
      env: {
        ...process.env,
        TOKEN: marker,
        CLIENT_ID: marker,
        NODE_OPTIONS: "",
      },
      encoding: "utf8",
      timeout: 45000,
    },
  );
}

test("medição Discloud: workload local, métricas agregadas e zero operações proibidas", () => {
  const result = run();
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  assert.doesNotMatch(result.stdout, new RegExp(marker));
  const report = JSON.parse(result.stdout);
  assert.equal(report.remote, "NOT_CONFIRMED");
  assert.equal(report.commands, 23);
  assert.equal(report.connectedGuilds, 0);
  assert.deepEqual(report.attempts, {
    network: 0,
    credentials: 0,
    filesystemWrites: 0,
    login: 0,
  });
  assert.ok(report.qrBytes > 0);
  assert.equal(report.samples.length, 5);
  for (const sample of report.samples) {
    for (const metric of [
      "rss",
      "heapTotal",
      "heapUsed",
      "external",
      "arrayBuffers",
    ]) {
      assert.ok(
        Number.isSafeInteger(sample.bytes[metric]) && sample.bytes[metric] >= 0,
      );
      assert.equal(
        sample.mib[metric],
        Number((sample.bytes[metric] / 1024 ** 2).toFixed(2)),
      );
    }
  }
});

test("medição Discloud: argumentos não podem habilitar login e falhas não ecoam valores", () => {
  const result = run([`--login=${marker}`]);
  assert.equal(result.error, undefined);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.doesNotMatch(result.stderr, new RegExp(marker));
  assert.match(result.stderr, /Medição offline indisponível/);
});
