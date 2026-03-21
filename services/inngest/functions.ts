
import { inngest } from "./client";
import { TwilioIncomingMessageSchema } from "./types/events";

export const twilioMessageReceived = inngest.createFunction(
  { id: "twilio-message-received" },
  { event: "twilio/message.incoming" },
  async ({ event, step }) => {
    const payload = TwilioIncomingMessageSchema.parse(event.data);

    // Legacy brain pipeline is disabled; Twilio webhook uses the agent runtime directly.
    await step.run("legacy-brain-disabled", async () => null);

    await step.sleep("wait-a-moment", "1s");

    return { message: `Nachricht: ${payload.text ?? "keine Nachricht"}` };
  },
)