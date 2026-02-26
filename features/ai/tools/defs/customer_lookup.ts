import { z } from "zod";
import { defineTool } from "../defineTool";
export const customerLookupTool = defineTool({
  name: "customer_lookup",
  description: "Sucht einen Kunden (Identifier, Telefon oder E-Mail).",
  schema: z
    .object({
      customerIdentifier: z.string().optional().nullable(),
      phone: z.string().optional().nullable(),
      email: z.string().email().optional().nullable(),
    })
    .strict(),

  async execute(args, ctx) {
    if (args.customerIdentifier === "123") {
      return {
        type: "customer_found" as const,
        customerId: "123",
        displayName: "Testkunde 123",
      };
    }
    return { type: "customer_not_found" as const, query: args };
  },

  async render(result, ctx) {
    if (result.type === "customer_found") {
      console.log("Hier die Benutzerdaten:");
      console.log(result.displayName);
    }
    if (result.type === "customer_not_found") {
      console.log("Der Benutzer konnte nicht gefunden werden.");
    }
  },
});
