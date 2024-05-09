const { SlashCommandBuilder, EmbedBuilder } = require("discord.js")

module.exports = {
    data: new SlashCommandBuilder()
        .setName("invite")
        .setDescription("Gera um convite do CodeBucket para seu servidor"),

    async execute(interaction){
        const exampleEmbed = new EmbedBuilder()
            .setColor('Blue')
            .setTitle('CLIQUE AQUI')
            .setDescription('O link enviará você até o convite do CodeBucket.')
            .setURL('https://avatars.githubusercontent.com/u/63565495?v=4')
            .setFooter({ text: 'CodeBucket', iconURL: 'https://cdn-icons-png.flaticon.com/512/190/190544.png' })
            .setTimestamp();
        const message = await interaction.reply({ embeds: [exampleEmbed], fetchReply: true })
        await message.react('❤️');
    }
}