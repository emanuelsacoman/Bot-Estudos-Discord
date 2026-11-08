const { SlashCommandBuilder } = require("discord.js");
const { respond } = require("../lib/interactions");
const { embedPayload, validText } = require("../lib/content-limits");
const {
  TODO_LIMITS,
  TodoStoreError,
  createTodoStore,
} = require("../lib/todo-store");

const userToDoLists = createTodoStore();

function taskEmbed(description, color) {
  return embedPayload(
    {
      color,
      title: "TO-DO",
      description,
      footer: {
        text: "CodeBucket",
        icon_url: "https://cdn-icons-png.flaticon.com/512/190/190544.png",
      },
      timestamp: new Date().toISOString(),
    },
    "tarefas.txt",
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("todo")
    .setDescription("Gerencia a lista de tarefas")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("add")
        .setDescription("Adiciona uma tarefa à sua lista")
        .addStringOption((option) =>
          option
            .setName("tarefa")
            .setDescription("Texto da tarefa")
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("list").setDescription("Lista todas as tarefas"),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("remove")
        .setDescription("Remove uma tarefa da lista")
        .addIntegerOption((option) =>
          option
            .setName("numero")
            .setDescription("Número da tarefa a ser removida")
            .setRequired(true),
        ),
    ),

  async execute(interaction) {
    let payload;
    try {
      const context = {
        userId: interaction.user?.id,
        guildId: interaction.guildId,
      };
      // Missing/invalid guild context must never fall back to a user's DM list.
      if (
        typeof interaction.inGuild === "function" &&
        interaction.inGuild() !== (context.guildId !== null)
      ) {
        throw new TodoStoreError("INVALID_CONTEXT");
      }
      const tasks = userToDoLists.list(context);
      const subcommand = interaction.options.getSubcommand();
      if (subcommand === "add") {
        const task = interaction.options.getString("tarefa");
        // Prepare the complete response before changing local state.
        // The store validates even when the command is invoked directly.
        if (!validText(task, TODO_LIMITS.taskLength)) {
          throw new TodoStoreError("INVALID_TASK");
        }
        payload = taskEmbed(
          `Tarefa **${task}** adicionada à sua lista.`,
          0x00e903,
        );
        userToDoLists.add(context, task);
      } else if (subcommand === "list") {
        payload =
          tasks.length === 0
            ? { content: "Sua lista de tarefas está vazia.", ephemeral: true }
            : taskEmbed(
                `Sua Lista de Tarefas:\n${tasks.map((value, i) => `${i + 1}. ${value}\n`).join("")}`,
                0xffff00,
              );
      } else if (subcommand === "remove") {
        const number = interaction.options.getInteger("numero");
        if (
          !Number.isSafeInteger(number) ||
          number < 1 ||
          number > tasks.length
        ) {
          throw new TodoStoreError("INVALID_NUMBER");
        }
        payload = taskEmbed(
          `Tarefa **${tasks[number - 1]}** removida da sua lista.`,
          0xff090d,
        );
        userToDoLists.remove(context, number);
      } else {
        throw new TodoStoreError("INVALID_SUBCOMMAND");
      }
    } catch (error) {
      const messages = {
        INVALID_CONTEXT:
          "Não foi possível identificar o contexto da sua lista de tarefas.",
        INVALID_TASK: `Informe uma tarefa não vazia, com Unicode válido e até ${TODO_LIMITS.taskLength} caracteres.`,
        DUPLICATE: "Essa tarefa já está na sua lista neste contexto.",
        USER_TASKS: `Você atingiu o limite de ${TODO_LIMITS.tasksPerUser} tarefas somadas entre servidores e DM. Remova uma tarefa antes de adicionar outra.`,
        USER_BYTES: `Você atingiu o orçamento de ${TODO_LIMITS.bytesPerUser / 1024} KiB de texto somados entre servidores e DM. Remova tarefas antes de adicionar outra.`,
        CAPACITY:
          "A capacidade de tarefas deste processo foi atingida. Remova tarefas existentes ou tente novamente mais tarde.",
        INVALID_NUMBER:
          "Por favor, especifique um número válido de tarefa para remover.",
        INVALID_SUBCOMMAND:
          "Selecione uma operação válida da lista de tarefas.",
      };
      // Never echo tasks, raw exceptions or context identifiers in an error.
      // This includes preparation failures before the first acknowledgement.
      payload = {
        content:
          (error instanceof TodoStoreError &&
            Object.hasOwn(messages, error.code) &&
            messages[error.code]) ||
          "Não foi possível concluir a operação da lista de tarefas. Tente novamente.",
      };
    }
    // A failed delivery has an ambiguous remote outcome. Preserve the
    // existing local effect and let the interaction helper prevent retries.
    await respond(interaction, { ...payload, ephemeral: true });
  },
};
