const fs = require("node:fs");
const path = require("node:path");

class CommandCatalogError extends Error {
  constructor(code = "CATALOG_INVALID") {
    super("Não foi possível validar o catálogo de comandos.");
    this.name = "CommandCatalogError";
    this.code = code;
  }
}

function check(condition, code = "CATALOG_INVALID") {
  if (!condition) throw new CommandCatalogError(code);
}

// Match REST JSON without coercing unsafe values. Builders include undefined
// object fields, which the REST serializer omits.
function snapshot(value, seen = new Set(), depth = 0) {
  check(depth <= 12);
  if (value === null || ["string", "boolean"].includes(typeof value))
    return value;
  if (typeof value === "number") {
    check(Number.isFinite(value));
    return value;
  }
  check(value && typeof value === "object" && !seen.has(value));
  check(Object.getOwnPropertySymbols(value).length === 0);
  seen.add(value);
  let copy;
  if (Array.isArray(value)) {
    check(Object.keys(value).length === value.length);
    copy = Array.from({ length: value.length }, (_, index) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      check(descriptor && "value" in descriptor);
      return snapshot(descriptor.value, seen, depth + 1);
    });
  } else {
    check([Object.prototype, null].includes(Object.getPrototypeOf(value)));
    copy = {};
    for (const [key, descriptor] of Object.entries(
      Object.getOwnPropertyDescriptors(value),
    )) {
      check(descriptor.enumerable && "value" in descriptor);
      check(!["__proto__", "prototype", "constructor"].includes(key));
      if (descriptor.value !== undefined)
        copy[key] = snapshot(descriptor.value, seen, depth + 1);
    }
  }
  seen.delete(value);
  return Object.freeze(copy);
}

function fields(value, allowed) {
  check(value && typeof value === "object" && !Array.isArray(value));
  check(Object.keys(value).every((key) => allowed.includes(key)));
}

const validName = (name) =>
  typeof name === "string" && /^[a-z0-9_-]{1,32}$/.test(name);
const validText = (text, max) =>
  typeof text === "string" && text.trim().length > 0 && text.length <= max;

function validateChoices(choices, type) {
  check(
    [3, 4, 10].includes(type) &&
      Array.isArray(choices) &&
      choices.length >= 1 &&
      choices.length <= 25,
  );
  const names = new Set();
  for (const choice of choices) {
    fields(choice, ["name", "value"]);
    check(validText(choice.name, 100) && !names.has(choice.name));
    names.add(choice.name);
    if (type === 3) check(validText(choice.value, 100));
    else
      check(
        typeof choice.value === "number" &&
          Number.isFinite(choice.value) &&
          (type !== 4 || Number.isSafeInteger(choice.value)),
      );
  }
}

function validateOptions(options = [], parent = "root") {
  check(Array.isArray(options) && options.length <= 25);
  const names = new Set();
  let optionalSeen = false;
  const hasSubcommands = options.some(
    (option) => option?.type === 1 || option?.type === 2,
  );
  for (const option of options) {
    fields(option, [
      "type",
      "name",
      "description",
      "required",
      "options",
      "choices",
    ]);
    check(validName(option.name) && validText(option.description, 100));
    check(!names.has(option.name), "CATALOG_DUPLICATE_NAME");
    names.add(option.name);
    check(
      Number.isInteger(option.type) && option.type >= 1 && option.type <= 11,
    );
    if (option.type <= 2) {
      check(parent === "root" || (parent === "group" && option.type === 1));
      check(option.required === undefined && option.choices === undefined);
      if (option.type === 2)
        check(Array.isArray(option.options) && option.options.length > 0);
      validateOptions(
        option.options,
        option.type === 2 ? "group" : "subcommand",
      );
    } else {
      check(
        parent !== "group" && !hasSubcommands && option.options === undefined,
      );
      check(
        option.required === undefined || typeof option.required === "boolean",
      );
      if (option.required) check(!optionalSeen);
      else optionalSeen = true;
      if (option.choices !== undefined)
        validateChoices(option.choices, option.type);
    }
  }
}

function validateCommandPayloads(payload) {
  try {
    check(Array.isArray(payload) && payload.length > 0, "CATALOG_EMPTY");
    check(payload.length <= 100, "CATALOG_TOO_LARGE");
    const copy = snapshot(payload);
    const names = new Set();
    for (const command of copy) {
      // Only fields used by the current slash contracts are accepted. New API
      // features require reviewing this policy before global replacement.
      fields(command, ["type", "name", "description", "options"]);
      check(
        command.type === 1 &&
          validName(command.name) &&
          validText(command.description, 100),
      );
      check(!names.has(command.name), "CATALOG_DUPLICATE_NAME");
      names.add(command.name);
      validateOptions(command.options);
    }
    return copy;
  } catch (error) {
    if (error instanceof CommandCatalogError) throw error;
    throw new CommandCatalogError();
  }
}

function validateCommandCatalog(modules) {
  try {
    check(Array.isArray(modules) && modules.length > 0, "CATALOG_EMPTY");
    check(modules.length <= 100, "CATALOG_TOO_LARGE");
    const payload = modules.map((command) => {
      check(
        command &&
          typeof command.execute === "function" &&
          typeof command.data?.toJSON === "function",
      );
      const data = command.data.toJSON();
      check(data?.name === command.data.name);
      return data;
    });
    return {
      commands: Object.freeze([...modules]),
      payload: validateCommandPayloads(payload),
    };
  } catch (error) {
    if (error instanceof CommandCatalogError) throw error;
    throw new CommandCatalogError("CATALOG_SERIALIZATION_FAILED");
  }
}

function loadCommandCatalog({
  directory = path.join(__dirname, "../commands"),
  readDirectory = fs.readdirSync,
  loadModule = require,
} = {}) {
  try {
    const files = readDirectory(directory);
    check(
      Array.isArray(files) && files.every((file) => typeof file === "string"),
    );
    const commands = files
      .filter((file) => file.endsWith(".js"))
      .sort()
      .map((file) => {
        check(path.basename(file) === file);
        return loadModule(path.resolve(directory, file));
      });
    return validateCommandCatalog(commands);
  } catch (error) {
    if (error instanceof CommandCatalogError) throw error;
    throw new CommandCatalogError("CATALOG_LOAD_FAILED");
  }
}

module.exports = {
  loadCommandCatalog,
  validateCommandCatalog,
  validateCommandPayloads,
  CommandCatalogError,
};
