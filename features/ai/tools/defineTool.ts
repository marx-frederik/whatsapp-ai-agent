import { z } from "zod";
import type { BrainContext } from "../brain/types";

type MaybePromise<T> = T | Promise<T>;

type ToolDefinition<
  TName extends string = string,
  TSchema extends z.ZodType = z.ZodType,
  TResult = unknown,
> = {
  name: TName;
  description: string;
  schema: TSchema;
  execute: (args: z.infer<TSchema>, ctx: BrainContext, debug?:boolean) => MaybePromise<TResult>;
  render: (args: z.infer<TSchema>, result: TResult, ctx: BrainContext) => string;
};

export function defineTool<
  TName extends string,
  TSchema extends z.ZodType,
  TResult,
>(
  def: ToolDefinition<TName, TSchema, TResult>,
): ToolDefinition<TName, TSchema, TResult> {
  return def;
}
