import { extractCommandFromText } from "@/features/ai/services/extract-command";
import { inngest } from "./client";
import { TwilioIncomingMessageSchema } from "./types/events";

export const twilioMessageReceived = inngest.createFunction(
  { id: "twilio-message-received" },
  { event: "twilio/message.incoming" },
  async ({ event, step }) => {
    const payload = TwilioIncomingMessageSchema.parse(event.data);

    //extraction for text command
    if (payload.kind === "text" && payload.text) {
      const command = await step.run("ai-extract-command", async () => {
        await extractCommandFromText(payload.text ?? "");
      });
      console.log("ai.command", command);
    }

    await step.sleep("wait-a-moment", "1s");

    return { message: `Nachricht: ${payload.text ?? "keine Nachricht"}` };
  },
)