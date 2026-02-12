import { z } from "zod";

export const CommandNameSchema = z.enum([
  "schedule.create",
  "costumer.info",
  "order.create",
  "team.reminder",
]);

export type CommandName = z.infer<typeof CommandNameSchema>;

export const CommandSchema = z.object({
  name: CommandNameSchema,
  entities: z.record(z.unknown()).default({}),
  confidence: z.number().min(0).max(1),
  missingFields: z.array(z.string()).default([]),
});

export type Command = z.infer<typeof CommandSchema>;
