const { SlashCommandBuilder } = require("discord.js");
const { deferResponse, respond } = require("../lib/interactions");
const { getJson } = require("../lib/http-client");
const {
  validText,
  isHttpUrl,
  embedPayload,
  MAX_TEXT_ATTACHMENT_BYTES,
} = require("../lib/content-limits");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("question")
    .setDescription("Faz uma pergunta relacionada à programação")
    .addStringOption((option) =>
      option
        .setName("pergunta")
        .setDescription(
          "A pergunta relacionada à programação (deve ser em inglês)",
        )
        .setRequired(true),
    ),

  async execute(interaction) {
    const userQuestion = interaction.options.getString("pergunta");

    if (!validText(userQuestion)) {
      return respond(interaction, {
        content:
          "Por favor, forneça uma pergunta relacionada à programação, não vazia e de até 6000 caracteres.",
        ephemeral: true,
      });
    }
    await deferResponse(interaction);
    let payload;

    try {
      const response = await getJson(
        `https://api.stackexchange.com/2.3/search?order=desc&sort=activity&intitle=${encodeURIComponent(
          userQuestion,
        )}&site=stackoverflow`,
      );

      if (!Array.isArray(response.data?.items)) {
        throw new TypeError("Lista de perguntas inválida.");
      }
      if (response.data.items.length > 0) {
        const topResult = response.data.items[0];
        if (
          !validText(topResult?.title, MAX_TEXT_ATTACHMENT_BYTES) ||
          !isHttpUrl(topResult.link)
        ) {
          throw new TypeError("Pergunta inválida.");
        }
        payload = embedPayload(
          {
            color: 0xff9c00,
            author: {
              name: `Stack Overflow`,
              icon_url: `https://pbs.twimg.com/profile_images/1220067947798024192/30eZhfxx_400x400.png`,
              url: topResult.link,
            },
            title: topResult.title,
            thumbnail: {
              url: `https://pbs.twimg.com/profile_images/1220067947798024192/30eZhfxx_400x400.png`,
            },
            fields: [
              {
                name: "Answer link",
                value: topResult.link,
              },
            ],
            url: topResult.link,
            footer: {
              text: "CodeBucket",
              icon_url: "https://cdn-icons-png.flaticon.com/512/190/190544.png",
            },
            timestamp: new Date().toISOString(),
          },
          "pergunta.txt",
        );
      } else {
        payload = {
          content:
            "Desculpe, não foi possível encontrar perguntas relacionadas a esta pergunta.",
          ephemeral: true,
        };
      }
    } catch {
      payload = {
        content:
          "Ocorreu um erro ao buscar perguntas relacionadas. Tente novamente mais tarde.",
        ephemeral: true,
      };
    }
    return respond(interaction, payload);
  },
};
