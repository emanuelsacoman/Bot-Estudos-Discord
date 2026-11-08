const { SlashCommandBuilder } = require("discord.js");
const { deferResponse, respond } = require("../lib/interactions");
const { getJson } = require("../lib/http-client");
const {
  validText,
  isHttpUrl,
  textPayload,
  MAX_TEXT_ATTACHMENT_BYTES,
} = require("../lib/content-limits");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("repositorys")
    .setDescription(
      "Mostra os repositórios mais populares de uma linguagem específica no GitHub",
    )
    .addStringOption((option) =>
      option
        .setName("linguagem")
        .setDescription("A linguagem de programação desejada")
        .setRequired(true),
    ),

  async execute(interaction) {
    const linguagem = interaction.options.getString("linguagem");
    if (!validText(linguagem)) {
      return respond(interaction, {
        content: "Informe uma linguagem não vazia de até 6000 caracteres.",
        ephemeral: true,
      });
    }
    await deferResponse(interaction);
    let payload;

    try {
      const response = await getJson(
        `https://api.github.com/search/repositories?q=language:${encodeURIComponent(linguagem)}&sort=stars&order=desc`,
      );
      const data = response.data;

      if (!Array.isArray(data?.items)) {
        throw new TypeError("Lista de repositórios inválida.");
      }
      if (data.items.length > 0) {
        const topRepos = data.items.slice(0, 5);
        if (
          !topRepos.every(
            (repo) =>
              validText(repo?.full_name, MAX_TEXT_ATTACHMENT_BYTES) &&
              isHttpUrl(repo.html_url) &&
              Number.isSafeInteger(repo.stargazers_count) &&
              repo.stargazers_count >= 0,
          )
        ) {
          throw new TypeError("Repositório inválido.");
        }
        const repoList = topRepos.map(
          (repo) =>
            `• [${repo.full_name}](${repo.html_url}) - ${repo.stargazers_count} estrelas`,
        );
        const message = `Aqui estão os top 5 repositórios de ${linguagem} no GitHub:\n${repoList.join("\n")}`;

        payload = textPayload(message, "repositorios.txt");
      } else {
        payload = textPayload(
          `Não foi possível encontrar repositórios para a linguagem ${linguagem} no GitHub.`,
          "repositorios.txt",
        );
      }
    } catch {
      payload =
        "Ocorreu um erro ao buscar repositórios. Tente novamente mais tarde.";
    }
    return respond(interaction, payload);
  },
};
