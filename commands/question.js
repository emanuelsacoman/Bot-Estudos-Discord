const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { deferResponse, respond } = require("../lib/interactions");
const { getJson } = require("../lib/http-client");

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

    if (!userQuestion) {
      return respond(interaction, {
        content: "Por favor, forneça uma pergunta relacionada à programação.",
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

      if (response.data.items.length > 0) {
        const topResult = response.data.items[0];
        const answerLink = topResult.is_answered
          ? `\nResposta: \`${topResult.link}\``
          : "";

        const exampleEmbed = new EmbedBuilder()
          .setColor("#ff9c00")
          .setAuthor({
            name: `Stack Overflow`,
            iconURL: `https://pbs.twimg.com/profile_images/1220067947798024192/30eZhfxx_400x400.png`,
            url: `${topResult.link}`,
          })
          .setTitle(`${topResult.title}`)
          .setThumbnail(
            `https://pbs.twimg.com/profile_images/1220067947798024192/30eZhfxx_400x400.png`,
          )
          .addFields({
            name: "Answer link",
            value: `${topResult.link}` || "N/A",
          })
          .setURL(`${topResult.link}`)
          .setFooter({
            text: "CodeBucket",
            iconURL: "https://cdn-icons-png.flaticon.com/512/190/190544.png",
          })
          .setTimestamp();
        payload = { embeds: [exampleEmbed] };
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
