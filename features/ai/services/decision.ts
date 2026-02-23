import { ValidationResult } from "./requirements";

// src/features/ai/services/decision.ts
export type Decision =
  | {
      kind: "ANSWER";
    }
  | {
      kind: "ASK_FOR_CLARIFICATION";
      missingFields: string[];
      invalidFields: { path: string; message: string }[];
    };

export function decide(validation: ValidationResult): Decision {
  if (validation.ok) return { kind: "ANSWER" };

  const missingFields = validation.missingFields ?? [];
  const invalidFields = validation.invalidFields ?? [];

  // Falls ok:false aber ohne payload (sollte eig. nicht passieren) => trotzdem fragen
  if (missingFields.length === 0 && invalidFields.length === 0) {
    return {
      kind: "ASK_FOR_CLARIFICATION",
      missingFields: ["(unbekannt)"],
      invalidFields: [],
    };
  }

  return {
    kind: "ASK_FOR_CLARIFICATION",
    missingFields,
    invalidFields,
  };
}