import { inngest } from "./client";
import { TwilioIncomingMessageSchema } from "./types/events";

export const twilioMessageReceived = inngest.createFunction(
  { id: "twilio-message-received" },
  { event: "twilio/message.incoming" },
  async ({ event, step }) => {
    const payload = TwilioIncomingMessageSchema.parse(event.data);
    console.log("twilio.message.incoming", {
      messageId: payload.messageId,
      kind: payload.kind,
      from: payload.from,
      timestamp: payload.timestamp,
      hasText: Boolean(payload.text),
      hasAudio: Boolean(payload.audio),
    });

    await step.sleep("wait-a-moment", "1s");

    return { message: `Nachricht: ${payload.text ?? "keine Nachricht"}` };
  },
);
