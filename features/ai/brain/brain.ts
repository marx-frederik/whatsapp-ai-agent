import { extractToolFromText } from "./extract";
import { checkPolicies } from "./policies";
import { BrainContext, ExtractionResult } from "./types";

export async function process(text: string, ctx: BrainContext) {
  
    // 1) Extract Tool
  const extracted: ExtractionResult = await extractToolFromText(text, ctx);
  if (extracted.type === "text") {
    return { replyText: extracted.text };
  }

  // 2) Policies (aktuell stub, später Sicherheits-/Business-Regeln)
  const policy = checkPolicies(extracted, ctx);

  // 3) Tool ausführen
  // const execute = await executeTool(extracted, ctx)

  // 4) Render Reply
  // const replyText = renderReply(execute, ctx)
}
