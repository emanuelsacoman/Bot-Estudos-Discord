const { SlashCommandBuilder } = require("discord.js");
const { deferResponse, respond } = require("../lib/interactions");
const { getJson, HttpRequestError } = require("../lib/http-client");
const {
  requireSuccessfulResponse,
  apiErrorMessage,
} = require("../lib/api-errors");
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
        {
          headers: {
            Accept: "application/vnd.github+json",
            "User-Agent": "CodeBucket",
            "X-GitHub-Api-Version": "2022-11-28",
          },
        },
      );
      requireSuccessfulResponse(response);
      const data = response.data;

      if (
        !Array.isArray(data?.items) ||
        (data.incomplete_results !== undefined &&
          typeof data.incomplete_results !== "boolean")
      ) {
        throw new HttpRequestError("HTTP_INVALID_BODY");
      }
      const partialNotice = data.incomplete_results
        ? "A busca retornou resultados parciais.\n"
        : "";
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
          throw new HttpRequestError("HTTP_INVALID_BODY");
        }
        const repoList = topRepos.map(
          (repo) =>
            `• [${repo.full_name}](${repo.html_url}) - ${repo.stargazers_count} estrelas`,
        );
        const message = `${partialNotice}Aqui estão os top 5 repositórios de ${linguagem} no GitHub:\n${repoList.join("\n")}`;

        payload = textPayload(message, "repositorios.txt");
      } else {
        payload = textPayload(
          data.incomplete_results
            ? "A busca retornou resultados parciais e não encontrou repositórios nesta resposta."
            : `Não foi possível encontrar repositórios para a linguagem ${linguagem} no GitHub.`,
          "repositorios.txt",
        );
      }
    } catch (error) {
      payload = apiErrorMessage(
        error,
        "Ocorreu um erro ao buscar repositórios. Tente novamente mais tarde.",
      );
    }
    return respond(interaction, payload);
  },
};
