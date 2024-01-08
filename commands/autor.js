const { SlashCommandBuilder, EmbedBuilder } = require("discord.js")

const exampleEmbed = new EmbedBuilder()
	.setColor('#ff9c00')
	.setTitle('Quem fez?')
	.setDescription('**CodeBucket** é um projeto a nível acadêmico, feito por *Emanuel Vinícius Sacoman* (eu) em seus primeiros momentos no curso de Análise e Desenvolvimento de Sistemas, que tem como objetivo ajudar usuários a se familiarizarem com a utilização do Discord para estudos voltados para a área de programação básica.')
	.setURL('https://github.com/EvS444')
	.setFooter({ text: 'Emanuel', iconURL: 'https://portfolio-evs.netlify.app/imagens/selfie.jpg' })
	.setTimestamp();

module.exports = {
    data: new SlashCommandBuilder()
        .setName("autor")
        .setDescription("Será que ele é bonito?"),

    async execute(interaction) {
        await interaction.reply({ embeds: [exampleEmbed] })
    }
}