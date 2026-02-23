import { z } from "zod";

export const CommandNameSchema = z.enum([
  "schedule.create",
  "costumer.info",
  "order.create",
  "team.reminder",
  "clarify",
]);

export type CommandName = z.infer<typeof CommandNameSchema>

/**
 * Entities sind bewusst locker typisiert,
 * weil sie je nach Action unterschiedlich aussehen.
 */
export const DraftCommandSchema = z.object({
  action: CommandNameSchema,

  /**
   * 0–1 Confidence vom Modell
   */
  confidence: z.number().min(0).max(1),

  /**
   * Strukturierte Daten – je nach Action unterschiedlich.
   * Keine Fließtext-Entscheidungen hier rein!
   */
  entities: z.record(z.string(), z.unknown()),

  /**
   * Welche Pflichtfelder fehlen noch?
   * Wird nach Validierung gesetzt (nicht zwingend vom Modell).
   */
  missingFields: z.array(z.string()).optional(),

  /**
   * Optional: Wenn das Modell direkt eine gezielte Rückfrage
   * vorschlägt (z.B. bei Unklarheit).
   */
  clarificationQuestion: z.string().optional(),

  /**
   * Für Debug/Logs hilfreich.
   */
  sourceText: z.string().optional(),
});

export type DraftCommand = z.infer<typeof DraftCommandSchema>;


export const CommandJsonSchema = {
  name: "command",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      name: {
        type: "string",
        enum: ["schedule.create", "costumer.info", "order.create", "team.reminder"],
      },
      entities: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            key: { type: "string", minLength: 1 },
            value: {
              anyOf: [
                { type: "string" },
                { type: "number" },
                { type: "boolean" },
                { type: "object", additionalProperties: false },
                {
                  type: "array",
                  items: {
                    anyOf: [
                      { type: "string" },
                      { type: "number" },
                      { type: "boolean" },
                      { type: "object", additionalProperties: false },
                    ],
                  },
                },
                { type: "null" },
              ],
            },
          },
          required: ["key", "value"],
        },
      },
      confidence: {
        type: "number",
        minimum: 0,
        maximum: 1,
      },
      missingFields: {
        type: "array",
        items: { type: "string" },
      },
    },
    required: ["name", "entities", "confidence", "missingFields"],
  },
} as const;
