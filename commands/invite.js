const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('invite')
    .setDescription('Gera um convite do CodeBucket para seu servidor'),

  async execute(interaction) {
    const inviteURL = process.env.INVITE_URL ||
      'https://discord.com/oauth2/authorize?client_id=1193011045577523300&permissions=0&scope=bot%20applications.commands';

    const exampleEmbed = new EmbedBuilder()
      .setColor('Blue')
      .setTitle('📨 Convite do CodeBucket')
      .setDescription('Clique no botão abaixo para adicionar o CodeBucket ao seu servidor!')
      .setFooter({ text: 'CodeBucket', iconURL: 'https://cdn-icons-png.flaticon.com/512/190/190544.png' })
      .setTimestamp();

    const inviteButton = new ButtonBuilder()
      .setLabel('Adicionar ao servidor')
      .setStyle(ButtonStyle.Link)
      .setURL(inviteURL);

    const row = new ActionRowBuilder().addComponents(inviteButton);

    const message = await interaction.reply({
      embeds: [exampleEmbed],
      components: [row],
      fetchReply: true
    });

    await message.react('❤️');
  }
};