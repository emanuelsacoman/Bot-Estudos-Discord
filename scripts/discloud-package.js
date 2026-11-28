const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { builtinModules } = require("node:module");

// This is an offline preparation artifact. It deliberately never loads dotenv,
// imports application code, authenticates, or includes the operator's .env.
const ROOT_FILES = [
  "index.js",
  "package.json",
  "package-lock.json",
  "discloud.config",
  ".discloudignore",
];
const ASSETS = ["lofiicon.png", "lofiradio.jpeg", "topgg.png"];
const REQUIRED_IGNORES = [
  ".git",
  "node_modules",
  ".env",
  "tests",
  "docs",
  "scripts",
  "dist",
];
const BUILTINS = new Set(
  builtinModules.map((name) => name.replace(/^node:/, "")),
);

function check(condition, code) {
  if (!condition) throw new Error(code);
}

function parseConfig(text) {
  const config = {};
  for (const line of text.split(/\r?\n/).filter(Boolean)) {
    const match = /^([A-Z]+)=([^\r\n=]+)$/.exec(line);
    check(match && !Object.hasOwn(config, match[1]), "CONFIG_SYNTAX");
    config[match[1]] = match[2];
  }
  const expected = {
    NAME: "CodeBucket",
    TYPE: "bot",
    MAIN: "index.js",
    RAM: "100",
    VERSION: "latest",
  };
  check(
    JSON.stringify(Object.keys(config).sort()) ===
      JSON.stringify(Object.keys(expected).sort()),
    "CONFIG_FIELDS",
  );
  for (const [key, value] of Object.entries(expected))
    check(config[key] === value, "CONFIG_VALUE");
  return config;
}

function parseIgnore(text) {
  const names = text
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#"));
  check(
    names.every(
      (name) =>
        name === name.trim() &&
        !/[\\/*?!\[\]{}\x00-\x1f]/.test(name) &&
        ![".", ".."].includes(name),
    ),
    "IGNORE_SYNTAX",
  );
  check(new Set(names).size === names.length, "IGNORE_DUPLICATE");
  for (const name of REQUIRED_IGNORES)
    check(names.includes(name), "IGNORE_REQUIRED");
  return new Set(names);
}

function scanSecrets(buffer) {
  // Heuristics supplement the closed file list; this is not a secret scanner
  // with universal coverage. Never include matched text in an error or report.
  const text = buffer.toString("utf8");
  check(
    !/-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/.test(text),
    "POSSIBLE_SECRET",
  );
  check(!/[\w-]{20,}\.[\w-]{6,}\.[\w-]{20,}/.test(text), "POSSIBLE_SECRET");
  check(
    !/\b(?:TOKEN|DISCORD_TOKEN|DISCLOUD_TOKEN|API_KEY|CLIENT_SECRET)["']?\s*[=:]\s*["'][^"'\r\n]+["']/.test(
      text,
    ),
    "POSSIBLE_SECRET",
  );
}

function validateImports(entries, manifest) {
  const files = new Set(entries.map((entry) => entry.name));
  for (const { name, data } of entries.filter((entry) =>
    entry.name.endsWith(".js"),
  )) {
    const source = data.toString("utf8");
    const calls = [
      ...source.matchAll(/\brequire\s*\(\s*(["'])([^"']+)\1\s*\)/g),
    ];
    check(
      (source.match(/\brequire\s*\(/g) || []).length === calls.length &&
        !/\bimport\s*\(/.test(source),
      "IMPORT_REVIEW_REQUIRED",
    );
    for (const [, , request] of calls) {
      if (request.startsWith(".")) {
        const target = path.posix.normalize(
          path.posix.join(path.posix.dirname(name), request),
        );
        check(
          !target.startsWith("../") &&
            [target, `${target}.js`, `${target}/index.js`].some((candidate) =>
              files.has(candidate),
            ),
          "IMPORT_MISSING",
        );
      } else {
        const bare = request.replace(/^node:/, "");
        const dependency = request.startsWith("@")
          ? request.split("/").slice(0, 2).join("/")
          : request.split("/")[0];
        check(
          BUILTINS.has(bare) ||
            Object.hasOwn(manifest.dependencies || {}, dependency),
          "IMPORT_DEPENDENCY",
        );
      }
    }
  }
}

function prepare(root = path.resolve(__dirname, "..")) {
  root = path.resolve(root);
  const entries = [];
  function add(name) {
    const full = path.join(root, ...name.split("/"));
    const stat = fs.lstatSync(full);
    check(stat.isFile() && !stat.isSymbolicLink(), "FILE_TYPE");
    const data = fs.readFileSync(full);
    scanSecrets(data);
    entries.push({ name, data });
  }
  for (const name of ROOT_FILES) add(name);
  for (const directory of ["commands", "lib", "images"]) {
    const full = path.join(root, directory);
    const stat = fs.lstatSync(full);
    check(stat.isDirectory() && !stat.isSymbolicLink(), "DIRECTORY_TYPE");
    const names = fs.readdirSync(full).sort();
    check(names.length > 0, "DIRECTORY_EMPTY");
    if (directory === "images")
      check(JSON.stringify(names) === JSON.stringify(ASSETS), "ASSET_SET");
    for (const name of names) {
      check(
        directory === "images" || /^[a-z0-9-]+\.js$/.test(name),
        "UNEXPECTED_RUNTIME_FILE",
      );
      add(`${directory}/${name}`);
    }
  }
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const read = (name) =>
    entries.find((entry) => entry.name === name).data.toString("utf8");
  const config = parseConfig(read("discloud.config"));
  const ignore = parseIgnore(read(".discloudignore"));
  for (const { name } of entries)
    check(!name.split("/").some((part) => ignore.has(part)), "RUNTIME_IGNORED");
  const manifest = JSON.parse(read("package.json"));
  const lock = JSON.parse(read("package-lock.json"));
  check(
    manifest.engines?.node === "24.x" &&
      lock.packages?.[""]?.engines?.node === "24.x",
    "NODE_POLICY",
  );
  check(
    JSON.stringify(manifest.dependencies) ===
      JSON.stringify(lock.packages[""].dependencies),
    "LOCK_DEPENDENCIES",
  );
  validateImports(entries, manifest);
  return {
    entries,
    report: {
      artifact: "OFFLINE_PREPARATION_WITHOUT_CREDENTIALS",
      config,
      runtimeCompatibility:
        "NOT_CONFIRMED: latest must resolve to Node 24.x before deployment",
      secretCheck:
        "Closed file list, no .env read/included; heuristic content checks passed",
      files: entries.map(({ name, data }) => ({
        name,
        bytes: data.length,
        sha256: crypto.createHash("sha256").update(data).digest("hex"),
      })),
    },
  };
}

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zip(entries) {
  const locals = [];
  const central = [];
  let offset = 0;
  check(entries.length < 65536, "ZIP_LIMIT");
  for (const { name, data } of entries) {
    const filename = Buffer.from(name, "utf8");
    check(filename.length <= 65535 && data.length < 0xffffffff, "ZIP_LIMIT");
    const checksum = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x800, 6);
    local.writeUInt16LE(33, 12); // 1980-01-01, fixed for reproducible archives.
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(filename.length, 26);
    locals.push(local, filename, data);
    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50);
    directory.writeUInt16LE(20, 4);
    directory.writeUInt16LE(20, 6);
    directory.writeUInt16LE(0x800, 8);
    directory.writeUInt16LE(33, 14);
    directory.writeUInt32LE(checksum, 16);
    directory.writeUInt32LE(data.length, 20);
    directory.writeUInt32LE(data.length, 24);
    directory.writeUInt16LE(filename.length, 28);
    directory.writeUInt32LE(offset, 42);
    central.push(directory, filename);
    offset += local.length + filename.length + data.length;
  }
  const directory = Buffer.concat(central);
  check(offset + directory.length < 0xffffffff, "ZIP_LIMIT");
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

function main(args = process.argv.slice(2)) {
  check(
    (args.length === 1 && args[0] === "--check") ||
      (args.length === 2 && args[0] === "--output" && args[1].endsWith(".zip")),
    "USAGE: node scripts/discloud-package.js --check | --output path.zip",
  );
  const { entries, report } = prepare();
  if (args[0] === "--output") {
    const archive = zip(entries);
    // Parent must already exist. Never overwrite an existing artifact or follow
    // an existing destination symlink; wx uses exclusive creation.
    fs.writeFileSync(path.resolve(args[1]), archive, { flag: "wx" });
    report.archive = {
      bytes: archive.length,
      sha256: crypto.createHash("sha256").update(archive).digest("hex"),
    };
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (require.main === module) {
  try {
    main();
  } catch {
    process.stderr.write(
      "DISCLOUD_PACKAGE_FAILED: validation or output refused; no file contents disclosed.\n",
    );
    process.exitCode = 1;
  }
}

module.exports = { prepare, parseConfig, parseIgnore, zip, crc32 };
