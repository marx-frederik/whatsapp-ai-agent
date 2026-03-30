import { z } from "zod";
import { defineTool } from "../defineTool";
import { getBusinessProvider } from "@/features/integrations/business/get-business-provider";
import type { CustomerUpdateArgs } from "@/features/integrations/business/type";

export const CustomerUpdateSchema = z
  .object({
    customerIdentifier: z.string().optional().nullable(),
    customerName: z.string().optional().nullable(),
    companyName: z.string().optional().nullable(),
    newCompanyName: z.string().optional().nullable(),
    contactName: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    email: z.string().email().optional().nullable(),
    street: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    postalCode: z.string().optional().nullable(),
    note: z.string().optional().nullable(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const identifier = (
      value.customerIdentifier ??
      value.customerName ??
      value.companyName
    )?.trim();

    if (!identifier) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Fuer customer_update brauche ich mindestens einen Kunden-Identifier wie Kundennummer oder Name.",
      });
    }

    const hasUpdateField = [
      value.newCompanyName?.trim(),
      value.contactName?.trim(),
      value.phone?.trim(),
      value.email?.trim(),
      value.street?.trim(),
      value.city?.trim(),
      value.postalCode?.trim(),
      value.note?.trim(),
    ].some(Boolean);

    if (!hasUpdateField) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Fuer customer_update brauche ich mindestens ein zu aenderndes Feld wie phone, email oder street.",
      });
    }
  });

export const customerUpdateTool = defineTool({
  name: "customer_update",
  description:
    "Aktualisiert einen bestehenden Kunden. Nutze customerIdentifier/customerName/companyName zur Auflösung des Kunden und übergib nur die Felder, die geändert werden sollen. Beispiel: 'Ergänze bei Kunde Müller die Telefonnummer 0151...' -> customerIdentifier='Müller', phone='0151...'.",
  schema: CustomerUpdateSchema,

  async execute(args: CustomerUpdateArgs, ctx, debug = false) {
    const provider = getBusinessProvider();
    return await provider.customerUpdate(args, debug);
  },

  render(args, result, ctx) {
    if (!result || typeof result !== "object" || !("ok" in result)) {
      return "Kunde wurde aktualisiert.";
    }

    if (!result.ok) {
      return result.message;
    }

    const updatedFields =
      result.updatedFields.length > 0
        ? ` Geändert: ${result.updatedFields.join(", ")}.`
        : "";

    return `Kunde ${result.customer.customerNumber} wurde aktualisiert.${updatedFields}`;
  },
});
