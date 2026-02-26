import { ToolCallUnion } from "./extract";

export type BrainContext = {
  timezone?: string; // e.g. "Australia/Brisbane"
  locale?: string; // e.g. "de-DE"
};

export type ExtractionResult = { type: "text"; text: string } | ToolCallUnion;
