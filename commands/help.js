const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("help")
        .setDescription("Lista de comandos do CodeBucket"),

    async execute(interaction) {
        const commandsList = interaction.client.commands.map(command => `**/${command.data.name}**: ${command.data.description}`);

        const commandFields = commandsList.map(command => ({ name: '\u200B', value: command, inline: true }));

        const exampleEmbed = new EmbedBuilder()
            .setColor('#ff9c00')
            .setTitle("Lista de comandos disponíveis")
            .addFields(commandFields)
            .setFooter({ text: 'CodeBucket', iconURL: 'https://cdn-icons-png.flaticon.com/512/190/190544.png' })
            .setTimestamp();

        await interaction.reply({ embeds: [exampleEmbed] });
    },
};
