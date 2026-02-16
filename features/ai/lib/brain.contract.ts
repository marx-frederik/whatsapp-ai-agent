import { NormalizedMessage } from "@/features/messaging/schemas/normalized-message";
import { DraftCommand } from "@/features/ai/lib/command.schema";
import { ToolCall } from "@/features/ai/lib/toolcall.schema";

/**
 * Optionaler Kontext für Brain-Entscheidungen.
 * Phase 1: meist nur timezone/locale.
 * Phase 3+: activeDraft / persisted state möglich.
 */
export type BrainContext = {
  timezone?: string; // e.g. "Australia/Brisbane"
  locale?: string; // e.g. "de-DE"
  activeDraft?: DraftCommand;
};

export type BrainOutcomeType =
  | "clarify" // Rückfrage nötig (fehlende Felder / unklar)
  | "confirm" // Zusammenfassung + Bitte um Bestätigung
  | "execute" // bereit zur Ausführung / ausgeführt (später)
  | "inform" // reine Info, kein confirm nötig (selten in Phase 1)
  | "error"; // unerwarteter Fehler

export type BrainResult = {
  outcome: BrainOutcomeType;

  /**
   * WhatsApp-ready Antworttext.
   * Der Reply-Service sendet das 1:1 an den User.
   */
  replyText: string;

  /**
   * Extrahierter Draft Command (für Logs/Debugging/Testing).
   * In Phase 1 sollte der meistens vorhanden sein.
   */
  command?: DraftCommand;

  /**
   * Optional: strukturierte Aktionen zur Ausführung.
   * Phase 1 kann das leer lassen, Phase 3/4+ nutzt es stärker.
   */
  toolCalls?: ToolCall[];

  /**
   * Optional: Meta-Daten fürs Observability/Debugging.
   */
  meta?: {
    traceId?: string; // z.B. Inngest runId
    messageId?: string;
    from?: string;
    model?: string;
    latencyMs?: number;
  };
};

export interface Brain {
  /**
   * Zentrale Schnittstelle: Nachricht rein -> BrainResult raus.
   * Implementierungen:
   * - brain.structured (Phase 1-3)
   * - brain.agentbuilder (Phase 4+, optional)
   */
  process(input: NormalizedMessage, ctx?: BrainContext): Promise<BrainResult>;
}
