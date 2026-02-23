import OpenAI from "openai";
import { env } from "@/data/env/server";

export const openAiClient = new OpenAI({ apiKey: env.OPEN_AI_API_KEY });