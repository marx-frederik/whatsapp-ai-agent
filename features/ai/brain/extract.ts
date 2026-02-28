import { ResponseOutputItem } from "openai/resources/responses/responses.mjs";
import { openAiClient } from "@/services/ai/openai";
import { BrainContext, ExtractionResult } from "./types";
import { ToolName } from "../tools/types";
import { ToolRegistry } from "../tools/types";
import { openaiTools } from "../tools/openai";
import { z } from "zod";

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

export type SafeParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: z.ZodError };

export function safeParseToolArgs<N extends ToolName>(
  toolName: N,
  rawArgs: unknown,
): SafeParseResult<ArgsOf<N>> {
  const toolEntry = ToolRegistry.find(
    (t): t is Extract<ToolEntry, { name: N }> => t.name === toolName,
  );
  if (!toolEntry) throw new Error(`Unknown tool: ${toolName}`);

  return toolEntry.schema.safeParse(rawArgs) as SafeParseResult<ArgsOf<N>>;
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
                Erfinde auf gar keinen Fall Felder, fülle die erforderlichen Felder nur aus, 
                wenn die Informationen im Text vorhanden sind, ansonsten lasse sie leer.
                Wenn der Nutzer bestellen will → immer order_create callen. Unklare Werte (z.B. “viele”) → als "" oder null setzen. 
                Keine “normalen” Antworten, solange Tool passt.
                `,
      },
      { role: "user", content: text },
    ],
    tools: openaiTools,
    tool_choice: "auto",
    parallel_tool_calls: false, // empfehlenswert am Anfang: genau 1 Toolcall
  });

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

  const rawArgs =
    typeof call.arguments === "string"
      ? JSON.parse(call.arguments)
      : call.arguments;

  return { type: "tool_call", tool: call.name, args: rawArgs };
}
