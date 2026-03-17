import { Runner, withTrace } from "@openai/agents";
import { createWhatsAppAgent } from "@/features/ai/agents/whatsapp-agent";
import { createAgentTools } from "../tools/agent-tool-bridge";
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
};

export async function runWhatsappAgent(
  input: RunWhatsappAgentInput,
): Promise<RunWhatsappAgentResult> {
  return withTrace("whatsapp-agent-run", async () => {
    // Build tools per run so context and tool execution tracking are scoped to this request.
    const tools = createAgentTools(input.brainContext ?? {});
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

    return {
      outputText:
        typeof result.finalOutput === "string"
          ? result.finalOutput
          : JSON.stringify(result.finalOutput),
      responseId: result.lastResponseId,
      raw: result,
      toolNames: toolNames,
    };
  });
}

function isToolName(rawToolName: unknown): rawToolName is ToolName {
  return ToolRegistry.some((tool) => tool.name === rawToolName);
}
