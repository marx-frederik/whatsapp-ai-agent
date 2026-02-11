import { EventSchemas, Inngest } from "inngest";
import { TwilioIncomingMessageSchema } from "./types/events";
import z from "zod";

// Create a client to send and receive events
export const inngest = new Inngest({
  id: "wa-ai-agent",
  schemas: new EventSchemas().fromRecord<Events>(),
});

type Events = {
  "twilio/message.incoming": {
    data: z.infer<typeof TwilioIncomingMessageSchema>;
  };
};
