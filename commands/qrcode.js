const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { deferResponse, respond, runSecondary } = require("../lib/interactions");
const qrcode = require("qrcode");
const fs = require("fs");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("qrcode")
        .setDescription("Gera um QR code a partir de um link fornecido")
        .addStringOption(option =>
            option.setName("link")
                .setDescription("O link para o qual gerar o QR code")
                .setRequired(true)),

    async execute(interaction) {
        const link = interaction.options.getString("link");
        const qrCodeFileName = `qrcode_${Date.now()}.png`;

        await deferResponse(interaction);
        await generateQRCode(link, qrCodeFileName);

        const qrCodeEmbed = new EmbedBuilder()
            .setColor("#ff9c00")
            .setTitle("QR Code Gerado")
            .setDescription(`Aqui está o QR code para o link: ${link}`)
            .setImage(`attachment://${qrCodeFileName}`)
            .setFooter({ text: "CodeBucket", iconURL: "https://cdn-icons-png.flaticon.com/512/190/190544.png" })
            .setTimestamp();

        await respond(interaction, { embeds: [qrCodeEmbed], files: [qrCodeFileName] });

        await runSecondary(() => fs.unlinkSync(qrCodeFileName));
    },
};

async function generateQRCode(link, fileName) {
    await qrcode.toFile(fileName, link);
}
