// scripts/test-openai-smoke.ts
// Run: pnpm tsx scripts/test-openai-smoke.ts
//
// This is a *smoke test* against the real OpenAI API.
// Goal: verify that your tool definitions + response parsing work end-to-end.
// It is NOT a deterministic unit test.

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

type SmokeCase = {
  label: string;
  input: string;
  expect?: { tool?: string; allowNoTool?: boolean };
};

const CASES: SmokeCase[] = [
  {
    label: "order_create basic",
    input: "Bitte 2x Cola und 1x Wasser für Kunde 123",
    expect: { tool: "order_create" },
  },
  {
    label: "customer_lookup basic",
    input: "Suche Kunde 123",
    expect: { tool: "customer_lookup" },
  },
  {
    label: "no tool",
    input: "Hi, wie geht's?",
    expect: { allowNoTool: true },
  },
];

function banner(title: string) {
  console.log("\n" + "=".repeat(60));
  console.log(title);
  console.log("=".repeat(60));
}

async function main() {
  const { ToolRegistry } = await import("@/features/ai/tools/types");
  const { isToolName, safeParseToolArgs } =
    await import("@/features/ai/brain/extract");
  const { openaiTools } = await import("@/features/ai/tools/openai");
  const { openAiClient } = await import("@/services/ai/openai");
  function toolNames() {
    return ToolRegistry.map((t) => t.name).join(", ");
  }

  banner("OPENAI SMOKE TEST (real API)");
  console.log("Tools:", toolNames());

  async function runOne(test: SmokeCase) {
    banner(`CASE: ${test.label}`);
    console.log("INPUT:", test.input);

    const resp = await openAiClient.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "system",
          content: `Du musst GENAU EINES der Tools aufrufen oder gar keines.
Wenn kein Tool passt, wähle keins aus.
Verfügbare Tools: ${toolNames()}`,
        },
        { role: "user", content: test.input },
      ],
      tools: openaiTools,
      tool_choice: "auto",
      parallel_tool_calls: false,
    });

    // Minimal parsing: find function_call item
    const call = resp.output.find(
      (item: any) => item?.type === "function_call",
    ) as
      | undefined
      | { type: "function_call"; name: string; arguments: unknown };

    if (!call) {
      console.log("→ NO TOOL CALL");
      console.log("output_text:", resp.output_text ?? "(none)");

      if (test.expect?.tool) {
        throw new Error(
          `Expected tool "${test.expect.tool}" but got no tool call.`,
        );
      }
      return;
    }

    console.log("→ TOOL CALL:", call.name);

    if (!isToolName(call.name)) {
      throw new Error(`Model returned unknown tool name: ${call.name}`);
    }

    const raw =
      typeof call.arguments === "string"
        ? JSON.parse(call.arguments)
        : call.arguments;

    // Validate args with your Zod schema (critical contract check)
    const parsed = safeParseToolArgs(call.name, raw);
    if (!parsed.success) {
      console.log("RAW ARGS:", raw);
      console.log("ZOD ISSUES:", parsed.error.issues);
      throw new Error(`Tool args did not validate for ${call.name}`);
    }

    console.log("ARGS (validated):", parsed.data);

    if (test.expect?.tool && call.name !== test.expect.tool) {
      throw new Error(
        `Expected tool "${test.expect.tool}" but got "${call.name}"`,
      );
    }
  }

  let failed = 0;

  for (const c of CASES) {
    try {
      await runOne(c);
      console.log("✅ PASS");
    } catch (e: any) {
      failed++;
      console.error("❌ FAIL:", e?.message ?? e);
    }
  }

  banner("SUMMARY");
  console.log(`Total: ${CASES.length}, Failed: ${failed}`);
  process.exitCode = failed ? 1 : 0;
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exitCode = 1;
});
