import { z } from "zod";
import { defineTool } from "../defineTool";
import { getBusinessProvider } from "@/features/integrations/business/get-business-provider";
import type { JobUpdateArgs } from "@/features/integrations/business/type";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const JobUpdateSchema = z
  .object({
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
    houseNumber: z.string().optional().nullable(),
    street: z.string().optional().nullable(),
    newAddress: z.string().optional().nullable(),
    scheduledDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .nullable(),
    status: z
      .enum(["new", "scheduled", "done", "cancelled"])
      .optional()
      .nullable(),
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

    const criteriaCount = [
      value.jobNumber?.trim(),
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
          "Fuer job_update brauche ich mindestens eine Auftragsreferenz wie Auftragsnummer, Kunde oder Strasse.",
      });
    }

    const hasUpdateField = [
      value.newAddress?.trim(),
      value.scheduledDate?.trim(),
      value.status?.trim(),
    ].some(Boolean);

    if (!hasUpdateField) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Fuer job_update brauche ich mindestens ein zu aenderndes Feld wie status, scheduledDate oder newAddress.",
      });
    }
  });

export const jobUpdateTool = defineTool({
  name: "job_update",
  description:
    "Aktualisiert einen bestehenden Auftrag. Nutze zur Auflösung jobNumber oder Kunde plus Straße/Hausnummer. Geändert werden können Status, geplantes Datum und die neue Adresse. Freie Notizen gehören in note_create, Mitarbeiterzuweisung in job_dispatch.",
  schema: JobUpdateSchema,

  async execute(args: JobUpdateArgs, ctx, debug = false) {
    const provider = getBusinessProvider();
    return await provider.jobUpdate(args, debug);
  },

  render(args, result, ctx) {
    if (!result || typeof result !== "object" || !("ok" in result)) {
      return "Auftrag wurde aktualisiert.";
    }

    if (!result.ok) {
      return result.message;
    }

    const updatedFields =
      result.updatedFields.length > 0
        ? ` Geändert: ${result.updatedFields.join(", ")}.`
        : "";

    return `Auftrag ${result.job.job_number} wurde aktualisiert.${updatedFields}`;
  },
});
