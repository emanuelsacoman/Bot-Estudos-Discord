const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const axios = require("axios");

const dotenv = require('dotenv')
dotenv.config()
const UPTIME_TOKEN = process.env.UPTIME_TOKEN;

module.exports = {
    data: new SlashCommandBuilder()
        .setName("status")
        .setDescription("Verifica se um site está online.")
        .addStringOption(option =>
            option.setName("url")
                .setDescription("URL do site (sem https://)")
                .setRequired(true)
        ),

    async execute(interaction) {
        const url = interaction.options.getString("url");

        try {
            const response = await axios.post(
                "https://api.uptimerobot.com/v2/getMonitors",
                {
                    api_key: UPTIME_TOKEN,
                    format: "json",
                    logs: 1,
                    custom_uptime_ratios: "1"
                },
                {
                    headers: { "Content-Type": "application/json" }
                }
            );

            if (!response.data || !response.data.monitors) {
                return interaction.reply({
                    content: "Não foi possível obter os monitores do Uptime Robot.",
                    ephemeral: true
                });
            }

            const monitor = response.data.monitors.find(m => m.url.includes(url));

            if (monitor) {
                const status = monitor.status === 2 ? "🟢 Online" : "🔴 Offline";

                const embed = new EmbedBuilder()
                    .setColor(monitor.status === 2 ? "#00ff00" : "#ff0000")
                    .setTitle("Verificação de Status")
                    .setDescription(`O site **${url}** está **${status}**.`)
                    .setFooter({ text: "CodeBucket", iconURL: "https://cdn-icons-png.flaticon.com/512/190/190544.png" })
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });
            } else {
                await interaction.reply({
                    content: "Este site não está monitorado pelo Uptime Robot.",
                    ephemeral: true
                });
            }
        } catch (error) {
            console.error(error);
            await interaction.reply({
                content: "Ocorreu um erro ao verificar o status do site.",
                ephemeral: true
            });
        }
    }
};
