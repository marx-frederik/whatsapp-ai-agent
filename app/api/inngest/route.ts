import { serve } from "inngest/next";
import { inngest } from "@/services/inngest/client";
import { twilioMessageReceived } from "@/services/inngest/functions";

// Create an API that serves zero functions
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [twilioMessageReceived],
});
