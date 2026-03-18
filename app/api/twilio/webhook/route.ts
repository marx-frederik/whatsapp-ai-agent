import { env } from "@/data/env/server";
import { brainAgent } from "@/features/ai/brain/brain.agent";
import { logConversationTrace } from "@/features/ai/logging/conversation-trace";
import { NormalizedMessage } from "@/features/messaging/schemas/normalized-message";
import { sendWhatsappMessage } from "@/services/twilio/send-message";
import { NextResponse } from "next/server";

function toTwiML(message: string) {
  const escaped = message
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${escaped}</Message>
</Response>`;
}

export async function POST(req: Request) {
  try {
    // Twilio sends x-www-form-urlencoded by default
    const formData = await req.formData();

    const form: Record<string, string> = {};
    for (const [k, v] of formData.entries()) form[k] = String(v);

    const normalizedMsg = normalizeTwilioIncoming(form);
    console.log("Normalized message:", normalizedMsg);

    if (normalizedMsg.kind !== "text" || !normalizedMsg.text) {
      return new NextResponse(
        toTwiML("Ich konnte die Nachricht nicht lesen."),
        {
          status: 200,
          headers: { "Content-Type": "text/xml" },
        },
      );
    }
    const brainContext = {
      locale: "de-DE",
      timezone: "Europe/Berlin",
    };

    const result = await brainAgent.process({
      chatId: normalizedMsg.from,
      text: normalizedMsg.text,
      brainContext,
    });

    await sendWhatsappMessage({
      from: env.TWILIO_WHATSAPP_FROM,
      to: normalizedMsg.from,
      body: result.finalOutput,
    });

    logConversationTrace({
      messageId: normalizedMsg.messageId,
      from: normalizedMsg.from,
      incomingText: normalizedMsg.text,
      outputText: result.finalOutput,
      toolNames: result.toolNames,
      finalOutput: result.finalOutput,
      timestamp: new Date().toISOString(),
    });

    return new NextResponse(null, { status: 200 });
  } catch (err) {
    console.error("Twilio webhook error", err);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export function normalizeTwilioIncoming(
  form: Record<string, string | undefined>,
): NormalizedMessage {
  const from = form.From ?? "";
  const body = form.Body ?? "";
  const sid = form.MessageSid ?? `twilio-${Date.now()}`;

  return {
    channel: "twilio",
    kind: "text",
    messageId: sid,
    from,
    timestamp: Math.floor(Date.now() / 1000),
    text: body,
    replyToken: { twilioFrom: from },
  };
}
