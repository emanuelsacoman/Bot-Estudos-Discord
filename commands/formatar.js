const { SlashCommandBuilder } = require('discord.js');
const prettier = require('prettier');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('formatar')
    .setDescription('Formata o código enviado.')
    .addStringOption(option =>
      option
        .setName('codigo')
        .setDescription('Insira seu código para formatação')
        .setRequired(true)
    ),
  async execute(interaction) {
    const codigo = interaction.options.getString('codigo');
    try {
      // Tenta formatar o código usando Prettier com parser 'babel' para JavaScript
      const codigoFormatado = prettier.format(codigo, { parser: 'babel' });
      await interaction.reply({
        content: `Aqui está seu código formatado:\n\`\`\`js\n${codigoFormatado}\n\`\`\``
      });
    } catch (error) {
      console.error(error);
      await interaction.reply({
        content:
          'Ocorreu um erro ao formatar o código. Verifique se a sintaxe está correta.',
        ephemeral: true
      });
    }
  }
};
