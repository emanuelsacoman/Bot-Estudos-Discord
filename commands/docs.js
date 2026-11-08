const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder,
} = require("discord.js");
const { respond } = require("../lib/interactions");
const {
  DOCUMENTATION_SELECT_ID,
  getDocumentationOptions,
} = require("../lib/documentation-catalog");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("docs")
    .setDescription("Acesse as documentações que quiser"),

  async execute(interaction) {
    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(DOCUMENTATION_SELECT_ID)
        .setPlaceholder("Nenhuma linguagem selecionada")
        .addOptions(getDocumentationOptions()),
    );
    const exampleEmbed = new EmbedBuilder()
      .setColor("#ff9c00")
      .setTitle("Documentação")
      .setDescription(
        "Escolha a tecnologia para acessar sua documentação. :arrow_down:",
      )
      .setFooter({
        text: "CodeBucket",
        iconURL: "https://cdn-icons-png.flaticon.com/512/190/190544.png",
      })
      .setTimestamp();

    await respond(interaction, { embeds: [exampleEmbed], components: [row] });
  },
};
