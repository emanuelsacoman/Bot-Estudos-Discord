const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

// Objeto para armazenar os temporizadores ativos
let timers = {};

module.exports = {
    data: new SlashCommandBuilder()
        .setName("timer")
        .setDescription("Define um temporizador")
        .addSubcommand(subcommand =>
            subcommand
                .setName("set")
                .setDescription("Define um temporizador")
                .addIntegerOption(option =>
                    option.setName("tempo")
                        .setDescription("Apenas tempo em minutos")
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

        try {
            if (subcommand === "set") {
                const tempoEmMinutos = interaction.options.getInteger("tempo");
                const tempoEmMilissegundos = tempoEmMinutos * 60 * 1000;

                const embed1 = new EmbedBuilder()
                    .setColor('#00e903')
                    .setTitle("Temporizador Iniciado")
                    .setDescription(`Temporizador de <@${interaction.user.id}> definido para **${tempoEmMinutos} minuto(s)**!`)
                    .setFooter({ text: 'CodeBucket', iconURL: 'https://cdn-icons-png.flaticon.com/512/190/190544.png' })
                    .setTimestamp();

                const embed2 = new EmbedBuilder()
                    .setColor('#ff090d')
                    .setTitle("Temporizador Finalizado")
                    .setDescription(`<@${interaction.user.id}>, trimtrimtrim!`)
                    .setFooter({ text: 'CodeBucket', iconURL: 'https://cdn-icons-png.flaticon.com/512/190/190544.png' })
                    .setTimestamp();

                // Se houver um temporizador anteriormente definido para o mesmo usuário, cancelá-lo
                if (timers[interaction.user.id]) {
                    clearTimeout(timers[interaction.user.id]);
                    delete timers[interaction.user.id];
                }

                // Define o novo temporizador
                timers[interaction.user.id] = setTimeout(() => {
                    interaction.editReply({ content: `<@${interaction.user.id}>`, embeds: [embed2] }).then(() => {
                        // Obter o canal onde a interação ocorreu e enviar a mensagem
                        const channel = interaction.channel;
                        channel.send({ content: `<@${interaction.user.id}>`, embeds: [embed2] });
                    });
                }, tempoEmMilissegundos);

                await interaction.reply({ content: `<@${interaction.user.id}>`, embeds: [embed1] });
            } else if (subcommand === "stop") {
                // Se houver um temporizador definido para o usuário, cancelá-lo
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
                    await interaction.reply({ content: "Não há temporizador em execução para você.", ephemeral: true});
                }
            }
        } catch (error) {
            console.error(error);
        }
    }
};
