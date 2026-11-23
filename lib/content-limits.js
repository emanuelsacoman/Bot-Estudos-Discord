const { EmbedBuilder } = require("discord.js");

// Discord API limits; UTF-16 units also satisfy the installed builder validators.
// https://docs.discord.com/developers/resources/message#embed-object-embed-limits
const DISCORD_LIMITS = Object.freeze({
  content: 2000,
  title: 256,
  description: 4096,
  fields: 25,
  fieldName: 256,
  fieldValue: 1024,
  footer: 2048,
  author: 256,
  embedTotal: 6000,
  optionString: 6000,
});

// Local resource budget, shared with HTTP: at most 1 MiB per generated text
// attachment, comfortably below Discord's default upload allowance. No slicing.
const MAX_TEXT_ATTACHMENT_BYTES = 1024 * 1024;

function validText(value, maxLength = DISCORD_LIMITS.optionString) {
  return (
    typeof value === "string" &&
    value.length <= maxLength &&
    value.trim().length > 0 &&
    value.isWellFormed()
  );
}

function isHttpUrl(value) {
  if (!validText(value, 2048)) return false;
  try {
    const url = new URL(value);
    return (
      ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

function textAttachment(text, name = "resultado.txt") {
  if (
    !validText(text, MAX_TEXT_ATTACHMENT_BYTES) ||
    Buffer.byteLength(text, "utf8") > MAX_TEXT_ATTACHMENT_BYTES
  ) {
    throw new RangeError(
      "O resultado excede o limite local de anexo de texto.",
    );
  }
  return {
    content: "O resultado completo está no arquivo anexo.",
    files: [{ attachment: Buffer.from(text, "utf8"), name }],
  };
}

function textPayload(text, name = "resultado.txt") {
  if (!validText(text, MAX_TEXT_ATTACHMENT_BYTES)) {
    throw new TypeError("Resultado de texto inválido.");
  }
  return text.length <= DISCORD_LIMITS.content
    ? text
    : textAttachment(text, name);
}

function embedFits(embed) {
  const fields = embed.fields || [];
  if (!Array.isArray(fields) || fields.length > DISCORD_LIMITS.fields)
    return false;
  const parts = [
    [embed.title, DISCORD_LIMITS.title],
    [embed.description, DISCORD_LIMITS.description],
    [embed.footer?.text, DISCORD_LIMITS.footer],
    [embed.author?.name, DISCORD_LIMITS.author],
    ...fields.flatMap((field) => [
      [field.name, DISCORD_LIMITS.fieldName],
      [field.value, DISCORD_LIMITS.fieldValue],
    ]),
  ];
  return (
    parts.every(
      ([value, max]) => value === undefined || validText(value, max),
    ) &&
    parts.reduce((sum, [value]) => sum + (value?.length || 0), 0) <=
      DISCORD_LIMITS.embedTotal
  );
}

function embedPayload(embed, name = "resultado.txt") {
  if (embedFits(embed)) return { embeds: [new EmbedBuilder(embed)] };
  const text = [
    embed.title,
    embed.author?.name,
    embed.author?.url,
    embed.url,
    embed.description,
    ...(embed.fields || []).flatMap((field) => [field.name, field.value]),
    embed.footer?.text,
  ]
    .filter((part) => part !== undefined)
    .join("\n");
  return textAttachment(text, name);
}

module.exports = {
  DISCORD_LIMITS,
  MAX_TEXT_ATTACHMENT_BYTES,
  validText,
  isHttpUrl,
  textAttachment,
  textPayload,
  embedFits,
  embedPayload,
};
