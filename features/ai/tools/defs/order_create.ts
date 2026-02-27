import { z } from "zod";
import { defineTool } from "../defineTool";

export const orderCreateTool = defineTool({
  name: "order_create",
  description: "Erstellt eine Bestellung.",
  schema: z
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
    .strict(),

  async execute(args, ctx) {
    // MVP stub
    return {
      type: "order_created" as const,
      orderId: `ORD-${Date.now()}`,
      customerIdentifier: args.customerIdentifier,
      itemsCount: args.items.length,
    };
  },

  render(args, result, ctx) {
    return `Bestellung erstellt. ID: ${result.orderId}, Kunde: ${result.customerIdentifier}, Positionen: ${result.itemsCount}`;
  },
});
