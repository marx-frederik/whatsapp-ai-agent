import { runWhatsappAgent } from "./run-whatsapp-agent";
import type { NormalizedMessage } from "@/features/messaging/schemas/normalized-message";
import { getChatSession, setChatSession } from "@/services/redis/session-store";
import { ToolName } from "../tools/types";
import { BrainContext } from "./types";

type BrainAgentResult = {
  finalOutput: string;
  responseId?: string;
  toolNames?: ToolName[];
};

type BrainAgentInput = {
  chatId: string;
  text?: string;
  brainContext?: BrainContext;
  debug?: boolean;
};

export const brainAgent = {
  async process({
    chatId,
    text,
    brainContext,
    debug,
  }: BrainAgentInput): Promise<BrainAgentResult> {
    const session = await getChatSession(chatId);
    const effectiveText = buildPendingAwareText(text?.trim() ?? "", session?.pending);

    const result = await runWhatsappAgent(
      {
        chatId: chatId,
        text: effectiveText,
        previousResponseId: session?.lastResponseId,
        brainContext,
      },
      debug ?? false,
    );

    await setChatSession({
      chatId,
      lastResponseId: result.responseId,
      pending: result.pendingFollowUp
        ? {
            ...result.pendingFollowUp,
            createdAt: new Date().toISOString(),
          }
        : undefined,
      updatedAt: new Date().toISOString(),
    });

    return {
      finalOutput: result.outputText,
      responseId: result.responseId,
      toolNames: result.toolNames,
    };
  },
};

function buildPendingAwareText(
  text: string,
  pending?: {
    toolName: string;
    message: string;
    options: string[];
    createdAt: string;
  },
): string {
  if (!pending) {
    return text;
  }

  const optionLines =
    pending.options.length > 0
      ? `Offene Optionen: ${pending.options.join(" | ")}`
      : "Offene Optionen: keine expliziten Optionen";
  const selectedOption = inferSelectedOption(text, pending.options);

  return [
    "Kontext aus der vorherigen Rueckfrage. Nutze ihn nur, wenn die aktuelle Nachricht darauf antwortet.",
    "Wenn die aktuelle Nutzerantwort eine Auswahl aus den offenen Optionen trifft, fuehre bevorzugt dasselbe Tool erneut aus.",
    `Offenes Tool: ${pending.toolName}`,
    `Vorherige Rueckfrage: ${pending.message}`,
    optionLines,
    ...(selectedOption
      ? [`Erkannte Auswahl aus den offenen Optionen: ${selectedOption}`]
      : []),
    `Aktuelle Nutzerantwort: ${text}`,
  ].join("\n");
}

function inferSelectedOption(text: string, options: string[]): string | null {
  const normalizedText = normalizeSelectionText(text);
  if (!normalizedText || options.length === 0) {
    return null;
  }

  const matchingOptions = options.filter((option) => {
    const normalizedOption = normalizeSelectionText(option);
    if (!normalizedOption) {
      return false;
    }

    if (
      normalizedOption.includes(normalizedText) ||
      normalizedText.includes(normalizedOption)
    ) {
      return true;
    }

    const optionIds = option.match(/[A-Za-z]+-[A-Za-z0-9-]+/g) ?? [];
    return optionIds.some((id) =>
      normalizedText.includes(normalizeSelectionText(id)),
    );
  });

  return matchingOptions.length === 1 ? matchingOptions[0] : null;
}

function normalizeSelectionText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[.,!?]/g, " ")
    .replace(/\s+/g, " ");
}
