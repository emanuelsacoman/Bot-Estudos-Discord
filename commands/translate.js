const { SlashCommandBuilder } = require("@discordjs/builders");
const { deferResponse, respond } = require("../lib/interactions");
const { getJson } = require("../lib/http-client");
const {
  validText,
  textPayload,
  MAX_TEXT_ATTACHMENT_BYTES,
} = require("../lib/content-limits");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("translate")
    .setDescription("Traduz um texto para o idioma especificado")
    .addStringOption((option) =>
      option
        .setName("idioma")
        .setDescription("Sigla do idioma para o qual o texto será traduzido")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("texto")
        .setDescription("Texto a ser traduzido")
        .setRequired(true),
    ),

  async execute(interaction) {
    const texto = interaction.options.getString("texto");
    const idioma = interaction.options.getString("idioma");
    if (
      !validText(texto) ||
      !validText(idioma) ||
      !/^[a-z]{2,8}(?:-[a-z0-9]{1,8})*$/i.test(idioma)
    ) {
      return respond(interaction, {
        content:
          "Informe um texto não vazio de até 6000 caracteres e uma sigla de idioma válida (ex.: pt ou pt-BR).",
        ephemeral: true,
      });
    }
    await deferResponse(interaction);
    let payload;

    try {
      const response = await getJson(
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(idioma)}&dt=t&q=${encodeURIComponent(texto)}`,
      );

      const segments = response.data?.[0];
      if (
        !Array.isArray(segments) ||
        segments.length === 0 ||
        !segments.every(
          (segment) =>
            Array.isArray(segment) &&
            typeof segment[0] === "string" &&
            segment[0].isWellFormed(),
        )
      ) {
        throw new TypeError("Resposta de tradução inválida.");
      }
      const traducao = segments.map((segment) => segment[0]).join("");
      if (!validText(traducao, MAX_TEXT_ATTACHMENT_BYTES)) {
        throw new TypeError("Resposta de tradução vazia ou excessiva.");
      }

      const textoTraduzido = `🗺️ | <@${interaction.user.id}>\n${traducao}`;

      payload = textPayload(textoTraduzido, "traducao.txt");
    } catch {
      payload = {
        content: "Ocorreu um erro ao traduzir o texto.",
        ephemeral: true,
      };
    }
    return respond(interaction, payload);
  },
};
