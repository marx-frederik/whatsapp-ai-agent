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
  .strict();

export const customerLookupTool = defineTool({
  name: "customer_lookup",
  description: "Sucht einen Kunden (Identifier, Telefon oder E-Mail).",
  schema: CustomerLookupSchema,

  async execute(args: CustomerLookupArgs, ctx) {
    const provider = getBusinessProvider();
    return await provider.customerLookup(args);
  },

  render(args, result, ctx) {
    return "null";
  },
});
