// features/ai/logging/conversation-trace.ts

import fs from "fs";
import path from "path";

const LOG_PATH = path.join(process.cwd(), "logs", "agent-trace.jsonl");

export function logConversationTrace(trace: unknown) {
  if (process.env.NODE_ENV !== "development") return;

  const line = JSON.stringify(trace) + "\n";
  try {
    fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
    fs.appendFileSync(LOG_PATH, line, "utf-8");
  } catch (error) {
    console.error("logConversationTrace failed", {
      cwd: process.cwd(),
      logPath: LOG_PATH,
      error,
    });
  }
}
