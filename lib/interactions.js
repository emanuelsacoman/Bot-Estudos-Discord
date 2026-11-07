const { MessageFlags, MessageFlagsBitField } = require("discord.js");

const states = new WeakMap();
const TERMINAL_CODES = new Set([
  10062, // Unknown interaction
  10015, // Unknown webhook
  50027, // Invalid webhook token
  40060, // Already acknowledged: the local state may be stale.
  "InteractionAlreadyReplied",
  "InteractionNotReplied",
]);

class InteractionResponseError extends Error {
  constructor() {
    super("Não foi possível responder à interação.");
    this.name = "InteractionResponseError";
  }
}

function stateFor(interaction) {
  if (!states.has(interaction)) {
    states.set(interaction, {
      busy: false,
      failed: false,
      errorReported: false,
    });
  }
  return states.get(interaction);
}

function isTerminal(error) {
  const code = error?.code ?? error?.rawError?.code;
  return TERMINAL_CODES.has(code) || TERMINAL_CODES.has(Number(code));
}

function isExpired(interaction) {
  if (!Number.isFinite(interaction.createdTimestamp)) return false;
  const age = Date.now() - interaction.createdTimestamp;
  const lifetime =
    interaction.deferred || interaction.replied ? 15 * 60 * 1000 : 3000;
  return age >= lifetime;
}

function send(interaction, method, ...args) {
  // Recheck between REST calls too: a pending send can outlive the token.
  if (isExpired(interaction)) throw new InteractionResponseError();
  return interaction[method](...args);
}

function payloadOptions(payload) {
  const options =
    typeof payload === "string" ? { content: payload } : { ...payload };
  const flags = new MessageFlagsBitField(options.flags);
  if (options.ephemeral !== undefined) {
    if (options.ephemeral) flags.add(MessageFlags.Ephemeral);
    else flags.remove(MessageFlags.Ephemeral);
    delete options.ephemeral;
    options.flags = flags.bitfield;
  }
  return { options, ephemeral: flags.has(MessageFlags.Ephemeral) };
}

function editOptions(options) {
  const edited = { ...options };
  // Ephemeral is fixed by the initial acknowledgement, never by an edit.
  delete edited.fetchReply;
  if (edited.flags !== undefined) {
    const flags = new MessageFlagsBitField(edited.flags).remove(
      MessageFlags.Ephemeral,
    );
    if (flags.bitfield) edited.flags = flags.bitfield;
    else delete edited.flags;
  }
  return edited;
}

async function deliver(interaction, operation) {
  const state = stateFor(interaction);
  if (state.failed || state.busy) throw new InteractionResponseError();
  if (isExpired(interaction)) {
    state.failed = true;
    throw new InteractionResponseError();
  }
  state.busy = true;
  try {
    return await operation(state);
  } catch {
    // A failed REST call may already have reached Discord. Do not retry it or
    // retain its raw error (which can contain the webhook URL/token and body).
    state.failed = true;
    throw new InteractionResponseError();
  } finally {
    state.busy = false;
  }
}

async function deferResponse(interaction, options = {}) {
  return deliver(interaction, async () => {
    if (interaction.deferred || interaction.replied) return;
    const { options: normalized } = payloadOptions(options);
    await send(interaction, "deferReply", normalized);
  });
}

async function respond(interaction, payload) {
  return deliver(interaction, async (state) => {
    const { options, ephemeral } = payloadOptions(payload);
    let message;
    if (interaction.replied) {
      message = await send(interaction, "followUp", options);
    } else if (interaction.deferred) {
      if (ephemeral === Boolean(interaction.ephemeral)) {
        message = await send(interaction, "editReply", editOptions(options));
      } else {
        // Discord's FIRST follow-up after defer can act as an edit, ignoring
        // its ephemeral flag. Complete the loading response with neutral,
        // empty-visible content before sending the result at its own visibility.
        // No private error/data is ever placed in that original response.
        await send(interaction, "editReply", { content: "\u200b" });
        message = await send(interaction, "followUp", options);
        state.lastEphemeral = ephemeral;
        await send(interaction, "deleteReply");
      }
    } else {
      message = await send(interaction, "reply", options);
    }
    state.lastEphemeral = ephemeral;
    return message;
  });
}

async function editResponse(interaction, payload) {
  return deliver(interaction, async () => {
    const { options } = payloadOptions(payload);
    return send(interaction, "editReply", editOptions(options));
  });
}

async function handleInteractionError(interaction, error) {
  const state = stateFor(interaction);
  // Includes terminal errors thrown by command logic rather than our sends.
  if (isTerminal(error)) state.failed = true;
  if (state.errorReported) return false;
  state.errorReported = true;
  console.error("Erro ao executar interação.");
  if (
    state.failed ||
    state.busy ||
    isExpired(interaction) ||
    error instanceof InteractionResponseError
  ) {
    return false;
  }
  try {
    await respond(interaction, {
      content: "Houve um erro ao executar esse comando!",
      flags:
        (state.lastEphemeral ?? interaction.ephemeral)
          ? MessageFlags.Ephemeral
          : 0,
    });
    return true;
  } catch {
    console.error("Falha ao enviar a mensagem de erro da interação.");
    return false;
  }
}

async function runWithErrorHandling(interaction, operation) {
  try {
    return await operation();
  } catch (error) {
    await handleInteractionError(interaction, error);
  }
}

async function runSecondary(operation) {
  try {
    await operation();
    return true;
  } catch {
    console.warn("Falha em operação secundária da interação.");
    return false;
  }
}

module.exports = {
  deferResponse,
  respond,
  editResponse,
  handleInteractionError,
  runWithErrorHandling,
  runSecondary,
  InteractionResponseError,
};
