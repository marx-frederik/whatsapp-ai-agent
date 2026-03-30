import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionStore = new Map<string, any>();
const runWhatsappAgentMock = vi.fn();

vi.mock("@/services/redis/session-store", () => ({
  getChatSession: vi.fn(async (chatId: string) => sessionStore.get(chatId) ?? null),
  setChatSession: vi.fn(async (session: any) => {
    sessionStore.set(session.chatId, session);
  }),
}));

vi.mock("@/features/ai/brain/run-whatsapp-agent", () => ({
  runWhatsappAgent: (...args: any[]) => runWhatsappAgentMock(...args),
}));

describe("brainAgent pending follow-up context", () => {
  beforeEach(() => {
    sessionStore.clear();
    runWhatsappAgentMock.mockReset();
  });

  it("stores follow-up context from a tool result and injects it into the next turn", async () => {
    const { brainAgent } = await import("@/features/ai/brain/brain.agent");

    runWhatsappAgentMock
      .mockResolvedValueOnce({
        outputText: "Ich habe mehrere passende Auftraege gefunden. Welchen meinst du genau?",
        responseId: "resp-1",
        raw: null,
        toolNames: ["job_lookup"],
        pendingFollowUp: {
          toolName: "job_lookup",
          message:
            "Ich habe mehrere passende Auftraege gefunden. Welchen meinst du genau?",
          options: ["J-100 (Aegidiusstrasse 12)", "J-101 (Mondgasse 14)"],
        },
      })
      .mockResolvedValueOnce({
        outputText: "Auftrag J-100 wurde geladen.",
        responseId: "resp-2",
        raw: null,
        toolNames: ["job_lookup"],
        pendingFollowUp: null,
      });

    await brainAgent.process({
      chatId: "chat-1",
      text: "Wie ist die Adresse vom Projekt fuer Kunde Heinz Mueller?",
      brainContext: {
        locale: "de-DE",
        timezone: "Europe/Berlin",
      },
    });

    const storedPendingSession = sessionStore.get("chat-1");
    expect(storedPendingSession?.pending?.toolName).toBe("job_lookup");
    expect(storedPendingSession?.pending?.options).toEqual([
      "J-100 (Aegidiusstrasse 12)",
      "J-101 (Mondgasse 14)",
    ]);

    await brainAgent.process({
      chatId: "chat-1",
      text: "Nimm J-100.",
      brainContext: {
        locale: "de-DE",
        timezone: "Europe/Berlin",
      },
    });

    expect(runWhatsappAgentMock).toHaveBeenCalledTimes(2);

    const secondCallInput = runWhatsappAgentMock.mock.calls[1][0];
    expect(secondCallInput.text).toContain("Offenes Tool: job_lookup");
    expect(secondCallInput.text).toContain(
      "Vorherige Rueckfrage: Ich habe mehrere passende Auftraege gefunden. Welchen meinst du genau?",
    );
    expect(secondCallInput.text).toContain(
      "Offene Optionen: J-100 (Aegidiusstrasse 12) | J-101 (Mondgasse 14)",
    );
    expect(secondCallInput.text).toContain("Aktuelle Nutzerantwort: Nimm J-100.");

    const clearedPendingSession = sessionStore.get("chat-1");
    expect(clearedPendingSession?.pending).toBeUndefined();
    expect(clearedPendingSession?.lastResponseId).toBe("resp-2");
  });
});
