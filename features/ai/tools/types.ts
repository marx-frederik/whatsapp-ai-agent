import { z } from "zod";

export const ToolArgsSchema = [
  {
    name: "order_create",
    description: "Erstellt eine Bestellung.",
    schema: z
      .object({
        customerIdentifier: z.string().min(1),
        items: z
          .array(
            z
              .object({
                skuOrName: z.string().min(1),
                quantity: z.coerce.number().int().positive(),
              })
              .strict()
          )
          .min(1),
        note: z.string().optional().nullable(),
      })
      .strict(),
  },
  {
    name: "customer_lookup",
    description: "Sucht einen Kunden (Identifier, Telefon oder E-Mail).",
    schema: z
      .object({
        customerIdentifier: z.string().optional().nullable(),
        phone: z.string().optional().nullable(),
        email: z.string().email().optional().nullable(),
      })
      .strict(),
  },

  // ... hier kommen deine ~18 weiteren Tools rein
] as const;


export type ToolName = (typeof ToolArgsSchema)[number]["name"];

/* export const ToolArgsSchema = {
  "schedule.create": z.object({
    date: z.string().min(1),
    time: z.string().min(1),
    title: z.string().optional().nullable(),
    durationMinutes: z.number().int().positive().optional().nullable(),
    location: z.string().optional().nullable(),
    attendees: z.array(z.string().email()).optional().nullable(),
  }),

  "customer.info": z.object({
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
    deliveryDate: z.string().optional().nullable(),
    deliveryAddress: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
  }),

  "team.reminder": z.object({
    // Beispiel
    title: z.string().min(1),
    date: z.string().min(1),
    time: z.string().min(1),
    attendees: z.array(z.string().email()).min(1),
  }),
} as const; */

/* export const ToolNameSchema = z.enum(
  Object.keys(ToolArgsSchema) as [
    keyof typeof ToolArgsSchema,
    ...Array<keyof typeof ToolArgsSchema>,
  ], 
); */

export type ToolCall = Exclude<keyof typeof ToolArgsSchema, never>;