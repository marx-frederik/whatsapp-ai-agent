import { process } from "@/features/ai/brain/brain";
import { NormalizedMessage } from "@/features/messaging/schemas/normalized-message";
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
  // Twilio sends x-www-form-urlencoded by default
  const formData = await req.formData();
  const form: Record<string, string> = {};
  for (const [k, v] of formData.entries()) form[k] = String(v);

  const normalized = normalizeTwilioIncoming(form);

  if (normalized.kind !== "text" || !normalized.text) {
    return new NextResponse(toTwiML("Ich konnte die Nachricht nicht lesen."), {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  }
  console.log(normalized);
  const out = await process({
    userId: normalized.from,
    text: normalized.text,
    locale: "de-DE",
    timezone: "Europe/Berlin",
  });

  const replyText =
    out.kind === "reply"
      ? out.text
      : out.kind === "clarify"
        ? out.text
        : out.kind === "error"
          ? out.text
          : (out.text ?? "Wie kann ich helfen?");

  return new NextResponse(toTwiML(replyText), {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
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
