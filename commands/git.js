const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

const exampleEmbed = new EmbedBuilder()
	.setColor('#ff9c00')
	.setTitle("Comandos do Git")
	.addFields(
		{ name: '$ git init [nome-do-projeto]', value: 'Cria um novo repositório local com um nome especificado', inline: true}
		,{ name: '$ git clone [url]', value: 'Baixa um projeto e seu histórico de versão inteiro', inline: true}
		,{ name: '$ git stash', value: 'Armazena temporariamente todos os arquivos monitorados modificados', inline: true}
		,{ name: '\u200B', value: '\u200B'}
		,{ name: '$ git status', value: 'Revise edições e crie uma transação de commit', inline: true}
		,{ name: '$ git add [arquivo]', value: 'Faz o snapshot de um arquivo na preparação para versionamento', inline: true}
		,{ name: '$ git commit -m "[mensagem]"', value: 'Grava o snapshot permanentemente do arquivo no histórico de versão', inline: true}
		,{ name: '\u200B', value: '\u200B'}
		,{ name: '$ git branch', value: 'Lista todos os branches locais no repositório atual', inline: true}
		,{ name: '$ git branch [nome-branch]', value: 'Cria uma nova branch', inline: true}
		,{ name: '$ git switch -c [nome-branch]', value: 'Muda para a branch especificada e atualiza o diretório de trabalho', inline: true}
		,{ name: '\u200B', value: '\u200B'}
		,{ name: '$ git merge [nome-branch]', value: 'Combina o histórico da branch especificada a branch atual', inline: true}
		,{ name: '$ git push [alias] [branch]', value: 'Envia todos os commits do branch local para o GitHub', inline: true}
		,{ name: '$ git pull', value: 'Baixa o histórico e incorpora as mudanças', inline: true}
		,{ name: '$ git remote', value: 'Lista todas as conexões remotas', inline: true}
		,{ name: '$ git remote add [alias] [url]', value: 'Adiciona um novo repositório remoto', inline: true}
		,{ name: '$ git remote remove [alias]', value: 'Remove o repositório remoto', inline: true}
		,{ name: '\u200B', value: '\u200B'}
		,{ name: '$ git config [chave] [valor]', value: 'Configura as preferências do Git', inline: true}
		,{ name: '$ git config --list', value: 'Lista todas as configurações do Git', inline: true}
	)
	.setFooter({ text: 'CodeBucket', iconURL: 'https://cdn-icons-png.flaticon.com/512/190/190544.png' })
	.setTimestamp();

module.exports = {
    data: new SlashCommandBuilder()
        .setName("git")
        .setDescription("Relembre comandos do Git"),

    async execute(interaction) {
        await interaction.reply({ embeds: [exampleEmbed] });
    }
}