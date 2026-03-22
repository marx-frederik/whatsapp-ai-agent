import { z } from "zod";
import { defineTool } from "../defineTool";
import { getBusinessProvider } from "@/features/integrations/business/get-business-provider";
import { CustomerCreateArgs } from "@/features/integrations/business/type";

export const CustomerCreateSchema = z
  .object({
    customerName: z.string().min(1),
    phone: z.string().min(1),
    contactName: z.string().optional().nullable(),
    email: z.string().email().optional().nullable(),
    street: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    postalCode: z.string().optional().nullable(),
    note: z.string().optional().nullable(),
  })
  .strict();

export const customerCreateTool = defineTool({
  name: "customer_create",
  description:
    "Legt einen Kunden an. Pflicht: customerName und phone. Weitere Felder sind optional.",
  schema: CustomerCreateSchema,

  async execute(args: CustomerCreateArgs, ctx, debug = false) {
    const provider = getBusinessProvider();
    return await provider.customerCreate(args, debug);
  },

  render(args, result, ctx) {
    if (!result || typeof result !== "object" || !("ok" in result)) {
      return "Kunde wurde bearbeitet.";
    }

    if (!result.ok) {
      return result.message;
    }

    const baseMessage = result.customerCreated
      ? `Kunde ${result.customer.customerNumber} wurde angelegt.`
      : `Kunde ${result.customer.customerNumber} existiert bereits.`;
    const missing =
      result.missingFields.length > 0
        ? ` Es fehlen noch: ${result.missingFields.join(", ")}.`
        : "";

    return `${baseMessage}${missing}`;
  },
});
