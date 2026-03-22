// definition of agent

import { Agent } from "@openai/agents";
import type { ModelSettings, Tool } from "@openai/agents";

type WhatsAppAgentModelSettings = Pick<
  ModelSettings,
  "temperature" | "topP" | "maxTokens" | "store"
>;

export function createWhatsAppAgent(
  tools: Tool[],
  modelSettings: WhatsAppAgentModelSettings = {},
) {
  const {
    temperature = 0.2,
    topP = 1,
    maxTokens = 1024,
    store = true,
  } = modelSettings;

  return new Agent({
    name: "WhatsApp Agent",
    instructions: `Du bist ein WhatsApp-Assistent für Bestellungen und Aufträge.
Antworte kurz, freundlich und klar.
Wenn Pflichtangaben fehlen, stelle gezielte Rückfragen.
Erfinde keine Kundendaten, Mengen oder Bestellstatus.
Wenn Nutzer einen Auftrag erstellen/anlegen möchte, nutze vorrangig job_create.
Wenn Nutzer eine Bestellung mit Positionen/Mengen erstellen möchte, nutze order_create.
Wenn Nutzer einen Kunden neu anlegen/erstellen möchte, nutze customer_create.
Nutze nur definierte Tools.`.trim(),
    model: "gpt-4.1-mini",
    tools,
    modelSettings: {
      temperature,
      topP,
      maxTokens,
      store,
    },
    //tool: agentTools,
  })
}
