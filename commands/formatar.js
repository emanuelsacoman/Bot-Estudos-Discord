const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const prettier = require("prettier");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("formatar")
    .setDescription("Formata o código enviado.")
    .addStringOption(option =>
      option
        .setName("linguagem")
        .setDescription("Escolha a linguagem do código")
        .setRequired(true)
        .addChoices(
          { name: "JavaScript", value: "babel" },
          { name: "HTML", value: "html" },
          { name: "CSS", value: "css" },
          { name: "JSON", value: "json" },
          { name: "Markdown", value: "markdown" }
        )
    )
    .addStringOption(option =>
      option
        .setName("codigo")
        .setDescription("Insira seu código para formatação")
        .setRequired(true)
    ),

  async execute(interaction) {
    const linguagem = interaction.options.getString("linguagem");
    const codigo = interaction.options.getString("codigo");

    try {
      const options = {
        parser: linguagem,
      };

      const codigoFormatado = await prettier.format(codigo, options);

      const embed = new EmbedBuilder()
        .setColor("#ff9c00")
        .setTitle("Código Formatado")
        .setDescription(`Aqui está o seu código formatado em **${linguagem.toUpperCase()}**:`)
        .addFields(
          { name: "Código", value: `\`\`\`${linguagem}\n${codigoFormatado}\n\`\`\``, inline: false }
        )
        .setFooter({ text: 'CodeBucket', iconURL: 'https://cdn-icons-png.flaticon.com/512/190/190544.png' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      await interaction.reply({
        content: "Ocorreu um erro ao formatar o código. Verifique se a sintaxe está correta.",
        ephemeral: true
      });
    }
  }
};
