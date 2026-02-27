import { ToolCallUnion, ToolRegistry } from "../tools/types";
import { BrainContext } from "./types";

export async function executeTool(call: ToolCallUnion, ctx?:BrainContext): Promise<unknown> {
    const entry = ToolRegistry.find((t) => t.name === call.tool);
    if (!entry) throw new Error(`Unknown tool: ${call.tool}`);
  
    // entry.execute erwartet (idealerweise) ArgsOf<typeof call.tool>
     return entry.execute(call.args as any,ctx);
  }
  
  