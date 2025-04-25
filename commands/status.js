const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const axios = require("axios");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("status")
        .setDescription("Verifica se um site está online.")
        .addStringOption(option =>
            option.setName("url")
                .setDescription("URL do site (ex: google.com)")
                .setRequired(true)
        ),

    async execute(interaction) {
        let url = interaction.options.getString("url");

        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            url = `https://${url}`;
        }

        try {
            const response = await axios.get(url, { timeout: 5000 }); 

            const embed = new EmbedBuilder()
                .setColor("#00ff00")
                .setTitle("Verificação de Status")
                .setDescription(`O site **${url}** está **🟢 Online** (Status ${response.status}).`)
                .setFooter({ text: "CodeBucket", iconURL: "https://cdn-icons-png.flaticon.com/512/190/190544.png" })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            let statusCode = error.response ? error.response.status : "Desconhecido";
            
            const embed = new EmbedBuilder()
                .setColor("#ff0000")
                .setTitle("Verificação de Status")
                .setDescription(`O site **${url}** está **🔴 Offline** ou inacessível. (Erro ${statusCode})`)
                .setFooter({ text: "CodeBucket", iconURL: "https://cdn-icons-png.flaticon.com/512/190/190544.png" })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        }
    }
};
