const { SlashCommandBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("ping")
        .setDescription("Mostra a latência do bot"),

    async execute(interaction) {
        const startTime = Date.now();

        await interaction.reply({ content: "Pong! :ping_pong:", ephemeral: true });

        const endTime = Date.now();
        const latency = endTime - startTime;

        await interaction.editReply(`Pong! :ping_pong: Latência: **${latency}ms**`);
    },
};
