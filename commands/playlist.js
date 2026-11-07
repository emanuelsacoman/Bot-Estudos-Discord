const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { respond, runSecondary } = require("../lib/interactions");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("playlist")
        .setDescription("Ouça a melhor playlist de estudos"),

    async execute(interaction) {
        const exampleEmbed = new EmbedBuilder()
            .setColor('Blue')
            .setTitle("Playlist para estudos")
            .setDescription("Aproveita e salva :blue_heart:")
            .setFooter({ text: 'CodeBucket', iconURL: 'https://cdn-icons-png.flaticon.com/512/190/190544.png' })
            .setTimestamp();

        await respond(interaction, {
            embeds: [exampleEmbed],
            components: [],
        });

        const emojis = ['🎵', '📚', '🎧', '🎶', '📖', '🎓', '📝', '🔬', '📌', '💡', '🖊️', '✏️', '📏', '🖇️', '💙'];
        const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];

        const followUpMessage = await respond(interaction, { content: "https://open.spotify.com/playlist/3FbsZmt8BrFFmVpKD4ju4H?si=3fb6ffe4339d462e" });

        await runSecondary(() => followUpMessage.react(randomEmoji));
    }
};
