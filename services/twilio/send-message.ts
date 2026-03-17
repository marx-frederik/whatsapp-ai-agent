import { twilioClient } from "./client";

type SendWhatsappMessage = {
  from: string;
  to: string;
  body: string;
};

export async function sendWhatsappMessage(input: SendWhatsappMessage) {
  await twilioClient.messages.create({
    from: input.from,
    to: input.to,
    body: input.body,
  });
}
