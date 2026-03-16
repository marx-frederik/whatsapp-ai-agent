import { AgentInputItem, Runner, withTrace } from "@openai/agents";
import { createWhatsAppAgent } from "@/features/ai/agents/whatsapp-agent";
import { createAgentTools, ExecutedToolCall } from "../tools/agent-tool-bridge";
import { BrainContext } from "./types";

export type RunWhatsappAgentInput = {
  text: string;
  history?: AgentInputItem[];
  brainContext?:BrainContext;
};

export type RunWhatsappAgentResult = {
  finalOutput: unknown;

  raw: unknown;
  executedTools: ExecutedToolCall[];
};

export async function runWhatsappAgent(
    input: RunWhatsappAgentInput,
  ): Promise<RunWhatsappAgentResult> {
    return withTrace("whatsapp-agent-run", async () => {
      const executedTools: ExecutedToolCall[] = [];
  
      // Build tools per run so context and tool execution tracking are scoped to this request.
      const tools = createAgentTools(input.brainContext ?? {}, executedTools);
      const agent = createWhatsAppAgent(tools);
  
      const runner = new Runner();
  
      const conversationHistory: AgentInputItem[] = [
        ...(input.history ?? []),
        {
          role: "user",
          content: [{ type: "input_text", text: input.text }],
        },
      ];
  
      const result = await runner.run(agent, conversationHistory);
  
      return {
        finalOutput: result.finalOutput,
        raw: result,
        executedTools,
      };
    });
  }
