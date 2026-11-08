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
    const origemInput = interaction.options.getString("origem");
    const destinoInput = interaction.options.getString("destino");
    if (
      typeof valor !== "number" ||
      !Number.isFinite(valor) ||
      ![origemInput, destinoInput].every(
        (value) => typeof value === "string" && /^[a-z]{3}$/i.test(value),
      )
    ) {
      return respond(interaction, {
        content:
          "Informe um valor finito e códigos de moeda com três letras (ex.: USD e EUR).",
        ephemeral: true,
      });
    }
    const origem = origemInput.toUpperCase();
    const destino = destinoInput.toUpperCase();

    const url = `https://api.exchangerate-api.com/v4/latest/${origem}`;
    await deferResponse(interaction);
    let payload;

    try {
      const response = await getJson(url);
      const taxasDeCambio = response.data?.rates;
      if (
        !taxasDeCambio ||
        typeof taxasDeCambio !== "object" ||
        Array.isArray(taxasDeCambio)
      ) {
        throw new TypeError("Tabela de taxas inválida.");
      }
      const taxaDeCambio = Object.hasOwn(taxasDeCambio, destino)
        ? taxasDeCambio[destino]
        : undefined;

      if (
        taxaDeCambio === undefined ||
        taxaDeCambio === null ||
        taxaDeCambio === 0
      ) {
        payload = {
          content: "Código de moeda de destino inválido.",
          ephemeral: true,
        };
      } else {
        if (
          typeof taxaDeCambio !== "number" ||
          !Number.isFinite(taxaDeCambio) ||
          taxaDeCambio <= 0 ||
          !Number.isFinite(valor * taxaDeCambio)
        ) {
          throw new TypeError("Taxa de câmbio inválida.");
        }
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
