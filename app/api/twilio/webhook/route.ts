import { inngest } from "@/services/inngest/client";
import { TwilioIncomingMessage } from "@/services/inngest/types/events";
import { NextRequest, NextResponse } from "next/server";
import z from "zod";

const TwilioInboundSchema = z
  .object({
    MessageSid: z.string().min(1),
    From: z.string().min(1), // e.g. "whatsapp:+491234..."
    To: z.string().optional(),
    Body: z.string().optional().default(""),
    ProfileName: z.string().optional(),
    NumMedia: z.coerce.number().optional().default(0),
  })
  .passthrough();

type TwilioInbound = z.infer<typeof TwilioInboundSchema>;

function extractTwilioMedia(
  raw: Record<string, unknown>,
  max = 20,
): { url: string; contentType?: string }[] {
  const media: { url: string; contentType?: string }[] = [];
  for (let i = 0; i < max; i++) {
    const url = raw[`MediaUrl${i}`];
    if (typeof url === "string" && url.length > 0) {
      const ct = raw[`MediaContentType${i}`];
      media.push({ url, contentType: typeof ct === "string" ? ct : undefined });
    }
  }
  return media;
}

function nowUnix(): number {
  return Math.floor(Date.now() / 1000);
}

function getString(
  raw: Record<string, unknown>,
  key: string,
): string | undefined {
  const v = raw[key];
  return typeof v === "string" ? v : undefined;
}

export function normalizeTwilioToIncomingMessage(
  t: TwilioInbound,
): TwilioIncomingMessage {
  const raw = t as unknown as Record<string, unknown>;

  const numMedia = t.NumMedia ?? 0;
  const mediaUrl0 = getString(raw, "MediaUrl0");
  const mediaCt0 = getString(raw, "MediaContentType0");

  const isAudio =
    numMedia > 0 && !!mediaUrl0 && (mediaCt0?.startsWith("audio/") ?? false);

  if (isAudio) {
    return {
      channel: "twilio",
      kind: "audio",
      messageId: t.MessageSid,
      from: t.From,
      timestamp: nowUnix(),
      replyToken: { twilioFrom: t.To ?? "" },
      contactName: t.ProfileName,
      audio: {
        mediaUrl: mediaUrl0!,
        mimeType: mediaCt0,
        // Twilio doesn't explicitly mark "voice"; keep undefined unless you infer it
      },
    };
  }

  // default to text
  return {
    channel: "twilio",
    kind: "text",
    messageId: t.MessageSid,
    from: t.From,
    timestamp: nowUnix(),
    replyToken: { twilioFrom: t.To ?? "" },
    contactName: t.ProfileName,
    text: t.Body ?? "",
  };
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") ?? "";

    // ---- Twilio: x-www-form-urlencoded / multipart ----
    if (
      contentType.includes("application/x-www-form-urlencoded") ||
      contentType.includes("multipart/form-data")
    ) {
      console.log("Hello World");
      const form = await req.formData();

      // Convert FormData -> plain object (string | File)
      const rawObj: Record<string, unknown> = {};
      for (const [k, v] of form.entries()) rawObj[k] = v;

      // Twilio fields come as strings; schema coerces NumMedia
      const parsed = TwilioInboundSchema.safeParse(rawObj);
      if (!parsed.success) {
        // Twilio expects 2xx ideally, but for invalid payloads return 400
        return NextResponse.json(
          { ok: false, provider: "twilio", error: parsed.error.flatten() },
          { status: 400 },
        );
      }

      const normalized: TwilioIncomingMessage =
        normalizeTwilioToIncomingMessage(parsed.data);

      console.log(normalized);
      await inngest.send({
        name: "twilio/message.incoming",
        data: normalized,
      });

      // For Twilio: returning TwiML is optional. JSON 200 is usually fine for inbound webhooks.
      return NextResponse.json(
        { ok: true, provider: "twilio" },
        { status: 200 },
      );
    }
  } catch (err) {
    // Keep response 200 if you prefer “never retry” semantics; 500 triggers retries in some systems.
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
