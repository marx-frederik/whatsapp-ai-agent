import { z } from "zod";
import { defineTool } from "../defineTool";
import { getBusinessProvider } from "@/features/integrations/business/get-business-provider";
import type { NoteCreateArgs } from "@/features/integrations/business/type";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const NoteCreateSchema = z
  .object({
    noteText: z
      .string()
      .trim()
      .min(2)
      .max(1000)
      .describe("Der eigentliche Notiztext fuer den Auftrag."),
    jobNumber: z
      .string()
      .optional()
      .nullable()
      .describe(
        "Nur setzen, wenn der Nutzer explizit eine Auftragsnummer nennt. Hausnummern aus Adressen gehoeren nicht in jobNumber.",
      ),
    customerIdentifier: z.string().optional().nullable(),
    customerName: z.string().optional().nullable(),
    companyName: z.string().optional().nullable(),
    jobDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .nullable(),
    houseNumber: z
      .string()
      .optional()
      .nullable()
      .describe("Hausnummer, wenn vorhanden."),
    street: z
      .string()
      .optional()
      .nullable()
      .describe(
        "Strassenname bzw. Adresskern. Trenne die Hausnummer nach Moeglichkeit in houseNumber.",
      ),
  })
  .strict()
  .superRefine((value, ctx) => {
    const jobNumber = value.jobNumber?.trim();
    const addressLike = [value.street?.trim(), value.houseNumber?.trim()]
      .filter((part): part is string => Boolean(part))
      .join(" ");

    if (jobNumber && addressLike && /^\d+[a-zA-Z]?$/.test(jobNumber)) {
      const houseNumberInAddress = new RegExp(
        `\\b${escapeRegExp(jobNumber)}\\b`,
        "i",
      );
      if (houseNumberInAddress.test(addressLike)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["jobNumber"],
          message:
            "jobNumber scheint eine Hausnummer aus der Adresse zu sein. Verwende diese Zahl nur in street/houseNumber.",
        });
      }
    }

    if (jobNumber) {
      return;
    }

    const criteriaCount = [
      value.customerIdentifier?.trim(),
      value.customerName?.trim(),
      value.companyName?.trim(),
      value.jobDate?.trim(),
      value.street?.trim(),
    ].filter(Boolean).length;

    if (criteriaCount < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Without jobNumber at least one criterion is required: customerIdentifier/customerName, jobDate or street.",
      });
    }
  });

export const noteCreateTool = defineTool({
  name: "note_create",
  description:
    "Adds a note to an existing job. Prefer structured extraction with noteText plus jobNumber or customer/company with street and houseNumber. Set jobNumber only if an explicit order number is mentioned. House numbers belong to street/houseNumber, not jobNumber. If the job reference could match multiple jobs, ask a focused follow-up instead of guessing.",
  schema: NoteCreateSchema,

  async execute(args: NoteCreateArgs, ctx, debug = false) {
    const provider = getBusinessProvider();
    return await provider.noteCreate(args, debug);
  },

  render(args, result, ctx) {
    if (!result || typeof result !== "object" || !("ok" in result)) {
      return "Notiz wurde bearbeitet.";
    }

    if (!result.ok) {
      return result.message;
    }

    return `Die Notiz wurde zu Auftrag ${result.job.job_number} hinzugefuegt.`;
  },
});
