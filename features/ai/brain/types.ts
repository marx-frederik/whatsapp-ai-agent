import { ToolName } from "../tools/types";

export type BrainContext = {
  timezone?: string; // e.g. "Australia/Brisbane"
  locale?: string; // e.g. "de-DE"
};

/* export type ExtractionResult =
  | { type: "text"; text: string }
  | ToolCallUnion
  | ToolCallMissingUnion; */

export type ExtractionResult =
  | { type: "text"; text: string }
  | { type: "tool_call"; tool: ToolName; args: unknown };

export type BrainInput = {
  userId: string;
  text: string;
  timestamp: number;
  locale: string;
  timezone: string;
  pending?: PendingToolCall;
};

export type PendingToolCall = {
  tool: ToolName;
  partialArgs: unknown; // keep unknown at boundary; validate when used
  missingFields: string[]; // list of "paths" (e.g. "time" or "customer.phone")
  question?: string; // optional for better continuity
  createdAt: number;
};

export type BrainOutput =
  | {
      kind: "reply";
      text: string;
      //tool?: ToolCall;
      execution?: { tool: ToolName; result: unknown };
    }
  | {
      kind: "clarify";
      text: string;
      pending: PendingToolCall;
    }
  | {
      kind: "noop";
      text?: string;
    }
  | {
      kind: "error";
      text: string;
      debug?: unknown;
    };
