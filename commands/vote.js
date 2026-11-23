const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { respond, runSecondary } = require("../lib/interactions");
const { PUBLIC_LINKS } = require("../lib/config");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("vote")
    .setDescription("Vote no CodeBucket em top.gg!"),

  async execute(interaction) {
    const topggURL = PUBLIC_LINKS.vote;

    const exampleEmbed = new EmbedBuilder()
      .setColor("#911d57")
      .setTitle("⭐ Vote no CodeBucket!")
      .setDescription(
        "Ajude o CodeBucket a crescer votando em top.gg. Use o botão abaixo para votar agora!",
      )
      .setFooter({
        text: "CodeBucket",
        iconURL: "https://cdn-icons-png.flaticon.com/512/190/190544.png",
      })
      .setTimestamp();

    const voteButton = new ButtonBuilder()
      .setLabel("Votar no top.gg")
      .setStyle(ButtonStyle.Link)
      .setURL(topggURL);

    const row = new ActionRowBuilder().addComponents(voteButton);

    const message = await respond(interaction, {
      embeds: [exampleEmbed],
      components: [row],
      fetchReply: true,
    });

    await runSecondary(() => message.react("⭐"));
  },
};
