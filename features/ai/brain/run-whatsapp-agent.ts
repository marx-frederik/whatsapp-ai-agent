import { Runner, withTrace } from "@openai/agents";
import { createWhatsAppAgent } from "@/features/ai/agents/whatsapp-agent";
import { createAgentTools, ExecutedToolCall } from "../tools/agent-tool-bridge";
import { BrainContext } from "./types";
import { ToolName, ToolRegistry } from "../tools/types";

export type RunWhatsappAgentInput = {
  chatId: string;
  text: string;
  previousResponseId?: string;
  brainContext?: BrainContext;
};

export type RunWhatsappAgentResult = {
  outputText: string;
  responseId?: string;
  raw: unknown;
  toolNames: ToolName[];
  pendingFollowUp: {
    toolName: ToolName;
    message: string;
    options: string[];
  } | null;
};

export async function runWhatsappAgent(
  input: RunWhatsappAgentInput,
  debug: boolean,
): Promise<RunWhatsappAgentResult> {
  return withTrace("whatsapp-agent-run", async () => {
    // Build tools per run so context and tool execution tracking are scoped to this request.
    const executedTools: ExecutedToolCall[] = [];
    const tools = createAgentTools(input.brainContext ?? {}, executedTools);
    const agent = createWhatsAppAgent(tools);

    const runner = new Runner();

    const result = await runner.run(
      agent,
      [{ role: "user", content: [{ type: "input_text", text: input.text }] }],
      { previousResponseId: input.previousResponseId },
    );

    const toolNames: ToolName[] =
      result.newItems
        ?.filter((item) => item.type === "tool_call_item")
        .flatMap((item) => {
          const toolName: unknown = item.rawItem.name;
          if (typeof toolName !== "string" || !isToolName(toolName)) {
            throw new Error(`Unknown tool: ${toolName}`);
          }
          return toolName;
        }) ?? [];

    if (debug) {
      const toolCalls =
        result.newItems
          ?.filter((item) => item.type === "tool_call_item")
          .map((item) => ({
            name: item.rawItem.name,
            arguments: item.rawItem.arguments ?? null,
          })) ?? [];

      console.log("Agent Tool Calls:", JSON.stringify(toolCalls, null, 2));
      console.log(
        "Agent Final Output:",
        typeof result.finalOutput === "string"
          ? result.finalOutput
          : JSON.stringify(result.finalOutput),
      );
    }

    return {
      outputText:
        typeof result.finalOutput === "string"
          ? result.finalOutput
          : JSON.stringify(result.finalOutput),
      responseId: result.lastResponseId,
      raw: result,
      toolNames: toolNames,
      pendingFollowUp: extractPendingFollowUp(executedTools),
    };
  });
}

function isToolName(rawToolName: unknown): rawToolName is ToolName {
  return ToolRegistry.some((tool) => tool.name === rawToolName);
}

function extractPendingFollowUp(
  executedTools: ExecutedToolCall[],
): {
  toolName: ToolName;
  message: string;
  options: string[];
} | null {
  for (let index = executedTools.length - 1; index >= 0; index -= 1) {
    const executedTool = executedTools[index];
    if (isFollowUpResult(executedTool.result)) {
      return {
        toolName: executedTool.toolName,
        message: executedTool.result.message,
        options: executedTool.result.options ?? [],
      };
    }
  }

  return null;
}

function isFollowUpResult(
  value: unknown,
): value is {
  ok: false;
  code: "FOLLOW_UP_REQUIRED";
  message: string;
  options?: string[];
} {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as {
    ok?: unknown;
    code?: unknown;
    message?: unknown;
    options?: unknown;
  };

  return (
    candidate.ok === false &&
    candidate.code === "FOLLOW_UP_REQUIRED" &&
    typeof candidate.message === "string" &&
    (candidate.options === undefined ||
      (Array.isArray(candidate.options) &&
        candidate.options.every((option) => typeof option === "string")))
  );
}
