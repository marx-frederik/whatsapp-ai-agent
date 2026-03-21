import { ToolCallUnion } from "../tools/types";
import { BrainContext } from "./types";
import { customerLookupTool } from "../tools/defs/customer_lookup";
import { jobCreateTool } from "../tools/defs/job_create";
import { orderCreateTool } from "../tools/defs/order_create";

export function renderToolReply(call: ToolCallUnion, result: unknown, ctx?:BrainContext): string {
    const effectiveCtx: BrainContext = ctx ?? {};
    switch (call.tool) {
      case "order_create":
        return orderCreateTool.render(
          call.args,
          result as Awaited<ReturnType<typeof orderCreateTool.execute>>,
          effectiveCtx,
        );
      case "customer_lookup":
        return customerLookupTool.render(
          call.args,
          result as Awaited<ReturnType<typeof customerLookupTool.execute>>,
          effectiveCtx,
        );
      case "job_create":
        return jobCreateTool.render(
          call.args,
          result as Awaited<ReturnType<typeof jobCreateTool.execute>>,
          effectiveCtx,
        );
      default:
        return assertNever(call);
    }
  }

function assertNever(x: never): never {
  throw new Error("Unknown tool");
}