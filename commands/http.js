const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const axios = require("axios");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("http")
    .setDescription("Retorna o significado de um código HTTP.")
    .addIntegerOption(option =>
      option
        .setName("codigo")
        .setDescription("Informe um código HTTP (ex: 100, 200, 404)")
        .setRequired(true)
    ),

  async execute(interaction) {
    const code = interaction.options.getInteger("codigo");

    // Tratamento especial para códigos informativos (1xx)
    if (code >= 100 && code < 200) {
      const embed = new EmbedBuilder()
        .setColor("#95a5a6")
        .setTitle(`Código HTTP ${code}`)
        .setDescription("Este é um código informativo e não possui uma descrição detalhada.")
        .setFooter({ text: 'CodeBucket', iconURL: 'https://cdn-icons-png.flaticon.com/512/190/190544.png' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    try {
      const response = await axios.get(`https://httpstat.us/${code}?json`, {
        validateStatus: () => true
      });

      const data = response.data;

      if (!data || !data.code) {
        return interaction.reply({
          content: "Não foi possível obter informações para esse código.",
          ephemeral: true
        });
      }

      // Define a cor do embed conforme a faixa do código HTTP
      let color;
      if (data.code >= 200 && data.code < 300) {
        color = "#2ECC71"; // verde para códigos 200
      } else if (data.code >= 300 && data.code < 400) {
        color = "#F1C40F"; // amarelo para códigos 300
      } else if (data.code >= 400 && data.code < 500) {
        color = "#E74C3C"; // vermelho para códigos 400
      } else if (data.code >= 500) {
        color = "#C0392B"; // vermelho escuro para códigos 500+
      } else {
        color = "#0099ff"; // cor padrão para os demais
      }

      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`Código HTTP ${data.code}`)
        .setDescription(`**${data.description}**`)
        .addFields({
          name: "Mais Informações",
          value: `[Clique aqui para mais detalhes](https://httpstatuses.com/${data.code})`,
          inline: false
        })
        .setFooter({ text: 'CodeBucket', iconURL: 'https://cdn-icons-png.flaticon.com/512/190/190544.png' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      await interaction.reply({
        content: "Ocorreu um erro ao buscar o código HTTP. Verifique se o código está correto.",
        ephemeral: true
      });
    }
  }
};
