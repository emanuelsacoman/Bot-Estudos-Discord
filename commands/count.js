const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { respond } = require("../lib/interactions");
const { validText } = require("../lib/content-limits");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("count")
    .setDescription("Faz contagem de caracteres de um texto")
    .addStringOption((option) =>
      option
        .setName("texto")
        .setDescription("O texto para contar caracteres")
        .setRequired(true),
    ),

  async execute(interaction) {
    const text = interaction.options.getString("texto");
    if (!validText(text)) {
      return respond(interaction, {
        content: "Informe um texto não vazio de até 6000 caracteres.",
        ephemeral: true,
      });
    }
    const words = text
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0);
    const letters = text.replace(/[^a-zA-Z]/g, "").split("");
    const numbers = text.replace(/\D/g, "").split("");
    const lettersAndNumbers = text.replace(/\W/g, "").split("");
    const characters = text.length;

    const countEmbed = new EmbedBuilder()
      .setColor("#ff9c00")
      .setTitle("Contagem de Caracteres")
      .setDescription(
        `**Palavras:** ${words.length}\n**Letras:** ${letters.length}\n**Números:** ${numbers.length}\n**Letras e Números:** ${lettersAndNumbers.length}\n**Caracteres (incluindo espaços):** ${characters}`,
      )
      .setFooter({
        text: "CodeBucket",
        iconURL: "https://cdn-icons-png.flaticon.com/512/190/190544.png",
      })
      .setTimestamp();

    await respond(interaction, { embeds: [countEmbed] });
  },
};
