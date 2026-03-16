import { tool } from "@openai/agents";
import { ToolDef, ToolName, ToolRegistry } from "./types";
import { BrainContext } from "../brain/types";

export const toolByName = new Map(
  ToolRegistry.map((entry) => [entry.name, entry]),
);

export type ExecutedToolCall = {
  toolName: ToolName;
  args: unknown;
  result: unknown;
};

export function createAgentTools(
  ctx: BrainContext = {},
  executedTools: ExecutedToolCall[] = [],
) {
  return ToolRegistry.map((entry) => toAgentTool(entry, ctx, executedTools));
}

function toAgentTool<TEntry extends ToolDef>(
  entry: TEntry,
  ctx: BrainContext,
  executedTools: ExecutedToolCall[],
) {
  return tool({
    name: entry.name,
    description: entry.description,
    parameters: entry.schema,
    strict: true,
    async execute(args) {
      // Runtime input crosses an SDK boundary, so we keep it unknown until each tool validates/parses it.
      const executeEntry = entry.execute as (
        input: unknown,
        context: BrainContext,
      ) => Promise<unknown> | unknown;
      const result = await executeEntry(args, ctx);

      executedTools.push({
        toolName: entry.name,
        args,
        result,
      });

      return result;
    },
  });
}
