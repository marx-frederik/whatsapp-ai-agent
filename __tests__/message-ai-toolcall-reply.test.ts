import { describe, it, expect, vi } from "vitest";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import type { NormalizedMessage } from "@/features/messaging/schemas/normalized-message";
import { brainAgent } from "@/features/ai/brain/brain.agent";

// !! Remove .skip only carefully as every run produces costs
describe("brain integration: inbound user message, ai processing with tool call and user reply", () => {
  it.skip("processes an inbound message, executes customer lookup and returns a customer reply", async () => {
    const msg: NormalizedMessage = {
      channel: "twilio",
      kind: "text",
      messageId: `test-${Date.now()}`,
      from: `+4912345${Math.floor(Math.random() * 1000)}`,
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
      debug:true,
    });

    console.log(result.finalOutput);

    expect(result).toBeDefined();
    expect(result.finalOutput).toBeTypeOf("string");
    expect(result.finalOutput.length).toBeGreaterThan(0);
  }, 20000); // ← 20 Sekunden

  it.skip("processes an inbound message, executes order_create and returns a customer reply", async () => {
    const msg: NormalizedMessage = {
      channel: "twilio",
      kind: "text",
      messageId: `test-${Date.now()}`,
      from: `+4912345${Math.floor(Math.random() * 1000)}`,
      timestamp: Math.floor(Date.now() / 1000),
      text: "Lege eine Bestellung über 2000 Steine für Kunde Müller an.",
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
      debug:true,
    });

    console.log("Final Result:", result.finalOutput);

    expect(result).toBeDefined();
    expect(result.finalOutput).toBeTypeOf("string");
    expect(result.finalOutput.length).toBeGreaterThan(0);
  }, 20000); // ← 20 Sekunden
});;
