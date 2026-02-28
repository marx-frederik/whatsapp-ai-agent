// scripts/test-openai-smoke.ts
// Run: pnpm tsx scripts/test-openai-smoke.ts.ts
//
// This is a smoke test against the real OpenAI API.
// Goal: verify that the brain flow works end-to-end.
// It is NOT a deterministic unit test.

import { BrainOutput } from "@/features/ai/brain/types";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

type SmokeOutput =
  | { kind: "reply"; text: string }
  | { kind: "clarify"; text: string; pending: { tool: string } }
  | { kind: "error"; text: string; debug?: unknown };

type SmokeCase = {
  label: string;
  input: string;
  expect?: {
    kind?: SmokeOutput["kind"];
    tool?: string;
    allowNoTool?: boolean;
  };
};

const CASES: SmokeCase[] = [
/*   {
    label: "order_create basic",
    input: "Bitte 2x Cola und 1x Wasser fuer Kunde 123",
    expect: { kind: "reply" },
  },
  {
    label: "customer_lookup basic",
    input: "Suche Kunde 123",
    expect: { kind: "reply" },
  },
  {
    label: "no tool",
    input: "Hi, wie geht's?",
    expect: { kind: "reply", allowNoTool: true },
  },
  {
    label: "order_create missing fields",
    input: "Bitte 2x Cola und 1x Wasser",
    expect: { kind: "clarify", tool: "order_create" },
  }, */
  {
    label: "order_create multiple missing fields",
    input: "Bitte 2x  und Wasser",
    expect: { kind: "clarify", tool: "order_create" },
  },
  {
    label: "order_create multiple missing fields",
    input: "Bitte viele kg Mehl bestellen",
    expect: { kind: "clarify", tool: "order_create" },
  },
];

function banner(title: string) {
  console.log("\n" + "=".repeat(60));
  console.log(title);
  console.log("=".repeat(60));
}

function assertMatchesExpectation(output: BrainOutput, test: SmokeCase) {
  if (output.kind === "error") {
    throw new Error(output.text);
  }

  if (test.expect?.kind && output.kind !== test.expect.kind) {
    throw new Error(
      `Expected kind '${test.expect.kind}', got '${output.kind}'`,
    );
  }

  if (test.expect?.tool) {
    if (output.kind !== "clarify") {
      throw new Error(
        `Expected tool '${test.expect.tool}' to be observable via clarify output, got '${output.kind}'`,
      );
    }

    if (output.pending.tool !== test.expect.tool) {
      throw new Error(
        `Expected tool '${test.expect.tool}', got '${output.pending.tool}'`,
      );
    }
  }
}

async function main() {
  const [{ process }, { ToolRegistry }] = await Promise.all([
    import("@/features/ai/brain/brain"),
    import("@/features/ai/tools/types"),
  ]);

  function toolNames() {
    return ToolRegistry.map((t) => t.name).join(", ");
  }

  banner("OPENAI SMOKE TEST (real API)");
  console.log("Tools:", toolNames());

  async function runOne(test: SmokeCase) {
    banner(`CASE: ${test.label}`);
    console.log("INPUT:", test.input);

    const output = await process({
      userId:"123",
      text: test.input,
      locale: "de-DE",
      timezone: "GMT+0",
    });

    console.log("OUTPUT:", output);
    assertMatchesExpectation(output, test);
  }

  let failed = 0;

  for (const c of CASES) {
    try {
      await runOne(c);
      console.log("PASS");
    } catch (e: any) {
      failed++;
      console.error("FAIL:", e?.message ?? e);
    }
  }

  banner("SUMMARY");
  console.log(`Total: ${CASES.length}, Failed: ${failed}`);
  
}

main().catch((e) => {
  console.error("Fatal error:", e);
  
});
