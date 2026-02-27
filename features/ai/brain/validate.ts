import { ToolCallMissing, ToolCallUnion } from "../tools/types";
import { safeParseToolArgs } from "./extract";
import { ExtractionResult } from "./types";
import { z } from "zod";

export function validateToolCall(
  extracted: Exclude<ExtractionResult, { type: "text"; text: string }>,
): ToolCallUnion | ToolCallMissing {
  const parsed = safeParseToolArgs(extracted.tool, extracted.args); // gibt success/data oder error

  if (!parsed.success) {
    const missingFields = getMissingFields(parsed.error); // -> string[]
    return {
      type: "tool_call_missing",
      tool: extracted.tool,
      args: extracted.args, // unknown
      missingFields,
    };
  }

  return {
    type: "tool_call",
    tool: extracted.tool,
    args: parsed.data,
  } as ToolCallUnion;
}

export function getMissingFields(err: z.ZodError): string[] {
  const missing = new Set<string>();

  for (const issue of err.issues) {
    // simplest: “invalid_type” at path -> missing candidate
    // (oder später zod4 reportInput: true => issue.input === undefined)
    if (issue.code === "invalid_type") {
      const p = issue.path.join(".");
      if (p) missing.add(p);
    }
  }

  // minimieren: wenn "customer" fehlt, nicht "customer.phone" zusätzlich
  return minimizeMissing([...missing]);
}

function minimizeMissing(paths: string[]): string[] {
  const sorted = [...paths].sort();
  const out: string[] = [];
  for (const p of sorted) {
    if (out.some((prev) => p.startsWith(prev + "."))) continue;
    out.push(p);
  }
  return out;
}
