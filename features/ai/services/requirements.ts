import { CommandName, DraftCommand } from "../lib/command.schema";

import { z } from "zod";
import { ToolCallSchema } from "../lib/toolcall.schema";

type ValidationResult =
  | { ok: true }
  | {
      ok: false;
      missingFields?: string[];
      invalidFields?: { path: string; message: string }[];
    };

export type ValidationProblems = {
  missingFields: string[];
  invalidFields: { path: string; message: string }[];
};

function formatPath(path: PropertyKey[]) {
  return path
    .map((p) =>
      typeof p === "symbol" ? p.description ?? p.toString() : String(p)
    )
    .join(".");
}

export function validateRequirements(
  action: keyof typeof ToolCallSchema,
  entities: Record<string, unknown>
): ValidationResult {
  const result = ToolCallSchema[action].safeParse(entities);

  if (!result.success) {
    const { missingFields, invalidFields } = extractValidationProblems(
      result.error
    );

    return {
      ok: false,
      missingFields,
      invalidFields,
    };
  }

  return { ok: true };
}

export function extractValidationProblems(
  error: z.ZodError
): ValidationProblems {
  const missingFields: string[] = [];
  const invalidFields: { path: string; message: string }[] = [];

  for (const issue of error.issues) {
    const path = formatPath(issue.path);

    // 1️⃣ Missing field (expected X, received undefined)
    if (issue.code === "invalid_type" && /undefined/i.test(issue.message)) {
      missingFields.push(path);
      continue;
    }

    // 2️⃣ Empty array / too small (z.array().min(1))
    if (issue.code === "too_small") {
      missingFields.push(path);
      continue;
    }

    // 3️⃣ Everything else = invalid
    invalidFields.push({
      path,
      message: issue.message,
    });
  }

  return { missingFields, invalidFields };
}

export function extractMissingFields(error: z.ZodError): string[] {
  return error.issues
    .filter((i) => {
      if (i.code === "invalid_type") {
        const anyI = i as any;
        return anyI?.received === "undefined" || /undefined/i.test(i.message);
      }
      // treat empty array / too small as missing-ish
      if (i.code === "too_small") return true;
      return false;
    })
    .map((i) => i.path.join("."));
}
