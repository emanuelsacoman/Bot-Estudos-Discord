const { SlashCommandBuilder } = require("discord.js");
const axios = require("axios");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("repositorys")
        .setDescription("Mostra os repositórios mais populares de uma linguagem específica no GitHub")
        .addStringOption(option =>
            option.setName("linguagem")
                .setDescription("A linguagem de programação desejada")
                .setRequired(true)),

    async execute(interaction) {
        const linguagem = interaction.options.getString("linguagem");

        try {
            const response = await axios.get(`https://api.github.com/search/repositories?q=language:${linguagem}&sort=stars&order=desc`);
            const data = response.data;

            if (data && data.items && data.items.length > 0) {
                const topRepos = data.items.slice(0, 5); 
                const repoList = topRepos.map(repo => `• [${repo.full_name}](${repo.html_url}) - ${repo.stargazers_count} estrelas`);
                const message = `Aqui estão os top 5 repositórios de ${linguagem} no GitHub:\n${repoList.join("\n")}`;

                await interaction.reply(message);
            } else {
                await interaction.reply(`Não foi possível encontrar repositórios para a linguagem ${linguagem} no GitHub.`);
            }
        } catch (error) {
            console.error("Erro ao buscar repositórios no GitHub:", error);
            await interaction.reply("Ocorreu um erro ao buscar repositórios. Tente novamente mais tarde.");
        }
    },
};
