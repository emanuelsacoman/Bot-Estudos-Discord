const { SlashCommandBuilder } = require("discord.js");
const { deferResponse, respond } = require("../lib/interactions");
const {
  getJson,
  HttpRequestError,
  pauseStackExchange,
} = require("../lib/http-client");
const {
  requireSuccessfulResponse,
  apiErrorMessage,
} = require("../lib/api-errors");
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
        // Stack Exchange encodes method errors in a JSON wrapper under HTTP 400.
        // Other HTTP failures must be classified before attempting to parse HTML.
        { validateStatus: (status) => status === 200 || status === 400 },
      );
      const data = response.data;
      if (
        !data ||
        typeof data !== "object" ||
        Array.isArray(data) ||
        (data.backoff !== undefined &&
          (!Number.isSafeInteger(data.backoff) ||
            data.backoff < 0 ||
            data.backoff > 86400)) ||
        (data.quota_remaining !== undefined &&
          (!Number.isSafeInteger(data.quota_remaining) ||
            data.quota_remaining < 0)) ||
        (data.error_id !== undefined &&
          (!Number.isSafeInteger(data.error_id) || data.error_id <= 0)) ||
        ![data.error_name, data.error_message].every(
          (value) =>
            value === undefined || validText(value, MAX_TEXT_ATTACHMENT_BYTES),
        ) ||
        (data.error_id === undefined &&
          (data.error_name !== undefined || data.error_message !== undefined))
      ) {
        throw new HttpRequestError("HTTP_INVALID_BODY");
      }
      if (data.backoff !== undefined) pauseStackExchange(data.backoff);
      if (data.quota_remaining === 0) {
        // Conservative local pause; this is not the provider's quota reset time.
        if (!data.backoff) pauseStackExchange(60);
        throw new HttpRequestError("HTTP_RATE_LIMITED");
      }
      if (data.error_id !== undefined) {
        if (data.error_id === 502) {
          if (!data.backoff) pauseStackExchange(60);
          throw new HttpRequestError("HTTP_RATE_LIMITED");
        }
        if (data.error_id === 503 || data.error_id === 500) {
          throw new HttpRequestError("HTTP_STATUS_ERROR", 503);
        }
        if ([401, 402, 403, 405, 406].includes(data.error_id)) {
          throw new HttpRequestError("HTTP_STATUS_ERROR", 403);
        }
        throw new HttpRequestError(
          "HTTP_STATUS_ERROR",
          response.status === 200 ? 400 : response.status,
        );
      }
      requireSuccessfulResponse(response);
      if (!Array.isArray(data.items)) {
        throw new HttpRequestError("HTTP_INVALID_BODY");
      }
      if (data.items.length > 0) {
        const topResult = data.items[0];
        if (
          !validText(topResult?.title, MAX_TEXT_ATTACHMENT_BYTES) ||
          !isHttpUrl(topResult.link)
        ) {
          throw new HttpRequestError("HTTP_INVALID_BODY");
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
    } catch (error) {
      payload = {
        content: apiErrorMessage(
          error,
          "Ocorreu um erro ao buscar perguntas relacionadas. Tente novamente mais tarde.",
        ),
        ephemeral: true,
      };
    }
    return respond(interaction, payload);
  },
};
