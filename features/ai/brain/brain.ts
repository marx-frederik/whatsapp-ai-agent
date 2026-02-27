import { ToolName } from "../tools/types";
import { executeTool } from "./execute";
import { extractToolFromText } from "./extract";
import { renderToolReply } from "./render";
import { BrainOutput, PendingToolCall } from "./types";
import { validateToolCall } from "./validate";

export async function process(input: {
  userId: string;
  text: string;
  pending?: PendingToolCall;
  locale: string;
  timezone: string;
}): Promise<BrainOutput> {
  // 0) Extract
  const extracted = await extractToolFromText(input.text, {
    // später: wenn pending existiert, allowedTools: [input.pending.tool]
  });

  if (extracted.type === "text") {
    return { kind: "reply", text: extracted.text };
  }

  // 1) Wenn pending existiert: merge pending.partialArgs + extracted.args (unknown + unknown)
  const mergedRawArgs = input.pending
    ? deepMergeReplaceArrays(input.pending.partialArgs, extracted.args)
    : extracted.args;

  // 2) Validate
  const validated = validateToolCall({
    type: "tool_call",
    tool: input.pending ? input.pending.tool : extracted.tool, // tool fixieren wenn pending
    args: mergedRawArgs,
  });

  // 3) Decision: clarify
  if (validated.type === "tool_call_missing") {
    const text = buildClarifyText(
      validated.tool,
      validated.missingFields,
      input.locale,
    );

    return {
      kind: "clarify",
      text,
      pending: {
        tool: validated.tool,
        partialArgs: validated.args, // unknown (mergedRawArgs)
        missingFields: validated.missingFields,
        createdAt: Date.now(),
      },
    };
  }

  // 4) Execute
  try {
    const execResult = await executeTool(validated); // siehe unten
    const replyText = renderToolReply(validated, execResult);

    return { kind: "reply", text: replyText };
  } catch (e) {
    return { kind: "error", text: "Da ist etwas schiefgelaufen.", debug: e };
  }
}

function deepMergeReplaceArrays(a: any, b: any): any {
  if (Array.isArray(a) || Array.isArray(b)) return b ?? a;

  if (isPlainObject(a) && isPlainObject(b)) {
    const out: any = { ...a };

    for (const k of Object.keys(b)) {
      out[k] = deepMergeReplaceArrays(a?.[k], b[k]);
    }

    return out;
  }

  return b ?? a;
}

function isPlainObject(x: any) {
  return x !== null && typeof x === "object" && !Array.isArray(x);
}

export function buildClarifyText(
  tool: ToolName,
  missing: string[],
  locale: string,
): string {
  if (!missing.length)
    return "Mir fehlt noch eine Angabe – kannst du das kurz ergänzen?";
  return `Mir fehlt noch: ${missing.join(", ")}. Kannst du das kurz ergänzen?`;
}
