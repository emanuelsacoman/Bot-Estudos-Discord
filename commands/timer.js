const { SlashCommandBuilder, EmbedBuilder  } = require("discord.js");

let timers = {};

module.exports = {
    data: new SlashCommandBuilder()
        .setName("timer")
        .setDescription("Define um temporizador")
        .addSubcommand(subcommand =>
            subcommand
                .setName("set")
                .setDescription("Define um temporizador")
                .addStringOption(option =>
                    option.setName("horario")
                        .setDescription("Horário no formato HH:MM (24 horas)")
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("stop")
                .setDescription("Para o temporizador existente")
        ),

    async execute(interaction) {
        if (!interaction.isCommand()) return;

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === "set") {
            const userId = interaction.user.id;
            if (timers[userId]) {
                await interaction.reply({ content: "Você já tem um temporizador ativo. Use */timer stop* para excluí-lo.", ephemeral: true });
                return;
            }
            
            const timeString = interaction.options.getString("horario");
    
            // Verifica se o formato do horário é válido (formato: HH:MM)
            const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
            if (!timeRegex.test(timeString)) {
                await interaction.reply("Formato de horário inválido. Use o formato 'HH:MM' (24 horas).");
                return;
            }
    
            const [hours, minutes] = timeString.split(":");
            const now = new Date();
            const targetTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);
    
            const timeDifference = targetTime.getTime() - now.getTime();
            if (timeDifference <= 0) {
                await interaction.reply({content: "O horário especificado já passou.", ephemeral: true});
                return;
            }
    
            timers[interaction.user.id] = setTimeout(async () => {
                try {
                    const exampleEmbed = new EmbedBuilder()
                        .setColor('#ff090d')
                        .setTitle("Temporizador Finalizado")
                        .setDescription(`<@${interaction.user.id}>, trimtrimtrim!`)
                        .setFooter({ text: 'CodeBucket', iconURL: 'https://cdn-icons-png.flaticon.com/512/190/190544.png' })
                        .setTimestamp();
                    
                    const followUpMessage = await interaction.followUp({content: `||<@${interaction.user.id}>||`, embeds: [exampleEmbed] });
                    await followUpMessage.react('⏰');
                    
                    delete timers[interaction.user.id];
                } catch (error) {
                    console.error("Erro ao enviar mensagem de tempo decorrido:", error);
                }
            }, timeDifference);

            const exampleEmbed = new EmbedBuilder()
                        .setColor('#00e903')
                        .setTitle("Temporizador Iniciado")
                        .setDescription(`Temporizador de <@${interaction.user.id}> definido para **${timeString}**`)
                        .setFooter({ text: 'CodeBucket', iconURL: 'https://cdn-icons-png.flaticon.com/512/190/190544.png' })
                        .setTimestamp();
                            
                await interaction.reply({ embeds: [exampleEmbed] });

        } else if (subcommand === "stop") {
            if (timers[interaction.user.id]) {
                clearTimeout(timers[interaction.user.id]);
                delete timers[interaction.user.id];
                const exampleEmbed = new EmbedBuilder()
                            .setColor('#ffff00')
                            .setTitle("Temporizador Excluído")
                            .setDescription(`<@${interaction.user.id}> finalizou seu próprio temporizador.`)
                            .setFooter({ text: 'CodeBucket', iconURL: 'https://cdn-icons-png.flaticon.com/512/190/190544.png' })
                            .setTimestamp();
                            
                await interaction.reply({ embeds: [exampleEmbed] }); 
            } else {
                await interaction.reply({content: "Não há temporizador em execução.", ephemeral: true});
            }
        }
    }
};
