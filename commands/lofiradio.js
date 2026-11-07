const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { deferResponse, respond } = require("../lib/interactions");
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lofiradio')
    .setDescription('Uma rádio Lofi para relaxar e estudar!'),

  async execute(interaction) {
    let payload;
    try {
      const loFiRadioURL = process.env.LOFIRADIO_URL || 'https://lofiradio.web.app';

      const imageName = 'lofiradio.jpeg';
      const imagePath = path.join(__dirname, '../images', imageName);
      const thumbnailName = 'lofiicon.png';
      const thumbnailPath = path.join(__dirname, '../images', thumbnailName);

      const exampleEmbed = new EmbedBuilder()
        .setColor('#761a7a')
        .setTitle('🌀 Lofi Radio')
        .setURL(loFiRadioURL)
        .setDescription(
            `Relaxe ao som de qualidade em [Lofi Radio](${loFiRadioURL})!\nDescubra novas estações e compartilhe com seus amigos.`
          )
        .setThumbnail(`attachment://${thumbnailName}`) 
        .setImage(`attachment://${imageName}`)
        .addFields(
          { name: '🎶 Estações', value: 'Lofi, Synthwave, Jazz, Rain, Meditation, Vaporwave e muito mais!', inline: false },
          { name: '\u200B', value: '*feito pelo desenvolvedor do CodeBucket*' }
        )
        .setFooter({ text: 'CodeBucket • Lofi Radio', iconURL: 'https://cdn-icons-png.flaticon.com/512/190/190544.png' })
        .setTimestamp();

      const linkButton = new ButtonBuilder()
        .setLabel('Acessar Lofi Radio')
        .setStyle(ButtonStyle.Link)
        .setURL(loFiRadioURL);

      const row = new ActionRowBuilder().addComponents(linkButton);

      payload = {
        embeds: [exampleEmbed],
        components: [row],
        files: [
          { attachment: thumbnailPath, name: thumbnailName },
          { attachment: imagePath, name: imageName }
        ],
      };
    } catch {
      payload = { content: 'Ocorreu um erro ao exibir Lofi Radio. Tente novamente mais tarde.', ephemeral: true };
    }
    if (payload.files) await deferResponse(interaction);
    await respond(interaction, payload);
  },
};
