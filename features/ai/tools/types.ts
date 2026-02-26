// tools/types.ts
import { z } from "zod";

export type ToolDef = (typeof ToolRegistry)[number];

// "order_create" | "customer_lookup" | ...
export type ToolName = ToolDef["name"];

// Args-Typ passend zum ToolName
export type ArgsOf<N extends ToolName> = z.infer<
  Extract<ToolDef, { name: N }>["schema"]
>;

// ToolCallUnion: gekoppelte Union (tool -> args)
export type ToolCallUnion = {
  [N in ToolName]: { type: "tool_call"; tool: N; args: ArgsOf<N> };
}[ToolName];

import { customerLookupTool } from "./defs/customer_lookup";
import { orderCreateTool } from "./defs/order_create";

export const ToolRegistry = [orderCreateTool, customerLookupTool] as const;