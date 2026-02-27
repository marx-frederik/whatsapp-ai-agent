import { ToolCallUnion } from "../tools/types";
import { BrainContext } from "./types";
import { customerLookupTool } from "../tools/defs/customer_lookup";
import { orderCreateTool } from "../tools/defs/order_create";

export function renderToolReply(call: ToolCallUnion, result: unknown, ctx?:BrainContext): string {
    switch (call.tool) {
      case "order_create":
        return orderCreateTool.render(
          call.args,
          result as Awaited<ReturnType<typeof orderCreateTool.execute>>,
          ctx,
        );
      case "customer_lookup":
        return customerLookupTool.render(
          call.args,
          result as Awaited<ReturnType<typeof customerLookupTool.execute>>,
          ctx,
        );
      default:
        return assertNever(call);
    }
  }

function assertNever(x: never): never {
  throw new Error("Unknown tool");
}