import { z } from "zod";
import { ArgsOf } from "./types";

export function defineTool<
  const Name extends string,
  Schema extends z.ZodTypeAny,
  Result
>(def: {
  name: Name;
  description: string;
  schema: Schema;
  execute: (args: z.infer<Schema>, ctx: any) => Promise<Result> | Result;
  render: (args: z.infer<Schema>, result: Result, ctx: any) => string;
}) {
  return def;
} 