const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

// Mapa para armazenar listas de tarefas por usuário
const userToDoLists = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName("todo")
        .setDescription("Gerencia a lista de tarefas")
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Adiciona uma tarefa à sua lista')
                .addStringOption(option =>
                    option.setName('tarefa')
                        .setDescription('Texto da tarefa')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('Lista todas as tarefas')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove uma tarefa da lista')
                .addIntegerOption(option =>
                    option.setName('numero')
                        .setDescription('Número da tarefa a ser removida')
                        .setRequired(true)
                )
        ),

        async execute(interaction) {
            const userId = interaction.user.id; // ID do usuário
            const subcommand = interaction.options.getSubcommand();
    
            if (!userToDoLists.has(userId)) {
                // Se o usuário não tem uma lista, cria uma nova lista vazia para o usuário
                userToDoLists.set(userId, []);
            }
    
            const toDoList = userToDoLists.get(userId); // Obtém a lista de tarefas do usuário
    
            if (subcommand === 'add') {
                const task = interaction.options.getString('tarefa');
                if (toDoList.includes(task)) {
                    await interaction.reply({ content: `A tarefa "${task}" já está na sua lista.`, ephemeral: true });
                    return;
                }
                toDoList.push(task);
    
                const exampleEmbedAdd = new EmbedBuilder()
                    .setColor('#00e903')
                    .setTitle("TO-DO")
                    .setDescription(`Tarefa **${task}** adicionada à sua lista.`)
                    .setFooter({ text: 'CodeBucket', iconURL: 'https://cdn-icons-png.flaticon.com/512/190/190544.png' })
                    .setTimestamp();
    
                await interaction.reply({ embeds: [exampleEmbedAdd] });
            } else if (subcommand === 'list') {
                if (toDoList.length === 0) {
                    await interaction.reply({content: "Sua lista de tarefas está vazia.", ephemeral: true });
                    return;
                }
                
                let list = 'Sua Lista de Tarefas:\n';
                toDoList.forEach((task, index) => {
                    list += `${index + 1}. ${task}\n`;
                });
    
                const exampleEmbedDel = new EmbedBuilder()
                    .setColor('#ffff00')
                    .setTitle("TO-DO")
                    .setDescription(`${list}`)
                    .setFooter({ text: 'CodeBucket', iconURL: 'https://cdn-icons-png.flaticon.com/512/190/190544.png' })
                    .setTimestamp();
    
                await interaction.reply({ embeds: [exampleEmbedDel] });
            } else if (subcommand === 'remove') {
                const index = interaction.options.getInteger('numero');
                if (index < 1 || index > toDoList.length) {
                    await interaction.reply({ content: "Por favor, especifique um número válido de tarefa para remover.", ephemeral: true });
                    return;
                }
    
                const removedTask = toDoList.splice(index - 1, 1)[0];
    
                const exampleEmbedDel = new EmbedBuilder()
                    .setColor('#ff090d')
                    .setTitle("TO-DO")
                    .setDescription(`Tarefa **${removedTask}** removida da sua lista.`)
                    .setFooter({ text: 'CodeBucket', iconURL: 'https://cdn-icons-png.flaticon.com/512/190/190544.png' })
                    .setTimestamp();
    
                await interaction.reply({ embeds: [exampleEmbedDel] });
            }
        }
};
