import { openAiClient } from "@/services/ai/openai";
import {
  CommandJsonSchema,
  DraftCommand,
  DraftCommandSchema,
} from "@/features/ai/lib/command.schema";
import { BrainContext } from "../lib/brain.contract";

export async function extractCommandFromText(
  text: string,
  ctx?: BrainContext
): Promise<DraftCommand> {
  const response = await openAiClient.responses.create({
    model: "gpt-4o-mini",
    input: [
      {
        role: "system",
        content:
          "Extract the most likely command from the user message. " +
          "Return only JSON that matches the provided schema. " +
          "Use missingFields for required info not present. " +
          "If unsure, set lower confidence but still choose the best command.",
      },
      { role: "user", content: text },
    ],
    text: {
      format: {
        type: "json_schema",
        name: CommandJsonSchema.name,
        strict: CommandJsonSchema.strict,
        schema: CommandJsonSchema.schema,
      },
    },
  });
  console.log(
    "=============================Response============================================"
  );
  console.log(response);
  console.log(
    "=============================Response=End========================================"
  );

  const outputText = response.output_text; //?? extractOutputText(response);
  console.log("JSON PARSE");
  console.log(JSON.parse(outputText));
  const parsed = DraftCommandSchema.safeParse(JSON.parse(outputText));
  if (!parsed.success) {
    throw new Error("OpenAI response did not match CommandSchema");
  }
  return parsed.data;
}

function parseResponseToDraftCommand() {}
