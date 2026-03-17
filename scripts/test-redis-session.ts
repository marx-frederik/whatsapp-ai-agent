import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  console.log("Starting Redis session smoke test...\n");

  const { env } = await import("@/data/env/server")
  const {
    getChatSession,
    setChatSession,
  } = await import("@/services/redis/session-store");

  console.log("ENV loaded:");
  console.log("REDIS_URL:", env.REDIS_URL, "\n");

  const chatId = "smoke-test-chat";

  await setChatSession({
    chatId,
    lastResponseId: "resp_test_123",
    updatedAt: new Date().toISOString(),
  });

  const session = await getChatSession(chatId);

  console.dir(session, { depth: null });

  if (!session) {
    throw new Error("Session was not found in Redis");
  }

  if (session.lastResponseId !== "resp_test_123") {
    throw new Error("Session data mismatch");
  }

  console.log("\n✅ Redis session smoke test passed");
}

main().catch((err) => {
  console.error("\n❌ Redis smoke test failed\n");
  console.error(err);
  process.exit(1);
});