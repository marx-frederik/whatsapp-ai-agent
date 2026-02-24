import z from "zod";

export const ToolArgsSchema = {
  "schedule.create": z.object({
    date: z.string().min(1),
    time: z.string().min(1),
    title: z.string().optional(),
    durationMinutes: z.number().int().positive().optional(),
    location: z.string().optional(),
    attendees: z.array(z.string().email()).optional(),
  }),

  "costumer.info": z.object({
    customerIdentifier: z.string().min(1),
    requestedFields: z.array(z.string()).min(1),
  }),

  "order.create": z.object({
    customerIdentifier: z.string().min(1),
    items: z
      .array(
        z.object({
          skuOrName: z.string().min(1),
          quantity: z.coerce.number().int().positive(),
        }),
      )
      .min(1),
    deliveryDate: z.string().optional(),
    deliveryAddress: z.string().optional(),
    notes: z.string().optional(),
  }),

  "team.reminder": z.object({
    // Beispiel
    title: z.string().min(1),
    date: z.string().min(1),
    time: z.string().min(1),
    attendees: z.array(z.string().email()).min(1),
  }),
} as const;

export const ToolNameSchema = z.enum(
  Object.keys(ToolArgsSchema) as [
    keyof typeof ToolArgsSchema,
    ...Array<keyof typeof ToolArgsSchema>,
  ],
);

type ToolName = z.infer<typeof ToolNameSchema>;

export type ToolCall = Exclude<keyof typeof ToolArgsSchema, never>;
