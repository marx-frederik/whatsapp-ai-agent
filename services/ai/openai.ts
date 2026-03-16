import OpenAI from "openai";
import { env } from "@/data/env/server";

export const openAiClient = new OpenAI({ apiKey: env.OPENAI_API_KEY });