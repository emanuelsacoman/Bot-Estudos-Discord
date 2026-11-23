const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { deferResponse, respond } = require("../lib/interactions");
const { getJson, HttpRequestError } = require("../lib/http-client");
const { apiErrorMessage } = require("../lib/api-errors");
const {
  validText,
  embedPayload,
  MAX_TEXT_ATTACHMENT_BYTES,
} = require("../lib/content-limits");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("http")
    .setDescription("Retorna o significado de um código HTTP.")
    .addIntegerOption((option) =>
      option
        .setName("codigo")
        .setDescription("Informe um código HTTP (ex: 100, 200, 404)")
        .setRequired(true),
    ),

  async execute(interaction) {
    const code = interaction.options.getInteger("codigo");
    if (!Number.isInteger(code) || code < 100 || code > 599) {
      return respond(interaction, {
        content: "Informe um código HTTP inteiro entre 100 e 599.",
        ephemeral: true,
      });
    }

    // Tratamento especial para códigos informativos (1xx)
    if (code >= 100 && code < 200) {
      const embed = new EmbedBuilder()
        .setColor("#95a5a6")
        .setTitle(`Código HTTP ${code}`)
        .setDescription(
          "Este é um código informativo e não possui uma descrição detalhada.",
        )
        .setFooter({
          text: "CodeBucket",
          iconURL: "https://cdn-icons-png.flaticon.com/512/190/190544.png",
        })
        .setTimestamp();

      return respond(interaction, { embeds: [embed] });
    }
    await deferResponse(interaction);
    let payload;

    try {
      const response = await getJson(`https://httpstat.us/${code}?json`, {
        validateStatus: (status) => status === code,
        headers: { Accept: "application/json" },
      });

      const data = response.data;
      if (response.status !== code) {
        throw new HttpRequestError(
          Number.isInteger(response.status)
            ? "HTTP_STATUS_ERROR"
            : "HTTP_INVALID_BODY",
          response.status,
        );
      }

      if (
        !Number.isInteger(data?.code) ||
        data.code !== code ||
        !validText(data.description, MAX_TEXT_ATTACHMENT_BYTES)
      ) {
        payload = {
          content: "Não foi possível obter informações para esse código.",
          ephemeral: true,
        };
      } else {
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

        payload = embedPayload(
          {
            color: Number.parseInt(color.slice(1), 16),
            title: `Código HTTP ${data.code}`,
            description: `**${data.description}**`,
            fields: [
              {
                name: "Mais Informações",
                value: `[Clique aqui para mais detalhes](https://httpstatuses.com/${data.code})`,
                inline: false,
              },
            ],
            footer: {
              text: "CodeBucket",
              icon_url: "https://cdn-icons-png.flaticon.com/512/190/190544.png",
            },
            timestamp: new Date().toISOString(),
          },
          "codigo-http.txt",
        );
      }
    } catch (error) {
      payload = {
        content: apiErrorMessage(
          error,
          "Ocorreu um erro ao buscar o código HTTP. Verifique se o código está correto.",
        ),
        ephemeral: true,
      };
    }
    return respond(interaction, payload);
  },
};
