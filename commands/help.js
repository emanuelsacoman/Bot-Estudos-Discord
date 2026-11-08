const { SlashCommandBuilder } = require("discord.js");
const { respond } = require("../lib/interactions");
const { embedPayload } = require("../lib/content-limits");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Lista de comandos do CodeBucket"),

  async execute(interaction) {
    const commandsList = interaction.client.commands.map(
      (command) => `**/${command.data.name}**: ${command.data.description}`,
    );

    const commandFields = commandsList.map((command) => ({
      name: "\u200B",
      value: command,
      inline: true,
    }));

    await respond(
      interaction,
      embedPayload(
        {
          color: 0xff9c00,
          title: "Lista de comandos disponíveis",
          fields: commandFields,
          footer: {
            text: "CodeBucket",
            icon_url: "https://cdn-icons-png.flaticon.com/512/190/190544.png",
          },
          timestamp: new Date().toISOString(),
        },
        "comandos.txt",
      ),
    );
  },
};
