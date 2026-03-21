import { z } from "zod";
import { defineTool } from "../defineTool";
import { getBusinessProvider } from "@/features/integrations/business/get-business-provider";
import { JobCreateArgs } from "@/features/integrations/business/type";

export const JobCreateSchema = z
  .object({
    customerName: z.string().min(1),
    street: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    postalCode: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    email: z.string().email().optional().nullable(),
    note: z.string().optional().nullable(),
  })
  .strict();

export const jobCreateTool = defineTool({
  name: "job_create",
  description:
    "Erstellt einen Auftrag. Prüft zuerst den Kunden und legt ihn an, falls er nicht existiert.",
  schema: JobCreateSchema,

  async execute(args: JobCreateArgs, ctx, debug = false) {
    const provider = getBusinessProvider();
    return await provider.jobCreate(args, debug);
  },

  render(args, result, ctx) {
    if (!result || typeof result !== "object" || !("ok" in result)) {
      return "Auftrag wurde bearbeitet.";
    }
    if (!result.ok) {
      return result.message;
    }
    const missing =
      result.missingFields.length > 0
        ? ` Es fehlen noch: ${result.missingFields.join(", ")}.`
        : "";
    return `Auftrag ${result.job.job_number} wurde erstellt.${missing}`;
  },
});
