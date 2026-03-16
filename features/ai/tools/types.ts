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

export type ToolCallMissing<T extends ToolCallUnion = ToolCallUnion> =
  T extends {
    type: "tool_call";
    tool: infer Tool;
  }
    ? {
        type: "tool_call_missing";
        tool: Tool;
        args: unknown; // kept unknown at boundary; validate before usage
        missingFields: string[]; // oder Path[] typisieren, später
      }
    : never;

import { customerLookupTool } from "./defs/customer_lookup";
import { orderCreateTool } from "./defs/order_create";

export const ToolRegistry = [orderCreateTool, customerLookupTool] as const;
