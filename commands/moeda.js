const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { deferResponse, respond } = require("../lib/interactions");
const { getJson } = require("../lib/http-client");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("moeda")
    .setDescription("Converte um valor de uma moeda para outra")
    .addNumberOption((option) =>
      option
        .setName("valor")
        .setDescription("Valor a ser convertido")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("origem")
        .setDescription("Código da moeda de origem (por exemplo, USD)")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("destino")
        .setDescription("Código da moeda de destino (por exemplo, EUR)")
        .setRequired(true),
    ),

  async execute(interaction) {
    const valor = interaction.options.getNumber("valor");
    const origem = interaction.options.getString("origem").toUpperCase();
    const destino = interaction.options.getString("destino").toUpperCase();

    const url = `https://api.exchangerate-api.com/v4/latest/${origem}`;
    await deferResponse(interaction);
    let payload;

    try {
      const response = await getJson(url);
      const taxasDeCambio = response.data.rates;
      const taxaDeCambio = taxasDeCambio[destino];

      if (!taxaDeCambio) {
        payload = {
          content: "Código de moeda de destino inválido.",
          ephemeral: true,
        };
      } else {
        const valorConvertido = (valor * taxaDeCambio).toFixed(2);

        const embed = new EmbedBuilder()
          .setColor("#ff9c00")
          .setTitle("Conversão de Moeda")
          .setDescription(`Conversão de ${valor} ${origem} para ${destino}`)
          .addFields(
            {
              name: "Valor Original",
              value: `${valor} ${origem}`,
              inline: true,
            },
            {
              name: "Valor Convertido",
              value: `${valorConvertido} ${destino}`,
              inline: true,
            },
            {
              name: "Taxa de Câmbio",
              value: `1 ${origem} = ${taxaDeCambio} ${destino}`,
              inline: false,
            },
          )
          .setFooter({
            text: "CodeBucket",
            iconURL: "https://cdn-icons-png.flaticon.com/512/190/190544.png",
          })
          .setTimestamp();

        payload = { embeds: [embed] };
      }
    } catch (error) {
      if (error.response && error.response.status === 404) {
        payload = {
          content: "Código de moeda de origem inválido.",
          ephemeral: true,
        };
      } else {
        payload = {
          content:
            "Ocorreu um erro ao converter as moedas. Por favor, tente novamente mais tarde.",
          ephemeral: true,
        };
      }
    }
    return respond(interaction, payload);
  },
};
