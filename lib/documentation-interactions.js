const {
  DOCUMENTATION_SELECT_ID,
  findDocumentation,
} = require("./documentation-catalog");
const { respond } = require("./interactions");

async function handleDocumentationSelect(interaction) {
  if (
    !interaction ||
    interaction.customId !== DOCUMENTATION_SELECT_ID ||
    typeof interaction.isStringSelectMenu !== "function" ||
    !interaction.isStringSelectMenu()
  ) {
    return false;
  }

  const entry =
    Array.isArray(interaction.values) && interaction.values.length === 1
      ? findDocumentation(interaction.values[0])
      : undefined;
  await respond(
    interaction,
    entry
      ? `Documentação ${entry.article ?? "do"} ${entry.label}: ${entry.url}`
      : "Opção não reconhecida.",
  );
  return true;
}

module.exports = { handleDocumentationSelect };
