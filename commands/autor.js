const { SlashCommandBuilder, EmbedBuilder } = require("discord.js")

const exampleEmbed = new EmbedBuilder()
	.setColor('#ff9c00')
	.setTitle('Quem fez?')
	.setDescription('**CodeBucket** é um projeto a nível acadêmico, feito por *Emanuel Vinícius Sacoman* (eu), que tem como objetivo ajudar usuários a se familiarizarem com a utilização do Discord para estudos voltados para a área de programação básica.')
	.setURL('https://github.com/EvS444')
	.setFooter({ text: 'Emanuel', iconURL: 'https://portfolio-evs.netlify.app/imagens/selfie.jpg' })
	.setTimestamp();

module.exports = {
    data: new SlashCommandBuilder()
        .setName("autor")
        .setDescription("Será que quem fez o CodeBucket é bonito?"),

    async execute(interaction) {
        await interaction.reply({ embeds: [exampleEmbed] })
    }
}