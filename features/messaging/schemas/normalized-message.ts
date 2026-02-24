import { z } from "zod";

export const NormalizedMessageSchema = z
  .object({
    // fixed channel
    channel: z.literal("twilio"),

    kind: z.enum(["text", "audio"]),
    messageId: z.string().min(1),
    from: z.string().min(1),

    // unix seconds
    timestamp: z.number().int().nonnegative(),

    // Twilio reply context
    replyToken: z.object({
      twilioFrom: z.string().min(1), // e.g. "whatsapp:+14155238886"
    }),

    contactName: z.string().optional(),

    // payload depending on kind
    text: z.string().optional(),

    audio: z
      .object({
        mediaUrl: z.string().url(),
        mimeType: z.string().optional(),
        voice: z.boolean().optional(),
      })
      .optional(),
  })
  .superRefine((val, ctx) => {
    if (val.kind === "text") {
      if (!val.text) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "text is required when kind=text",
          path: ["text"],
        });
      }
      if (val.audio) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "audio must be omitted when kind=text",
          path: ["audio"],
        });
      }
    }

    if (val.kind === "audio") {
      if (!val.audio?.mediaUrl) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "audio.mediaUrl is required when kind=audio",
          path: ["audio", "mediaUrl"],
        });
      }
      if (val.text) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "text must be omitted when kind=audio",
          path: ["text"],
        });
      }
    }
  });

export type NormalizedMessage = z.infer<
  typeof NormalizedMessageSchema
>;
