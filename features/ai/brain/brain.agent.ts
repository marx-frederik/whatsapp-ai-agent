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

    const result = await runWhatsappAgent(
      {
        chatId: chatId,
        text: text?.trim() ?? "",
        previousResponseId: session?.lastResponseId,
        brainContext,
      },
      debug ?? false,
    );

    await setChatSession({
      chatId,
      lastResponseId: result.responseId,
      updatedAt: new Date().toISOString(),
    });

    return {
      finalOutput: result.outputText,
      responseId: result.responseId,
      toolNames: result.toolNames,
    };
  },
};
