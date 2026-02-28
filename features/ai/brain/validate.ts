import { ToolCallMissing, ToolCallUnion } from "../tools/types";
import { safeParseToolArgs } from "./extract";
import { ExtractionResult } from "./types";
import { z } from "zod";

export function validateToolCall(
  extracted: Exclude<ExtractionResult, { type: "text"; text: string }>,
): ToolCallUnion | ToolCallMissing {
  const parsed = safeParseToolArgs(extracted.tool, extracted.args); // gibt success/data oder error

  if (!parsed.success) {
    const missingFields = getMissingFields(parsed.error.issues);
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

export function getMissingFields(issues: z.ZodIssue[]): string[] {
  const paths = issues.map(i => i.path.join(".")).filter(Boolean);
  return minimizeMissing(Array.from(new Set(paths)));
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
