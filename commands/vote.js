const { SlashCommandBuilder, EmbedBuilder } = require("discord.js")

module.exports = {
    data: new SlashCommandBuilder()
        .setName("vote")
        .setDescription("Vote no CodeBucket em top.gg!"),

    async execute(interaction){
        const exampleEmbed = new EmbedBuilder()
            .setColor('#911d57')
            .setTitle("CLIQUE AQUI")
            .setDescription('Vote no CodeBucket em top.gg!')
            .setURL('https://top.gg/bot/1193011045577523300')
            .setFooter({ text: 'CodeBucket', iconURL: 'https://cdn-icons-png.flaticon.com/512/190/190544.png' })
            .setTimestamp();

        await interaction.reply({
            embeds: [exampleEmbed],
            components: [],
        });
    }
}