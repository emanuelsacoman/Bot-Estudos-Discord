const { SlashCommandBuilder } = require("discord.js");
const { respond, editResponse } = require("../lib/interactions");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("ping")
        .setDescription("Mostra a latência do bot"),

    async execute(interaction) {
        const startTime = Date.now();

        await respond(interaction, { content: "Pong! :ping_pong:", ephemeral: true });

        const endTime = Date.now();
        const latency = endTime - startTime;

        await editResponse(interaction, `Pong! :ping_pong: Latência: **${latency}ms**`);
    },
};
