// src/scripts/test-agent.ts
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import type { NormalizedMessage } from "@/features/messaging/schemas/normalized-message";
import { env } from "process";

async function run(text: string) {
  const { brainAgent } = await import("@/features/ai/brain/brain.agent");

  const msg: NormalizedMessage = {
    channel: "twilio",
    kind: "text",
    messageId: `test-${Date.now()}`,
    from: "+49123456789",
    timestamp: Math.floor(Date.now() / 1000),
    text,
    contactName: "Test User",
    replyToken: { twilioFrom: "1234" },
  };

  const result = await brainAgent.process({
    chatId: msg.from,
    text: msg.text ?? "",
    debug: true,
  });

  console.log("\n====================");
  console.log("INPUT:", text);
  console.log("--------------------");
  console.dir(result.finalOutput, { depth: null });
}

async function main() {
  console.log("OPENAI KEY LOADED:", !!env.OPENAI_API_KEY);

  await run("Suche Kunde 123");
  await run("Bitte 2x Cola für Kunde 123");
  await run("Wie ist der Status von ORD-1001?");
  await run("Bitte Cola bestellen");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
