import { z } from "zod";
import { defineTool } from "../defineTool";
import { getBusinessProvider } from "@/features/integrations/business/get-business-provider";
import { CustomerLookupArgs } from "@/features/integrations/business/type";

export const CustomerLookupSchema = z
  .object({
    customerIdentifier: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    email: z.string().email().optional().nullable(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const hasCriterion = [
      value.customerIdentifier?.trim(),
      value.phone?.trim(),
      value.email?.trim(),
    ].some(Boolean);

    if (!hasCriterion) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Fuer customer_lookup brauche ich mindestens Namen, Kundennummer, Telefon oder E-Mail.",
      });
    }
  });

export const customerLookupTool = defineTool({
  name: "customer_lookup",
  description: "Sucht einen Kunden (Identifier, Telefon oder E-Mail).",
  schema: CustomerLookupSchema,

  async execute(args: CustomerLookupArgs, ctx) {
    const provider = getBusinessProvider();
    return await provider.customerLookup(args);
  },

  render(args, result, ctx) {
    if (!result || typeof result !== "object" || !("ok" in result)) {
      return "Kundendaten wurden geladen.";
    }

    if (!result.ok) {
      return result.message;
    }

    if (result.customers.length === 0) {
      return "Ich konnte keinen passenden Kunden finden.";
    }

    if (result.customers.length === 1) {
      const customer = result.customers[0];
      const address =
        [customer.street, customer.postalCode, customer.city]
          .filter((part): part is string => Boolean(part))
          .join(", ") || "-";

      return [
        `Kunde: ${customer.companyName || customer.contactName || customer.customerNumber}`,
        `Kundennummer: ${customer.customerNumber}`,
        `Kontakt: ${customer.contactName ?? "-"}`,
        `Telefon: ${customer.phone ?? "-"}`,
        `E-Mail: ${customer.email ?? "-"}`,
        `Adresse: ${address}`,
      ].join("\n");
    }

    const lines = result.customers.slice(0, 5).map((customer) => {
      const name =
        customer.companyName || customer.contactName || customer.customerNumber;
      const address = [customer.street, customer.city]
        .filter((part): part is string => Boolean(part))
        .join(", ");

      return `- ${name} (${customer.customerNumber})${address ? `, ${address}` : ""}`;
    });

    return [
      `Ich habe ${result.customers.length} passende Kunden gefunden:`,
      ...lines,
    ].join("\n");
  },
});
