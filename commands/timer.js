const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { respond } = require("../lib/interactions");
const {
  createTimerKey,
  createTimerManager,
  TimerDurationError,
  validateDuration,
} = require("../lib/timers");

const timers = createTimerManager();

// This callback retains only its destination and notification, never the
// interaction or its token (which can expire before the timer does).
function notifyChannel(channel, payload) {
  return () => channel.send(payload);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("timer")
    .setDescription("Define um temporizador")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("set")
        .setDescription("Define um temporizador")
        .addIntegerOption((option) =>
          option
            .setName("tempo")
            .setDescription("Apenas tempo em minutos")
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("stop")
        .setDescription("Para o temporizador existente"),
    ),

  async execute(interaction) {
    if (!interaction.isCommand()) return;

    const subcommand = interaction.options.getSubcommand();
    if (subcommand !== "set" && subcommand !== "stop") return;

    let key;
    try {
      key = createTimerKey({
        userId: interaction.user?.id,
        guildId: interaction.guildId,
        channelId: interaction.channelId ?? interaction.channel?.id,
      });
    } catch {
      return respond(interaction, {
        content:
          "Não foi possível identificar o usuário e o servidor ou canal deste temporizador.",
        ephemeral: true,
      });
    }

    if (subcommand === "set") {
      const tempoEmMinutos = interaction.options.getInteger("tempo");
      try {
        validateDuration(tempoEmMinutos);
      } catch (error) {
        if (!(error instanceof TimerDurationError)) throw error;
        return respond(interaction, {
          content: error.message,
          ephemeral: true,
        });
      }
      const channel = interaction.channel;
      if (!channel || typeof channel.send !== "function") {
        return respond(interaction, {
          content: "Não foi possível enviar o temporizador neste canal.",
          ephemeral: true,
        });
      }

      const embed1 = new EmbedBuilder()
        .setColor("#00e903")
        .setTitle("Temporizador Iniciado")
        .setDescription(
          `Temporizador de <@${interaction.user.id}> definido para **${tempoEmMinutos} minuto(s)**!`,
        )
        .setFooter({
          text: "CodeBucket",
          iconURL: "https://cdn-icons-png.flaticon.com/512/190/190544.png",
        })
        .setTimestamp();

      const embed2 = new EmbedBuilder()
        .setColor("#ff090d")
        .setTitle("Temporizador Finalizado")
        .setDescription(`<@${interaction.user.id}>, trimtrimtrim!`)
        .setFooter({
          text: "CodeBucket",
          iconURL: "https://cdn-icons-png.flaticon.com/512/190/190544.png",
        })
        .setTimestamp();

      timers.set(
        key,
        tempoEmMinutos,
        notifyChannel(channel, {
          content: `<@${interaction.user.id}>`,
          embeds: [embed2],
        }),
      );

      // Delivery may have reached Discord even when reply rejects.
      // Keep the local timer; never roll back a later replacement.
      await respond(interaction, {
        content: `<@${interaction.user.id}>`,
        embeds: [embed1],
      });
    } else if (subcommand === "stop") {
      if (timers.stop(key)) {
        const exampleEmbed = new EmbedBuilder()
          .setColor("#ffff00")
          .setTitle("Temporizador Excluído")
          .setDescription(
            `<@${interaction.user.id}> finalizou seu próprio temporizador.`,
          )
          .setFooter({
            text: "CodeBucket",
            iconURL: "https://cdn-icons-png.flaticon.com/512/190/190544.png",
          })
          .setTimestamp();
        await respond(interaction, { embeds: [exampleEmbed] });
      } else {
        await respond(interaction, {
          content: "Não há temporizador em execução para você.",
          ephemeral: true,
        });
      }
    }
  },
};
