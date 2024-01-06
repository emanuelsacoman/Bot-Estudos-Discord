const { SlashCommandBuilder } = require("discord.js")

module.exports = {
    data: new SlashCommandBuilder()
        .setName("playlist")
        .setDescription("Ouça a melhor playlist de estudos"),

    async execute(interaction) {
        await interaction.reply("Aproveita e salva a playlist :blue_heart: \n https://open.spotify.com/playlist/3FbsZmt8BrFFmVpKD4ju4H?si=3fb6ffe4339d462e")
    }
}