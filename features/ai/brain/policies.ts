import { BrainContext } from "../lib/brain.contract";
import { ExtractionResult } from "./extract";

export async function checkPolicies(
    extracted: ExtractionResult,
    ctx: BrainContext
  ) {
    return { allowed: true as const };
  }