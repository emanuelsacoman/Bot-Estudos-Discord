const { SlashCommandBuilder } = require('discord.js');

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
                await interaction.reply('Você já tem um temporizador em execução. Use "/timer stop" para pará-lo.');
                return;
            }
    
            if (subcommand === 'seconds') {
                const timeInSeconds = interaction.options.getInteger('seconds');
    
                timers[interaction.user.id] = setTimeout(async () => {
                    try {
                        if(timeInSeconds != 1){
                            await interaction.followUp(`⏰ Tempo de ${timeInSeconds} segundos acabou para <@${interaction.user.id}>!`);
                        }else {
                            await interaction.followUp(`⏰ Tempo de ${timeInSeconds} segundo acabou para <@${interaction.user.id}>!`);
                        }
                    } catch (error) {
                        console.error(error);
                    } finally {
                        delete timers[interaction.user.id];
                    }
                }, timeInSeconds * 1000);
                if(timeInSeconds != 1){
                    await interaction.reply(`Temporizador definido para **${timeInSeconds}** segundos.`);
                }else {
                    await interaction.reply(`Temporizador definido para **${timeInSeconds}** segundo.`);
                }
            
            } else if (subcommand === 'minutes') {
                const timeInMinutes = interaction.options.getInteger('minutes');
    
                timers[interaction.user.id] = setTimeout(async () => {
                    try {
                        if(timeInMinutes != 1){
                            await interaction.followUp(`⏰ Tempo de ${timeInMinutes} minutos acabou para <@${interaction.user.id}>!`);
                        }else{
                            await interaction.followUp(`⏰ Tempo de ${timeInMinutes} minuto acabou para <@${interaction.user.id}>!`);
                        }
                    } catch (error) {
                        console.error(error);
                    } finally {
                        delete timers[interaction.user.id];
                    }
                }, timeInMinutes * 60 * 1000);
    
                if(timeInMinutes != 1){
                    await interaction.reply(`Temporizador definido para **${timeInMinutes}** minutos.`);
                }else{
                    await interaction.reply(`Temporizador definido para **${timeInMinutes}** minuto.`);
                }
            } else if (subcommand === 'hours') {
                const timeInHours = interaction.options.getInteger('hours');
    
                timers[interaction.user.id] = setTimeout(async () => {
                    try {
                        if(timeInHours != 1){
                            await interaction.followUp(`⏰ Tempo de ${timeInHours} horas acabou para <@${interaction.user.id}>!`);
                        }else {
                            await interaction.followUp(`⏰ Tempo de ${timeInHours} hora acabou para <@${interaction.user.id}>!`);
                        }
                    } catch (error) {
                        console.error(error);
                    } finally {
                        delete timers[interaction.user.id];
                    }
                }, timeInHours * 60 * 60 * 1000);

                if(timeInHours != 1){
                    await interaction.reply(`Temporizador definido para **${timeInHours}** horas.`);
                }else {
                    await interaction.reply(`Temporizador definido para **${timeInHours}** hora.`);
                }
    
            }
            else if (subcommand === 'stop') {
                if (timers[interaction.user.id]) {
                    clearTimeout(timers[interaction.user.id]);
                    delete timers[interaction.user.id];
                    await interaction.reply('Temporizador excluído.');
                } else {
                    await interaction.reply('Não há temporizador em execução.');
                }
            }
            
        },
};
