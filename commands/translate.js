const { SlashCommandBuilder } = require("@discordjs/builders");
const { deferResponse, respond } = require("../lib/interactions");
const { getJson } = require("../lib/http-client");

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
    await deferResponse(interaction);
    let payload;

    try {
      const response = await getJson(
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${idioma}&dt=t&q=${encodeURIComponent(texto)}`,
      );

      const traducao = response.data[0][0][0];

      const textoTraduzido = `🗺️ | <@${interaction.user.id}>\n${traducao}`;

      payload = `${textoTraduzido}`;
    } catch {
      payload = {
        content: "Ocorreu um erro ao traduzir o texto.",
        ephemeral: true,
      };
    }
    return respond(interaction, payload);
  },
};
