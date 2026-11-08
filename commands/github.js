const { SlashCommandBuilder } = require("discord.js");
const { deferResponse, respond } = require("../lib/interactions");
const { fetchJson } = require("../lib/http-client");
const {
  validText,
  isHttpUrl,
  embedPayload,
  MAX_TEXT_ATTACHMENT_BYTES,
} = require("../lib/content-limits");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("github")
    .setDescription("Exibe informações sobre um repositório do GitHub")
    .addStringOption((option) =>
      option
        .setName("repositorio")
        .setDescription(
          "Nome do usuário/repositório (formato: usuario/repositorio)",
        )
        .setRequired(true),
    ),

  async execute(interaction) {
    const repository = interaction.options.getString("repositorio");
    if (
      !validText(repository) ||
      !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\/[a-z0-9_.-]+$/i.test(repository) ||
      [".", ".."].includes(repository.split("/")[1])
    ) {
      return respond(interaction, {
        content:
          "Informe um repositório no formato usuario/repositorio, com até 6000 caracteres.",
        ephemeral: true,
      });
    }
    await deferResponse(interaction);
    let payload;

    try {
      const { status, data } = await fetchJson(
        `https://api.github.com/repos/${repository.split("/").map(encodeURIComponent).join("/")}`,
      );

      if (status === 200) {
        if (
          !validText(data?.owner?.login, MAX_TEXT_ATTACHMENT_BYTES) ||
          !validText(data.full_name, MAX_TEXT_ATTACHMENT_BYTES) ||
          !isHttpUrl(data.html_url) ||
          !isHttpUrl(data.owner.avatar_url) ||
          ![data.stargazers_count, data.forks_count].every(
            (value) => Number.isSafeInteger(value) && value >= 0,
          ) ||
          ![data.description, data.language].every(
            (value) =>
              value == null ||
              value === "" ||
              validText(value, MAX_TEXT_ATTACHMENT_BYTES),
          )
        ) {
          throw new TypeError("Resposta de repositório inválida.");
        }
        payload = embedPayload(
          {
            color: 0x3498db,
            author: {
              name: data.owner.login,
              icon_url: data.owner.avatar_url,
              url: data.html_url,
            },
            title: `Repositório de ${data.owner.login}`,
            thumbnail: { url: data.owner.avatar_url },
            fields: [
              {
                name: "Full Name 🤓",
                value: data.full_name,
                inline: true,
              },
              {
                name: "Description 🌎",
                value: data.description || "Sem descrição disponível.",
                inline: true,
              },
              { name: "\u200B", value: "\u200B" },
              {
                name: "Language ‍💻",
                value: data.language || "Não especificada",
                inline: true,
              },
              {
                name: "Stars ⭐",
                value: `${data.stargazers_count}`,
                inline: true,
              },
              {
                name: "Forks 🍴",
                value: `${data.forks_count}`,
                inline: true,
              },
              { name: "URL", value: data.html_url },
            ],
            url: data.html_url,
            footer: {
              text: "CodeBucket",
              icon_url: "https://cdn-icons-png.flaticon.com/512/190/190544.png",
            },
            timestamp: new Date().toISOString(),
          },
          "repositorio.txt",
        );
      } else {
        payload = "Repositório não encontrado.";
      }
    } catch {
      payload = "Ocorreu um erro ao buscar informações do repositório.";
    }
    return respond(interaction, payload);
  },
};
