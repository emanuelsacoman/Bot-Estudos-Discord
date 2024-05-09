const { SlashCommandBuilder, EmbedBuilder } = require("discord.js")

const exampleEmbed = new EmbedBuilder()
	.setColor('Blue')
	.setTitle('Quem fez?')
	.setDescription('**CodeBucket** é um projeto a nível acadêmico, feito por *Emanuel Vinícius Sacoman* (eu) em seus primeiros momentos no curso de Análise e Desenvolvimento de Sistemas, que tem como objetivo ajudar usuários a se familiarizarem com a utilização do Discord para estudos voltados para a área de programação básica.')
	.setURL('https://github.com/emanuelsacoman')
	.setFooter({ text: 'Emanuel', iconURL: 'https://avatars.githubusercontent.com/u/63565495?v=4' })
	.setTimestamp();

module.exports = {
    data: new SlashCommandBuilder()
        .setName("autor")
        .setDescription("Será que ele é bonito?"),

        async execute(interaction) {
            const emojis = ['😄', '😊', '😎', '🥳', '🤩', '🙈','😀', '😃', '😁', '😆', '😅', '😂', '🤣', '😊',
            '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰','😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪',
            '🤨', '🧐', '🤓', '😏','😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '😢',
            '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔',
            '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤',
            '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿', '👹', '👺',
            '🤡', '👻', '👽', '👾', '🤖', '🎃', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾', '🧠',
            '❤️', ''];
            const message = await interaction.reply({ embeds: [exampleEmbed], fetchReply: true })
                .catch(console.error);
        
            if (message) {
                for (let i = 0; i < 3; i++) {
                    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
                    await message.react(randomEmoji);
                }
            }
        }        
}