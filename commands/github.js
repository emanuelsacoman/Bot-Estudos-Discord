const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");



module.exports = {
    data: new SlashCommandBuilder()
        .setName("github")
        .setDescription("Exibe informações sobre um repositório do GitHub")
        .addStringOption(option =>
            option.setName('repositorio')
                .setDescription('Nome do usuário/repositório (formato: usuario/repositorio)')
                .setRequired(true)),

    async execute(interaction){
        const repository = interaction.options.getString('repositorio');

        try {
            const response = await fetch(`https://api.github.com/repos/${repository}`);
            const data = await response.json();

            if (response.status === 200) {
                const exampleEmbed = new EmbedBuilder()
                    .setColor('Blue')
                    .setAuthor({ name: `${data.owner.login}`, iconURL: `${data.owner.avatar_url}`, url: `${data.html_url}` })
                    .setTitle(`Repositório de ${data.owner.login}`)
                    .setThumbnail(`${data.owner.avatar_url}`)
                    .addFields(
                        { name: '\u200B', value: '\u200B' },
                        { name: 'Full Name 🤓', value: `${data.full_name}` || 'N/A', inline: true },
                        { name: 'Description 🌎', value: `${data.description}` || 'Sem descrição disponível.', inline: true },
                        { name: '\u200B', value: '\u200B' },
                        { name: 'Language ‍💻', value: `${data.language}` || 'Não especificada', inline: true },
                        { name: 'Stars ⭐', value: `${data.stargazers_count}` || '0', inline: true },
                        { name: 'Forks 🍴', value: `${data.forks_count}` || '0', inline: true },
                        { name: 'URL', value: `${data.html_url}` || 'N/A' }
                    )
                    .setDescription(`${data.description}` || 'Sem descrição disponível.')
                    .setURL(`${data.html_url}`)
                    .setFooter({ text: 'CodeBucket', iconURL: 'https://cdn-icons-png.flaticon.com/512/190/190544.png' })
                    .setTimestamp();
                await interaction.reply({ embeds: [exampleEmbed] })
            } else {
                await interaction.reply('Repositório não encontrado.');
            }
        } catch (error) {
            console.error('Erro:', error);
            await interaction.reply('Ocorreu um erro ao buscar informações do repositório.');
        }
    }
};
