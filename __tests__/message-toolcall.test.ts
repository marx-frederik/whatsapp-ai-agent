import { describe, it, expect, vi } from "vitest";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import type { NormalizedMessage } from "@/features/messaging/schemas/normalized-message";
import { brainAgent } from "@/features/ai/brain/brain.agent";

// skipped due to costs that come with every run
describe("brain integration: inbound customer lookup", () => {
  it.skip("processes an inbound message and returns a customer reply", async () => {
    const msg: NormalizedMessage = {
      channel: "twilio",
      kind: "text",
      messageId: `test-${Date.now()}`,
      from: "+49123456789",
      timestamp: Math.floor(Date.now() / 1000),
      text: "Gebe mir Adresse für Kunde Müller",
      contactName: "Test User",
      replyToken: {
        twilioFrom: "whatsapp:+491111111111",
      },
    };

    const result = await brainAgent.process({
      chatId: msg.from,
      text: msg.text,
      brainContext: {
        locale: "de-DE",
        timezone: "Europe/Berlin",
      },
    });

    console.log(result.finalOutput)

    expect(result).toBeDefined();
    expect(result.finalOutput).toBeTypeOf("string");
    expect(result.finalOutput.length).toBeGreaterThan(0);
  }, 20000); // ← 20 Sekunden
});
