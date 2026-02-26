import { ToolRegistry } from "../tools/types";
import { ToolCallUnion } from "./extract";
import { BrainContext } from "./types";

export function executeTool(toolCall: Omit<ToolCallUnion, "type">, ctx:BrainContext) {
    const def = ToolRegistry.find(t => toolCall.tool === t.name)
    if (!def){
        throw new Error(`Unknown tool: ${toolCall.tool}`);
    }
    return def.execute(toolCall.args as any, ctx)
}
