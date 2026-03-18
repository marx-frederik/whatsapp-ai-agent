// @vitest-environment node
import dotenv from "dotenv";
import { describe, expect, it } from "vitest";

dotenv.config({ path: ".env.local", override: true });

describe("supabaseBusinessProvider.costumerLookup", () => {
  it("finds customer by identifier", async () => {
    const { supabaseBusinessProvider } = await import("./supabase-business-provider");

    const result = await supabaseBusinessProvider.customerLookup({
      customerIdentifier: "Müller",
    });

    console.log(result)

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error(`Expected ok=true, got error: ${result.message}`);
    }

    expect(Array.isArray(result.customers)).toBe(true);
    expect(result.customers.length).toBeGreaterThan(0);
    expect(result.customers[0]).toHaveProperty("companyName");
  });
});
