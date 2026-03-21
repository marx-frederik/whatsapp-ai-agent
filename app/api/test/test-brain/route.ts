// src/app/api/ai/route.ts
import OpenAI from "openai";
import { NextResponse } from "next/server";
import { env } from "@/data/env/server";
import { ToolArgsSchema } from "@/features/ai/lib/toolcall.schema";
import { zodResponsesFunction } from "openai/helpers/zod.mjs";
import { ResponseOutputItem } from "openai/resources/responses/responses.mjs";

export const openaiTools = ToolArgsSchema.map((t) =>
  zodResponsesFunction({
    name: t.name,
    description: t.description,
    parameters: t.schema, // <- Zod Args Schema (allowed+required)
  }),
);

function isFunctionCall(
  item: ResponseOutputItem,
): item is Extract<ResponseOutputItem, { type: "function_call" }> {
  return item.type === "function_call";
}


function findToolDef(name: string) {
  return ToolArgsSchema.find((t) => t.name === name);
}

export async function POST(req: Request) {
  const { text } = (await req.json()) as { text: string };

  const resp = await client.responses.create({
    model: "gpt-5",
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
    return NextResponse.json({
      kind: "no_tool_call",
      text: resp.output_text ?? null,
    });
  }

  const toolName: string = call.name;
  console.log(toolName);
  const rawArgs: unknown = call.arguments; // oft JSON-string

  // 2) args normalisieren (string -> object)
  const args =
    typeof rawArgs === "string" ? JSON.parse(rawArgs) : (rawArgs as any);
    console.log(args);
  // 3) optional: gegen Zod validieren (recommended)
  const def = findToolDef(toolName);
  if (!def) {
    return NextResponse.json(
      { kind: "unknown_tool", tool: toolName },
      { status: 400 },
    );
  }

  const parsed = def.schema.safeParse(args);
  if (!parsed.success) {
    return NextResponse.json(
      { kind: "invalid_args", tool: toolName, issues: parsed.error.issues },
      { status: 400 },
    );
  }

  // 4) dein einheitliches Ergebnis
  return NextResponse.json({
    kind: "tool_call",
    tool: toolName,
    args: parsed.data,
  });
}
