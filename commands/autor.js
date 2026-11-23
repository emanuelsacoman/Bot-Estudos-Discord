const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { respond, runSecondary } = require("../lib/interactions");

module.exports = {
  data: new SlashCommandBuilder()
    .setName('autor')
    .setDescription('Descubra quem criou esse bot'),

  async execute(interaction) {
    const gitHubURL = 'https://github.com/emanuelsacoman';

    const exampleEmbed = new EmbedBuilder()
      .setColor('Blue')
      .setTitle('Quem fez?')
      .setDescription(
        '**CodeBucket** é um projeto a nível acadêmico, feito por *Emanuel Vinícius Sacoman* durante o processo de criação do TCC no curso de Análise e Desenvolvimento de Sistemas, que tem como objetivo ajudar usuários a se familiarizarem com a utilização do Discord para estudos voltados para a área de programação.'
      )
      .setURL(gitHubURL)
      .setFooter({ text: 'Emanuel', iconURL: 'https://avatars.githubusercontent.com/u/63565495?v=4' })
      .setTimestamp();

    const gitButton = new ButtonBuilder()
      .setLabel('Ver no GitHub')
      .setStyle(ButtonStyle.Link)
      .setURL(gitHubURL);

    const row = new ActionRowBuilder().addComponents(gitButton);

    const emojis = [
      '😄', '😊', '😎', '🥳', '🤩', '🙈','😀', '😃', '😁', '😆', '😅', '😂', '🤣', '😊',
      '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰','😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪',
      '🤨', '🧐', '🤓', '😏','😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '😢',
      '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔',
      '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤',
      '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿', '👹', '👺',
      '🤡', '👻', '👽', '👾', '🤖', '🎃', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾', '🧠',
      '❤️'
    ];

    const message = await respond(interaction, {
      embeds: [exampleEmbed],
      components: [row],
      fetchReply: true
    });

    for (let i = 0; i < 3; i++) {
      const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
      await runSecondary(() => message.react(randomEmoji));
    }
  },
};