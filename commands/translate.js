const { SlashCommandBuilder } = require('@discordjs/builders');
const axios = require('axios');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('translate')
        .setDescription('Traduz um texto para o idioma especificado')
        .addStringOption(option => 
            option.setName('idioma')
                .setDescription('Idioma para o qual o texto será traduzido')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('texto')
                .setDescription('Texto a ser traduzido')
                .setRequired(true)),

    async execute(interaction) {
        const texto = interaction.options.getString('texto');
        const idioma = interaction.options.getString('idioma');

        try {
            const response = await axios.get(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${idioma}&dt=t&q=${encodeURIComponent(texto)}`);
            
            // A resposta é um array de arrays, onde o primeiro elemento contém a tradução.
            const traducao = response.data[0][0][0];

            // Adiciona um emoji de mapa antes do texto traduzido
            const textoTraduzido = `🗺️ | <@${interaction.user.id}>\n${traducao}`;

            await interaction.reply(`${textoTraduzido}`);
        } catch (error) {
            console.error('Erro ao traduzir texto:', error);
            await interaction.reply({ content: 'Ocorreu um erro ao traduzir o texto.', ephemeral: true });
        }
    },
};
