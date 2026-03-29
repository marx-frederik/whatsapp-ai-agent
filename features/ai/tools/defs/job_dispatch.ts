import { z } from "zod";
import { defineTool } from "../defineTool";
import { getBusinessProvider } from "@/features/integrations/business/get-business-provider";
import type { JobDispatchArgs } from "@/features/integrations/business/type";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const JobDispatchSchema = z
  .object({
    employeeName: z.string().min(1),
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

    const hasJobNumber = Boolean(value.jobNumber?.trim());
    if (hasJobNumber) {
      return;
    }

    const hasAddressCriterion = Boolean(value.street?.trim());

    const criteriaCount = [
      value.customerIdentifier?.trim(),
      value.customerName?.trim(),
      value.companyName?.trim(),
      value.jobDate?.trim(),
      hasAddressCriterion ? "street" : null,
    ].filter(Boolean).length;

    if (criteriaCount < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Without jobNumber at least one criterion is required: customerIdentifier/customerName, jobDate or street.",
      });
    }
  });

export const jobDispatchTool = defineTool({
  name: "job_dispatch",
  description:
    "Assigns an employee to a job and sets status to scheduled. Prefer structured extraction with employeeName, customerIdentifier/companyName, street and houseNumber. Set jobNumber only if an explicit order number is mentioned. House numbers belong to street/houseNumber, not jobNumber. Do not set a search status for this tool. If the request could match multiple jobs because only a street or only a vague reference is given, ask a focused follow-up instead of guessing. Example success: 'Weise Anna Wolf dem Auftrag in der Zauberstrasse 7 fuer Kunde Schmitz zu.' -> employeeName='Anna Wolf', customerIdentifier='Schmitz', street='Zauberstrasse', houseNumber='7'. Example follow-up: 'Weise Anna Wolf dem Auftrag in der Zauberstrasse 7 zu.' -> ask which customer or which job is meant instead of inventing missing arguments.",
  schema: JobDispatchSchema,

  async execute(args: JobDispatchArgs, ctx, debug = false) {
    const provider = getBusinessProvider();
    return await provider.jobDispatch(args, debug);
  },

  render(args, result, ctx) {
    if (!result || typeof result !== "object" || !("ok" in result)) {
      return "Mitarbeiter-Zuweisung wurde bearbeitet.";
    }

    if (!result.ok) {
      return result.message;
    }

    return `Auftrag ${result.job.job_number} wurde ${result.employee.fullName} zugewiesen (Status: ${result.job.status}).`;
  },
});
