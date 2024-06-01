const { SlashCommandBuilder, EmbedBuilder } = require("discord.js")

module.exports = {
    data: new SlashCommandBuilder()
        .setName("servercount")
        .setDescription("Em quantos servidores CodeBucket está?"),

    async execute(interaction){
        const serverCount = interaction.client.guilds.cache.size;

        const exampleEmbed = new EmbedBuilder()
            .setColor('#ff9c00')
            .setTitle("Contador de Servidores")
            .setDescription(`O CodeBucket atualmente está presente em **${serverCount} servidores**! 🥳`)
            .setFooter({ text: 'CodeBucket', iconURL: 'https://cdn-icons-png.flaticon.com/512/190/190544.png' })
            .setTimestamp();

        await interaction.reply({
            embeds: [exampleEmbed],
            components: [],
        });
    }
}