import { BrainContext, ExtractionResult } from "./types";


export async function checkPolicies(
    extracted: ExtractionResult,
    ctx: BrainContext
  ) {
    return { allowed: true as const };
  }