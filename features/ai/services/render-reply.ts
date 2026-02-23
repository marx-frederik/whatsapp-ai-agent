// src/features/ai/services/render-reply.ts

import OpenAI from "openai";
import type { Decision } from "./decision";

export type RenderReplyInput = {
  decision: Decision;
  answerText?: string;

  originalUserMessage: string;
  lastUserMessage?: string;
  extractedData?: unknown;
  intentHint?: string;
};

function fallbackClarification(decision: Extract<Decision, { kind: "ASK_FOR_CLARIFICATION" }>) {
  const lines: string[] = [];

  for (const f of decision.missingFields) {
    lines.push(`• Bitte gib mir ${f}.`);
  }

  for (const f of decision.invalidFields) {
    lines.push(`• ${f.path} ist ungültig (${f.message}). Bitte korrigieren.`);
  }

  return ["Damit ich weitermachen kann, brauche ich noch:", lines.join("\n")].join("\n\n");
}

export async function renderReplyText(
  openai: OpenAI,
  input: RenderReplyInput
): Promise<string> {
  const { decision } = input;

  // ==========================
  // CASE 1: Alles valide
  // ==========================
  if (decision.kind === "ANSWER") {
    const text = (input.answerText ?? "").trim();
    return text.length ? text : "Alles klar. Wie kann ich dir helfen?";
  }

  // ==========================
  // CASE 2: Missing / Invalid
  // ==========================

  const systemPrompt = `
Du bist ein WhatsApp-Assistent auf Deutsch.

Deine Aufgabe:
Formuliere eine kurze, freundliche Rückfrage, um fehlende oder ungültige Felder zu ergänzen.

Regeln:
- Frage NUR nach den Feldern in "missingFields" und "invalidFields".
- Erfinde keine neuen Felder.
- Maximal 6 Zeilen.
- Verwende Bulletpoints mit "•".
- Keine JSON-Ausgabe.
- Keine technischen Erklärungen.
`;

  const payload = {
    intentHint: input.intentHint ?? null,
    originalUserMessage: input.originalUserMessage,
    lastUserMessage: input.lastUserMessage ?? null,
    extractedData: input.extractedData ?? null,
    validation: {
      missingFields: decision.missingFields,
      invalidFields: decision.invalidFields,
    },
  };

  try {
    const response = await openai.responses.create({
      model: "gpt-4.1-mini", // schnell + günstig für solche Tasks
      temperature: 0.3,
      max_output_tokens: 180,
      input: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: `Kontext (nur zur Orientierung, nicht wiederholen):\n${JSON.stringify(
            payload,
            null,
            2
          )}\n\nFormuliere jetzt die Rückfrage.`,
        },
      ],
    });

    const text = response.output_text?.trim();

    if (!text) {
      return fallbackClarification(decision);
    }

    return text;
  } catch (err) {
    return fallbackClarification(decision);
  }
}