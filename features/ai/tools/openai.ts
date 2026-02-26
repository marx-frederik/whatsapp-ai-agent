// tools/openai.ts
import { zodResponsesFunction } from "openai/helpers/zod";
import { ToolRegistry } from "./types";

export const openaiTools = ToolRegistry.map((t) =>
  zodResponsesFunction({
    name: t.name,
    description: t.description,
    parameters: t.schema, // Zod schema direkt
  }),
);