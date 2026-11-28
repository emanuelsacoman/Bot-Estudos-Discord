const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  prepare,
  parseConfig,
  parseIgnore,
  zip,
  crc32,
} = require("../scripts/discloud-package");

const source = path.resolve(__dirname, "..");
const config =
  "NAME=CodeBucket\nTYPE=bot\nMAIN=index.js\nRAM=100\nVERSION=latest\n";
const ignore = ".git\nnode_modules\n.env\ntests\ndocs\nscripts\ndist\n";

function fixture(t) {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "codebucket-discloud-test-"),
  );
  t.after(() => {
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith("codebucket-discloud-test-"));
    fs.rmSync(root, { recursive: true, force: true });
  });
  for (const name of ["index.js", "package.json", "package-lock.json"])
    fs.copyFileSync(path.join(source, name), path.join(root, name));
  for (const name of ["commands", "lib", "images"])
    fs.cpSync(path.join(source, name), path.join(root, name), {
      recursive: true,
    });
  fs.writeFileSync(path.join(root, "discloud.config"), config);
  fs.writeFileSync(path.join(root, ".discloudignore"), ignore);
  return root;
}

test("safe package uses a closed runtime list and never reads local credentials", (t) => {
  const root = fixture(t);
  fs.writeFileSync(path.join(root, ".env"), "TOKEN=PRIVATE_TEST_SENTINEL");
  fs.writeFileSync(
    path.join(root, "credentials.json"),
    "PRIVATE_TEST_SENTINEL",
  );
  const originalRead = fs.readFileSync;
  t.mock.method(fs, "readFileSync", (file, ...args) => {
    assert.notEqual(path.basename(String(file)), ".env");
    assert.notEqual(path.basename(String(file)), "credentials.json");
    return originalRead(file, ...args);
  });
  const { entries, report } = prepare(root);
  assert.equal(entries.length, 45);
  assert.equal(
    entries.filter(({ name }) => name.startsWith("commands/")).length,
    23,
  );
  assert.equal(
    entries.filter(({ name }) => name.startsWith("images/")).length,
    3,
  );
  assert.ok(entries.some(({ name }) => name === "package-lock.json"));
  assert.ok(
    entries.every(
      ({ name }) => !/\.env|node_modules|^docs\/|^tests\//.test(name),
    ),
  );
  assert.match(report.runtimeCompatibility, /NOT_CONFIRMED/);
  assert.equal(
    zip(entries).includes(Buffer.from("PRIVATE_TEST_SENTINEL")),
    false,
  );
});

test("ZIP is deterministic, with no enclosing folder and independently readable headers", (t) => {
  const { entries } = prepare(fixture(t));
  const archive = zip(entries);
  assert.deepEqual(archive, zip(entries));
  assert.equal(crc32(Buffer.from("123456789")), 0xcbf43926);
  const end = archive.length - 22;
  assert.equal(archive.readUInt32LE(end), 0x06054b50);
  assert.equal(archive.readUInt16LE(end + 10), entries.length);
  let position = archive.readUInt32LE(end + 16);
  for (const expected of entries) {
    assert.equal(archive.readUInt32LE(position), 0x02014b50);
    const filenameLength = archive.readUInt16LE(position + 28);
    const filename = archive
      .subarray(position + 46, position + 46 + filenameLength)
      .toString("utf8");
    assert.equal(filename, expected.name);
    const local = archive.readUInt32LE(position + 42);
    assert.equal(archive.readUInt32LE(local), 0x04034b50);
    assert.equal(archive.readUInt16LE(local + 8), 0);
    assert.equal(archive.readUInt32LE(local + 18), expected.data.length);
    const start = local + 30 + archive.readUInt16LE(local + 26);
    assert.deepEqual(
      archive.subarray(start, start + expected.data.length),
      expected.data,
    );
    position += 46 + filenameLength;
  }
  assert.equal(position, end);
});

test("config accepts only the verified Free structure, without certifying the runtime", () => {
  assert.equal(parseConfig(config).VERSION, "latest");
  for (const invalid of [
    config.replace("latest", "24"),
    config + "AUTORESTART=true\n",
    config.replace("100", "512"),
    config + "RAM=100\n",
    config.replace("MAIN=index.js", "MAIN=../index.js"),
  ]) {
    assert.throws(() => parseConfig(invalid));
  }
});

test("ignore rejects globs, paths, trailing slashes, negation and missing protections", () => {
  for (const line of [
    "*.log",
    "docs/",
    "foo/bar",
    "foo\\bar",
    "!package-lock.json",
    "[cache]",
    " node_modules",
  ]) {
    assert.throws(() => parseIgnore(ignore + line + "\n"));
  }
  assert.throws(() => parseIgnore(ignore.replace(".env\n", "")));
});

for (const name of [
  "index.js",
  "package-lock.json",
  "commands",
  "lib",
  "images",
  "lofiicon.png",
]) {
  test(`ignore cannot remove required runtime: ${name}`, (t) => {
    const root = fixture(t);
    fs.appendFileSync(path.join(root, ".discloudignore"), name + "\n");
    assert.throws(() => prepare(root), /RUNTIME_IGNORED/);
  });
}

test("missing assets and missing local imports fail closed", (t) => {
  const root = fixture(t);
  fs.renameSync(
    path.join(root, "images/lofiicon.png"),
    path.join(root, "images/renamed.png"),
  );
  assert.throws(() => prepare(root), /ASSET_SET/);
  fs.renameSync(
    path.join(root, "images/renamed.png"),
    path.join(root, "images/lofiicon.png"),
  );
  fs.appendFileSync(
    path.join(root, "index.js"),
    '\nrequire("./missing-helper");\n',
  );
  assert.throws(() => prepare(root), /IMPORT_MISSING/);
});

test("unexpected files and symbolic directory links are refused", (t) => {
  const root = fixture(t);
  fs.writeFileSync(path.join(root, "commands/private.txt"), "private");
  assert.throws(() => prepare(root), /UNEXPECTED_RUNTIME_FILE/);
  fs.renameSync(
    path.join(root, "commands"),
    path.join(root, "commands-original"),
  );
  fs.symlinkSync(
    path.join(root, "commands-original"),
    path.join(root, "commands"),
    "junction",
  );
  assert.throws(() => prepare(root), /DIRECTORY_TYPE/);
});

test("hardcoded token patterns are rejected without disclosing matched text", (t) => {
  const root = fixture(t);
  const sentinel = "NEVER_DISCLOSE_TEST_VALUE";
  fs.appendFileSync(
    path.join(root, "index.js"),
    `\nconst TOKEN = "${sentinel}";\n`,
  );
  assert.throws(
    () => prepare(root),
    (error) =>
      error.message === "POSSIBLE_SECRET" && !error.message.includes(sentinel),
  );
});

test("new undeclared imports, dynamic loading and dependency drift require review", (t) => {
  const root = fixture(t);
  const entry = path.join(root, "index.js");
  const original = fs.readFileSync(entry);
  fs.appendFileSync(entry, '\nrequire("unlisted-package");\n');
  assert.throws(() => prepare(root), /IMPORT_DEPENDENCY/);
  fs.writeFileSync(entry, original);
  fs.appendFileSync(entry, "\nrequire(variable);\n");
  assert.throws(() => prepare(root), /IMPORT_REVIEW_REQUIRED/);
  fs.writeFileSync(entry, original);
  const manifestPath = path.join(root, "package.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath));
  manifest.dependencies.prettier = "*";
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  assert.throws(() => prepare(root), /LOCK_DEPENDENCIES/);
});
