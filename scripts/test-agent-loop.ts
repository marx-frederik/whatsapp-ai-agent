import { BrainContext } from "@/features/ai/brain/types";
import { NormalizedMessage } from "@/features/messaging/schemas/normalized-message";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

type BrainAgentInput = {
  chatId: string;
  text: string;
  brainContext: BrainContext;
};

async function main() {
  const { brainAgent } = await import("@/features/ai/brain/brain.agent");

  let msg: BrainAgentInput = {
    chatId: "+12345678",
    brainContext: {},
    text: "Bitte Cola bestellen",
  };

  console.log("\n--- TURN 1 ---");
  console.log("User:", msg.text);

  const r1 = await brainAgent.process(msg);

  console.log("Agent:", r1);

  console.log("\n--- TURN 2 ---");

  msg = {
    chatId: "+12345678",
    brainContext: {},
    text: "Für Kunde 123",
  };
  console.log("User:", msg.text);

  const r2 = await brainAgent.process(msg);

  console.log("Agent:", r2);

  console.log("\n--- TURN 3 ---");

  msg = {
    chatId: "+12345678",
    brainContext: {},
    text: "2 Kisten",
  };

  const r3 = await brainAgent.process(msg);

  console.log("Agent:", r3);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
