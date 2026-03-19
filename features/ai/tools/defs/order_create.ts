import { z } from "zod";
import { defineTool } from "../defineTool";
import { getBusinessProvider } from "@/features/integrations/business/get-business-provider";
import { OrderCreateArgs } from "@/features/integrations/business/type";

export const OrderCreateSchema = z
  .object({
    customerIdentifier: z.string().min(1),
    items: z
      .array(
        z
          .object({
            skuOrName: z.string().min(1),
            quantity: z.coerce.number().int().positive(),
          })
          .strict(),
      )
      .min(1),
    note: z.string().optional().nullable(),
  })
  .strict();

export const orderCreateTool = defineTool({
  name: "order_create",
  description: "Erstellt eine Bestellung.",
  schema: OrderCreateSchema,

  async execute(args: OrderCreateArgs, ctx, debug=false) {
    const provider = getBusinessProvider();
    return await provider.orderCreate(args, debug);
  },
  render(args, result, ctx) {
    return `Bestellung erstellt.` 
  },
});
