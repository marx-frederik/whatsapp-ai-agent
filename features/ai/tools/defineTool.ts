import { z } from "zod";

export function defineTool<
  const Name extends string,
  Schema extends z.ZodTypeAny,
  Result
>(def: {
  name: Name;
  description: string;
  schema: Schema;
  execute: (args: z.infer<Schema>, ctx: any) => Promise<Result> | Result;
}) {
  return def;
}