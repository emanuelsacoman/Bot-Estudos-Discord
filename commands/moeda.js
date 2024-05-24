const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('moeda')
        .setDescription('Converte um valor de uma moeda para outra')
        .addNumberOption(option => 
            option.setName('valor')
                .setDescription('Valor a ser convertido')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('origem')
                .setDescription('Código da moeda de origem (por exemplo, USD)')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('destino')
                .setDescription('Código da moeda de destino (por exemplo, EUR)')
                .setRequired(true)),

    async execute(interaction) {
        const valor = interaction.options.getNumber('valor');
        const origem = interaction.options.getString('origem').toUpperCase();
        const destino = interaction.options.getString('destino').toUpperCase();

        const url = `https://api.exchangerate-api.com/v4/latest/${origem}`;

        try {
            const response = await axios.get(url);
            const taxasDeCambio = response.data.rates;
            const taxaDeCambio = taxasDeCambio[destino];

            if (!taxaDeCambio) {
                await interaction.reply({ content: 'Código de moeda de destino inválido.', ephemeral: true });
                return;
            }

            const valorConvertido = (valor * taxaDeCambio).toFixed(2);
            
            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('Conversão de Moeda')
                .setDescription(`Conversão de ${valor} ${origem} para ${destino}`)
                .addFields(
                    { name: 'Valor Original', value: `${valor} ${origem}`, inline: true },
                    { name: 'Valor Convertido', value: `${valorConvertido} ${destino}`, inline: true },
                    { name: 'Taxa de Câmbio', value: `1 ${origem} = ${taxaDeCambio} ${destino}`, inline: false }
                )
                .setFooter({ text: 'Conversor de Moedas', iconURL: 'https://cdn-icons-png.flaticon.com/512/190/190544.png' })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Erro ao converter moedas:', error);
            if (error.response && error.response.status === 404) {
                await interaction.reply({ content: 'Código de moeda de origem inválido.', ephemeral: true });
            } else {
                await interaction.reply({ content: 'Ocorreu um erro ao converter as moedas. Por favor, tente novamente mais tarde.', ephemeral: true });
            }
        }
    },
};
