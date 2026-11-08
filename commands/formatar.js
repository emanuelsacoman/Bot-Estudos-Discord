const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { deferResponse, respond } = require("../lib/interactions");
const prettier = require("prettier");
const {
  DISCORD_LIMITS,
  MAX_TEXT_ATTACHMENT_BYTES,
  validText,
  textAttachment,
} = require("../lib/content-limits");

const OUTPUT_EXTENSIONS = Object.freeze({
  babel: "js",
  html: "html",
  css: "css",
  json: "json",
  markdown: "md",
});

module.exports = {
  data: new SlashCommandBuilder()
    .setName("formatar")
    .setDescription("Formata o código enviado.")
    .addStringOption((option) =>
      option
        .setName("linguagem")
        .setDescription("Escolha a linguagem do código")
        .setRequired(true)
        .addChoices(
          { name: "JavaScript", value: "babel" },
          { name: "HTML", value: "html" },
          { name: "CSS", value: "css" },
          { name: "JSON", value: "json" },
          { name: "Markdown", value: "markdown" },
        ),
    )
    .addStringOption((option) =>
      option
        .setName("codigo")
        .setDescription("Insira seu código para formatação")
        .setRequired(true),
    ),

  async execute(interaction) {
    const linguagem = interaction.options.getString("linguagem");
    const codigo = interaction.options.getString("codigo");

    if (
      !Object.hasOwn(OUTPUT_EXTENSIONS, linguagem || "") ||
      !validText(codigo)
    ) {
      return respond(interaction, {
        content: `Escolha uma linguagem disponível e envie código não vazio de até ${DISCORD_LIMITS.optionString} caracteres.`,
        ephemeral: true,
      });
    }

    await deferResponse(interaction);
    let payload;
    try {
      const options = {
        parser: linguagem,
      };

      const codigoFormatado = await prettier.format(codigo, options);

      if (
        !validText(codigoFormatado, MAX_TEXT_ATTACHMENT_BYTES) ||
        Buffer.byteLength(codigoFormatado, "utf8") > MAX_TEXT_ATTACHMENT_BYTES
      ) {
        const outputError = new Error(
          "Resultado de formatação inválido ou excessivo.",
        );
        outputError.code = "FORMAT_OUTPUT_LIMIT";
        throw outputError;
      }
      const field = `\`\`\`${linguagem}\n${codigoFormatado}\n\`\`\``;
      // Keep the exact formatted source, including embedded Markdown fences.
      // Large/fenced output is a UTF-8 attachment rather than a sliced field.
      if (
        field.length > DISCORD_LIMITS.fieldValue ||
        codigoFormatado.includes("```")
      ) {
        payload = textAttachment(
          codigoFormatado,
          `codigo-formatado.${OUTPUT_EXTENSIONS[linguagem]}`,
        );
      } else {
        const embed = new EmbedBuilder()
          .setColor("#ff9c00")
          .setTitle("Código Formatado")
          .setDescription(
            `Aqui está o seu código formatado em **${linguagem.toUpperCase()}**:`,
          )
          .addFields({ name: "Código", value: field, inline: false })
          .setFooter({
            text: "CodeBucket",
            iconURL: "https://cdn-icons-png.flaticon.com/512/190/190544.png",
          })
          .setTimestamp();

        payload = { embeds: [embed] };
      }
    } catch (error) {
      payload = {
        content:
          error?.code === "FORMAT_OUTPUT_LIMIT"
            ? "O resultado da formatação é inválido ou excede o limite local de 1 MiB. Reduza o código e tente novamente."
            : "Ocorreu um erro ao formatar o código. Verifique se a sintaxe está correta.",
        ephemeral: true,
      };
    }
    await respond(interaction, payload);
  },
};
