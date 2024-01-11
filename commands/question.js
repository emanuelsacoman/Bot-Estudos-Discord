const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const axios = require("axios");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("question")
        .setDescription("Faz uma pergunta relacionada à programação (somente em inglês)")
        .addStringOption(option =>
            option.setName("pergunta")
                .setDescription("A pergunta relacionada à programação (deve ser em inglês)")
                .setRequired(true)),

    async execute(interaction) {
        // Obtém a pergunta do usuário a partir da interação
        const userQuestion = interaction.options.getString("pergunta");

        // Verifica se o usuário forneceu uma pergunta
        if (!userQuestion) {
            return interaction.reply({ content: "Por favor, forneça uma pergunta relacionada à programação.", ephemeral: true });
        }

        try {
            // Faz uma chamada para a API do Stack Exchange para obter perguntas relacionadas
            const response = await axios.get(
                `https://api.stackexchange.com/2.3/search?order=desc&sort=activity&intitle=${encodeURIComponent(
                    userQuestion
                )}&site=stackoverflow`
            );

            // Verifica se há resultados da API
            if (response.data.items.length > 0) {
                const topResult = response.data.items[0];
                const answerLink = topResult.is_answered ? `\nResposta: \`${topResult.link}\`` : "";

                // Responde ao usuário no Discord
                //return interaction.reply(`Aqui está uma pergunta relacionada:\n\`${topResult.title}\`\nLink: \`${topResult.link}\`${answerLink}`);

                const exampleEmbed = new EmbedBuilder()
                    .setColor('#ff9c00')
                    .setAuthor({ name: `Stack Overflow`, iconURL: `https://pbs.twimg.com/profile_images/1220067947798024192/30eZhfxx_400x400.png`, url: `${topResult.link}` })
                    .setTitle(`${topResult.title}`)
                    .setThumbnail(`https://pbs.twimg.com/profile_images/1220067947798024192/30eZhfxx_400x400.png`)
                    .addFields(
                        { name: 'Answer link', value: `${topResult.link}` || 'N/A' }
                    )
                    .setURL(`${topResult.link}`)
                    .setFooter({ text: 'CodeBucket', iconURL: 'https://cdn-icons-png.flaticon.com/512/190/190544.png' })
                    .setTimestamp();
                return interaction.reply({ embeds: [exampleEmbed] })
            } else {
                return interaction.reply({ content: "Desculpe, não foi possível encontrar perguntas relacionadas a esta pergunta.", ephemeral: true });
            }
        } catch (error) {
            console.error(error);
            return interaction.reply({ content: "Ocorreu um erro ao buscar perguntas relacionadas. Tente novamente mais tarde.", ephemeral: true });
        }
    },
};
