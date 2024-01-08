const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

let timers = {};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('timer')
        .setDescription('Um temporizador para auxiliar nos estudos')
        .addSubcommand((subcommand) =>
            subcommand
                .setName('seconds')
                .setDescription('Inicia um temporizador em segundos')
                .addIntegerOption((option) =>
                    option
                        .setName('seconds')
                        .setDescription('O tempo em segundos')
                        .setRequired(true)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('minutes')
                .setDescription('Inicia um temporizador em minutos')
                .addIntegerOption((option) =>
                    option
                        .setName('minutes')
                        .setDescription('O tempo em minutos')
                        .setRequired(true)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('hours')
                .setDescription('Inicia um temporizador em horas')
                .addIntegerOption((option) =>
                    option
                        .setName('hours')
                        .setDescription('O tempo em horas')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('stop')
                .setDescription('Para o temporizador existente')
        ),

        async execute(interaction) {
            if (!interaction.isCommand()) return;
    
            const subcommand = interaction.options.getSubcommand();

            if (timers[interaction.user.id] && subcommand !== 'stop') {
                await interaction.reply({content: 'Você já tem um temporizador em execução. Use "/timer stop" para pará-lo.', ephemeral: true});
                return;
            }
    
            if (subcommand === 'seconds') {
                const timeInSeconds = interaction.options.getInteger('seconds');
    
                timers[interaction.user.id] = setTimeout(async () => {
                    try {
                        const exampleEmbed = new EmbedBuilder()
                            .setColor('#ff090d')
                            .setTitle("Temporizador Finalizado")
                            .setDescription(`Tempo de ${timeInSeconds} ${timeInSeconds !== 1 ? 'segundos' : 'segundo'} acabou para <@${interaction.user.id}>!`)
                            .setFooter({ text: 'CodeBucket', iconURL: 'https://cdn-icons-png.flaticon.com/512/190/190544.png' })
                            .setTimestamp();
                            
                        const followUpMessage = await interaction.followUp({ embeds: [exampleEmbed] });
                        await followUpMessage.react('⏰');
                    } catch (error) {
                        console.error(error);
                    } finally {
                        delete timers[interaction.user.id];
                    }
                }, timeInSeconds * 1000);

                const exampleEmbed = new EmbedBuilder()
                            .setColor('#00e903')
                            .setTitle("Temporizador Iniciado")
                            .setDescription(`Temporizador definido para **${timeInSeconds} ${timeInSeconds !== 1 ? 'segundos' : 'segundo'}**.`)
                            .setFooter({ text: 'CodeBucket', iconURL: 'https://cdn-icons-png.flaticon.com/512/190/190544.png' })
                            .setTimestamp();
                            
                await interaction.reply({ embeds: [exampleEmbed] });
            
            } else if (subcommand === 'minutes') {
                const timeInMinutes = interaction.options.getInteger('minutes');
    
                timers[interaction.user.id] = setTimeout(async () => {
                    try {
                        const exampleEmbed = new EmbedBuilder()
                            .setColor('#ff090d')
                            .setTitle("Temporizador Finalizado")
                            .setDescription(`Tempo de ${timeInMinutes} ${timeInMinutes !== 1 ? 'minutos' : 'minuto'} acabou para <@${interaction.user.id}>!`)
                            .setFooter({ text: 'CodeBucket', iconURL: 'https://cdn-icons-png.flaticon.com/512/190/190544.png' })
                            .setTimestamp();
                            
                        const followUpMessage = await interaction.followUp({ embeds: [exampleEmbed] });
                        await followUpMessage.react('⏰');
                    } catch (error) {
                        console.error(error);
                    } finally {
                        delete timers[interaction.user.id];
                    }
                }, timeInMinutes * 60 * 1000);
                const exampleEmbed = new EmbedBuilder()
                            .setColor('#00e903')
                            .setTitle("Temporizador Iniciado")
                            .setDescription(`Temporizador definido para **${timeInMinutes} ${timeInMinutes !== 1 ? 'minutos' : 'minuto'}**.`)
                            .setFooter({ text: 'CodeBucket', iconURL: 'https://cdn-icons-png.flaticon.com/512/190/190544.png' })
                            .setTimestamp();
                            
                await interaction.reply({ embeds: [exampleEmbed] }); 

            } else if (subcommand === 'hours') {
                const timeInHours = interaction.options.getInteger('hours');
    
                timers[interaction.user.id] = setTimeout(async () => {
                    try {
                        const exampleEmbed = new EmbedBuilder()
                            .setColor('#ff090d')
                            .setTitle("Temporizador Finalizado")
                            .setDescription(`Tempo de ${timeInHours} ${timeInHours !== 1 ? 'horas' : 'hora'} acabou para <@${interaction.user.id}>!`)
                            .setFooter({ text: 'CodeBucket', iconURL: 'https://cdn-icons-png.flaticon.com/512/190/190544.png' })
                            .setTimestamp();
                            
                        const followUpMessage = await interaction.followUp({ embeds: [exampleEmbed] });
                        await followUpMessage.react('⏰');
                    } catch (error) {
                        console.error(error);
                    } finally {
                        delete timers[interaction.user.id];
                    }
                }, timeInHours * 60 * 60 * 1000);
                const exampleEmbed = new EmbedBuilder()
                            .setColor('#00e903')
                            .setTitle("Temporizador Iniciado")
                            .setDescription(`Temporizador definido para **${timeInHours} ${timeInHours !== 1 ? 'horas' : 'hora'}**.`)
                            .setFooter({ text: 'CodeBucket', iconURL: 'https://cdn-icons-png.flaticon.com/512/190/190544.png' })
                            .setTimestamp();
                            
                await interaction.reply({ embeds: [exampleEmbed] });    
            }
            else if (subcommand === 'stop') {
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
                    await interaction.reply({content: 'Não há temporizador em execução.', ephemeral: true});
                }
            }            
        },
};
