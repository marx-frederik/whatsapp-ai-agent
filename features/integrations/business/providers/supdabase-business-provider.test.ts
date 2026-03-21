// @vitest-environment node
import dotenv from "dotenv";
import { describe, expect, it } from "vitest";

dotenv.config({ path: ".env.local", override: true });

// test: customer_lookup

describe("supabaseBusinessProvider.costumerLookup", () => {
  it("finds customer by identifier", async () => {
    const { supabaseBusinessProvider } =
      await import("./supabase-business-provider");

    const result = await supabaseBusinessProvider.customerLookup({
      customerIdentifier: "Müller",
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error(`Expected ok=true, got error: ${result.message}`);
    }

    expect(Array.isArray(result.customers)).toBe(true);
    expect(result.customers.length).toBeGreaterThan(0);
    expect(result.customers[0]).toHaveProperty("companyName");
  });
});

// Test: order_create
import { orderCreateTool } from "@/features/ai/tools/defs/order_create";
import { jobCreateTool } from "@/features/ai/tools/defs/job_create";

describe("order_create integration", () => {
  it("creates an order and order items for an existing customer", async () => {
    const ctx = {
      locale: "de-DE",
      timezone: "Europe/Berlin",
    } as any;

    const args = {
      customerIdentifier: "Müller",
      items: [
        {
          skuOrName: "Steine",
          quantity: 100,
        },
      ],
      note: "Integrationstest",
    };

    const result = await orderCreateTool.execute(args, ctx, true);

    console.log(result);

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error(`Expected success, got: ${result.message}`);
    }

    expect(result.order.id).toBeTruthy();
    expect(result.order.order_number).toBeTruthy();
    expect(result.order.customer_id).toBeTruthy();
    expect(result.order.status).toBe("draft");
  });

  it("returns follow-up when customer is not found", async () => {
    const ctx = {
      locale: "de-DE",
      timezone: "Europe/Berlin",
    } as any;

    const result = await orderCreateTool.execute(
      {
        customerIdentifier: "UNBEKANNT_123456",
        items: [
          {
            skuOrName: "Steine",
            quantity: 100,
          },
        ],
      },
      ctx,true
    );

    expect(result.ok).toBe(false);

    if (result.ok) {
      throw new Error("Expected follow-up result");
    }

    expect(result.code).toBe("FOLLOW_UP_REQUIRED");
    expect(result.message).toBeTruthy();
  });
});

describe("job_create integration", () => {
  it("creates a job and creates customer if missing", async () => {
    const ctx = {
      locale: "de-DE",
      timezone: "Europe/Berlin",
    } as any;

    const suffix = Date.now();
    const result = await jobCreateTool.execute(
      {
        customerName: `Musterfirma ${suffix}`,
        street: "Teststraße 10",
        city: "Berlin",
        postalCode: "10115",
        note: "Integrationstest job_create",
      },
      ctx,
      true,
    );

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error(`Expected success, got: ${result.message}`);
    }

    expect(result.customer.id).toBeTruthy();
    expect(result.job.id).toBeTruthy();
    expect(result.job.job_number).toBeTruthy();
    expect(result.job.status).toBe("new");
    expect(typeof result.customerCreated).toBe("boolean");
    expect(Array.isArray(result.missingFields)).toBe(true);
  });

  it("creates a quick job with only customerName", async () => {
    const ctx = {
      locale: "de-DE",
      timezone: "Europe/Berlin",
    } as any;

    const suffix = Date.now();
    const result = await jobCreateTool.execute(
      {
        customerName: `Quickkunde ${suffix}`,
      },
      ctx,
      true,
    );

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error(`Expected success, got: ${result.message}`);
    }

    expect(result.customer.id).toBeTruthy();
    expect(result.job.id).toBeTruthy();
    expect(result.missingFields.length).toBeGreaterThan(0);
  });
});
