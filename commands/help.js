const { SlashCommandBuilder } = require("discord.js")

module.exports = {
    data: new SlashCommandBuilder()
        .setName("help")
        .setDescription("Lista de comandos do CodeBucket"),

    async execute(interaction){
        const commandsList = interaction.client.commands.map(command => `**/${command.data.name}**: ${command.data.description}`).join('\n');

        await interaction.reply(`**Lista de comandos disponíveis:**\n${commandsList}`);
    }
}