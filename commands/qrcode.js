const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { deferResponse, respond } = require("../lib/interactions");
const {
  DISCORD_LIMITS,
  validText,
  textAttachment,
} = require("../lib/content-limits");
const qrcode = require("qrcode");

// Largest version-40/M capacity (numeric mode); other modes are checked by the
// encoder itself. M is also the library's previous default correction level.
const QR_MAX_INPUT_LENGTH = 5596;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("qrcode")
    .setDescription("Gera um QR code a partir de um link fornecido")
    .addStringOption((option) =>
      option
        .setName("link")
        .setDescription("O link para o qual gerar o QR code")
        .setRequired(true),
    ),

  async execute(interaction) {
    const link = interaction.options.getString("link");
    if (!validText(link, QR_MAX_INPUT_LENGTH)) {
      return respond(interaction, {
        content: `Informe um texto não vazio de até ${QR_MAX_INPUT_LENGTH} caracteres para gerar o QR Code.`,
        ephemeral: true,
      });
    }

    await deferResponse(interaction);
    let png;
    try {
      png = await qrcode.toBuffer(link, {
        type: "png",
        errorCorrectionLevel: "M",
      });
      if (!Buffer.isBuffer(png) || png.length === 0) throw new TypeError();
    } catch {
      return respond(interaction, {
        content:
          "Não foi possível gerar o QR Code. Verifique o texto e reduza seu tamanho; a capacidade depende dos caracteres usados.",
        ephemeral: true,
      });
    }

    const qrCodeFileName = "qrcode.png";
    const description = `Aqui está o QR code para o link: ${link}`;
    const files = [{ attachment: png, name: qrCodeFileName }];
    if (description.length > DISCORD_LIMITS.description) {
      files.push(...textAttachment(link, "conteudo-qrcode.txt").files);
    }

    const qrCodeEmbed = new EmbedBuilder()
      .setColor("#ff9c00")
      .setTitle("QR Code Gerado")
      .setDescription(
        description.length <= DISCORD_LIMITS.description
          ? description
          : "O conteúdo completo do QR Code está no arquivo de texto anexo.",
      )
      .setImage(`attachment://${qrCodeFileName}`)
      .setFooter({
        text: "CodeBucket",
        iconURL: "https://cdn-icons-png.flaticon.com/512/190/190544.png",
      })
      .setTimestamp();

    // The attachment owns this invocation's Buffer. There is no shared path,
    // filesystem operation or resource to clean up after a failed delivery.
    await respond(interaction, { embeds: [qrCodeEmbed], files });
  },
};
