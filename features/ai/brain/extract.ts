import { ResponseOutputItem } from "openai/resources/responses/responses.mjs";
import { openAiClient } from "@/services/ai/openai";
import { z } from "zod";
import { SafeParseReturnType } from "zod/v3";
import { BrainContext, ExtractionResult } from "./types";
import { ToolName } from "../tools/types";
import { ToolRegistry } from "../tools/types";
import { openaiTools } from "../tools/openai";

export type ToolCallUnion = {
  [N in ToolName]: { type: "tool_call"; tool: N; args: ArgsOf<N> };
}[ToolName];

type ToolEntry = (typeof ToolRegistry)[number];

type ArgsOf<N extends ToolName> = z.infer<
  Extract<ToolEntry, { name: N }>["schema"]
>;

export function isToolName(t: string): t is ToolName {
  return ToolRegistry.some((a) => a.name === t);
}

function isFunctionCall(
  item: ResponseOutputItem,
): item is Extract<ResponseOutputItem, { type: "function_call" }> {
  return item.type === "function_call";
}

export function getToolSchema<N extends ToolName>(name: N) {
  const entry = ToolRegistry.find(
    (s): s is Extract<ToolEntry, { name: N }> => s.name === name,
  );
  if (!entry) {
    throw new Error(`Unknown tool ${name}`);
  }

  return entry.schema;
}

export function safeParseToolArgs<N extends ToolName>(
  toolName: N,
  rawArgs: unknown,
): SafeParseReturnType<unknown, ArgsOf<N>> {
  const toolArgs = ToolRegistry.find(
    (t): t is Extract<ToolEntry, { name: N }> => t.name === toolName,
  );
  if (!toolArgs) throw new Error(`Unknown tool: ${toolName}`);
  const result = toolArgs.schema.safeParse(rawArgs);
  return result as SafeParseReturnType<unknown, ArgsOf<N>>;
}

export async function extractToolFromText(
  text: string,
  ctx?: BrainContext,
): Promise<ExtractionResult> {
  const resp = await openAiClient.responses.create({
    model: "gpt-4o-mini",
    input: [
      {
        role: "system",
        content: `Du musst GENAU EINES der Tools aufrufen oder gar keines.
                Wenn kein Tool passt, wähle keins aus. 
                `,
      },
      { role: "user", content: text },
    ],
    tools: openaiTools,
    tool_choice: "auto",
    parallel_tool_calls: false, // empfehlenswert am Anfang: genau 1 Toolcall
  });

  console.log(resp);
  // 1) Toolcall finden (Responses: output items, function_call) :contentReference[oaicite:2]{index=2}
  const call = resp.output.find((item) => isFunctionCall(item));

  if (!call) {
    return {
      type: "text",
      text: resp.output_text ?? "Okay.",
    };
  }

  if (!isToolName(call.name)) {
    return { type: "text", text: "Unknown tool." };
  }

  const raw =
    typeof call.arguments === "string"
      ? JSON.parse(call.arguments)
      : call.arguments;

  switch (call.name) {
    case "order_create": {
      const parsed = safeParseToolArgs("order_create", raw);
      if (!parsed.success) return { type: "text", text: "Invalid args." };
      return { type: "tool_call", tool: "order_create", args: parsed.data };
    }

    case "customer_lookup": {
      const parsed = safeParseToolArgs("customer_lookup", raw);
      if (!parsed.success) return { type: "text", text: "Invalid args." };
      return { type: "tool_call", tool: "customer_lookup", args: parsed.data };
    }
  }
}
