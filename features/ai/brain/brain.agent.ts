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

  return [
    "Kontext aus der vorherigen Rueckfrage. Nutze ihn nur, wenn die aktuelle Nachricht darauf antwortet.",
    `Offenes Tool: ${pending.toolName}`,
    `Vorherige Rueckfrage: ${pending.message}`,
    optionLines,
    `Aktuelle Nutzerantwort: ${text}`,
  ].join("\n");
}
