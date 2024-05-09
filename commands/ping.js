const { SlashCommandBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("ping")
        .setDescription("Mostra a latência do bot"),

    async execute(interaction) {
        const startTime = Date.now();

        // Responde com 'Pong!' e calcula a latência
        await interaction.reply({ content: "Pong! :ping_pong:", ephemeral: true });

        const endTime = Date.now();
        const latency = endTime - startTime;

        // Editar a resposta original para incluir a latência
        await interaction.editReply(`Pong! :ping_pong: Latência: **${latency}ms**`);
    },
};
