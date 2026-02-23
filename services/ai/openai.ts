import OpenAI from "openai";
import { env } from "@/data/env/server";
import {
  Command,
  CommandJsonSchema,
  CommandSchema,
} from "@/features/messaging/commands/schema";

export const openAiClient = new OpenAI({ apiKey: env.OPEN_AI_API_KEY });