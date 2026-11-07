const {
  SlashCommandBuilder,
  EmbedBuilder,
  escapeMarkdown,
} = require("discord.js");
const { checkStatus } = require("../lib/status-http");
const { deferResponse, respond } = require("../lib/interactions");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("status")
    .setDescription("Verifica se um site está online.")
    .addStringOption((option) =>
      option
        .setName("url")
        .setDescription("URL do site (ex: google.com)")
        .setRequired(true),
    ),

  async execute(interaction) {
    const url = interaction.options.getString("url");
    await deferResponse(interaction);
    const embed = new EmbedBuilder()
      .setTitle("Verificação de Status")
      .setFooter({
        text: "CodeBucket",
        iconURL: "https://cdn-icons-png.flaticon.com/512/190/190544.png",
      })
      .setTimestamp();
    try {
      const { status, origin } = await checkStatus(url);
      const site = escapeMarkdown(origin);
      if (status >= 200 && status < 300) {
        embed
          .setColor("#00ff00")
          .setDescription(
            `O site **${site}** está **🟢 Online** (Status ${status}).`,
          );
      } else {
        embed
          .setColor("#ff0000")
          .setDescription(
            `O site **${site}** está **🔴 Offline** ou inacessível. (Erro ${status})`,
          );
      }
    } catch {
      embed
        .setColor("#ff0000")
        .setDescription(
          "Não foi possível verificar o site. Use uma URL HTTP(S) pública, sem credenciais; verifique o endereço ou tente novamente.",
        );
    }
    return respond(interaction, { embeds: [embed] });
  },
};
