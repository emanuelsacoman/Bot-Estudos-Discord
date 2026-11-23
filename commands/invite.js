const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { respond, runSecondary } = require("../lib/interactions");
const { buildInviteUrl, configurationMessage } = require("../lib/config");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("invite")
    .setDescription("Gera um convite do CodeBucket para seu servidor"),

  async execute(interaction) {
    let inviteURL;
    try {
      inviteURL = buildInviteUrl(process.env, interaction.applicationId);
    } catch (error) {
      await respond(interaction, {
        content:
          configurationMessage(error) ||
          "Não foi possível preparar o convite do CodeBucket.",
        ephemeral: true,
      });
      return;
    }

    const exampleEmbed = new EmbedBuilder()
      .setColor("Blue")
      .setTitle("📨 Convite do CodeBucket")
      .setDescription(
        "Clique no botão abaixo para adicionar o CodeBucket ao seu servidor!",
      )
      .setFooter({
        text: "CodeBucket",
        iconURL: "https://cdn-icons-png.flaticon.com/512/190/190544.png",
      })
      .setTimestamp();

    const inviteButton = new ButtonBuilder()
      .setLabel("Adicionar ao servidor")
      .setStyle(ButtonStyle.Link)
      .setURL(inviteURL);

    const row = new ActionRowBuilder().addComponents(inviteButton);

    const message = await respond(interaction, {
      embeds: [exampleEmbed],
      components: [row],
      fetchReply: true,
    });

    await runSecondary(() => message.react("❤️"));
  },
};
