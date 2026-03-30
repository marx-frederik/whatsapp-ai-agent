// @vitest-environment node
import dotenv from "dotenv";
import { describe, expect, it } from "vitest";
import { orderCreateTool } from "@/features/ai/tools/defs/order_create";
import { jobCreateTool } from "@/features/ai/tools/defs/job_create";
import { jobCompleteTool } from "@/features/ai/tools/defs/job_complete";
import { customerUpdateTool } from "@/features/ai/tools/defs/customer_update";
import {
  JobDispatchSchema,
  jobDispatchTool,
} from "@/features/ai/tools/defs/job_dispatch";
import { jobLookupTool } from "@/features/ai/tools/defs/job_lookup";
import { jobUpdateTool } from "@/features/ai/tools/defs/job_update";
import { noteCreateTool } from "@/features/ai/tools/defs/note_create";
import { getSupabaseServer } from "@/services/supabase/server";

dotenv.config({ path: ".env.local", override: true });

const testCtx = {
  locale: "de-DE",
  timezone: "Europe/Berlin",
} as const;

async function cleanupOrder(orderId: string | null): Promise<void> {
  if (!orderId) {
    return;
  }

  const supabase = getSupabaseServer();
  await supabase.from("order_items").delete().eq("order_id", orderId);
  await supabase.from("orders").delete().eq("id", orderId);
}

async function cleanupJobAndCustomer(
  jobId: string | null,
  customerId: string | null,
  customerCreated: boolean,
): Promise<void> {
  const supabase = getSupabaseServer();

  if (jobId) {
    await supabase.from("jobs").delete().eq("id", jobId);
  }

  if (customerCreated && customerId) {
    await supabase.from("customers").delete().eq("id", customerId);
  }
}

async function cleanupCustomer(customerId: string | null): Promise<void> {
  if (!customerId) {
    return;
  }

  const supabase = getSupabaseServer();
  await supabase.from("customers").delete().eq("id", customerId);
}

describe("supabaseBusinessProvider.costumerLookup", () => {
  it("finds customer by identifier", async () => {
    const { supabaseBusinessProvider } = await import("./supabase-business-provider");
    const supabase = getSupabaseServer();
    const suffix = Date.now();
    let customerId: string | null = null;

    try {
      const customerName = `Lookupkunde ${suffix}`;
      const { data: customer, error: customerError } = await supabase
        .from("customers")
        .insert({
          customer_number: `C-IT-${suffix}`,
          company_name: customerName,
          contact_name: customerName,
        })
        .select("*")
        .single();

      if (customerError || !customer) {
        throw new Error(customerError?.message ?? "Customer setup failed");
      }
      customerId = customer.id;

      const result = await supabaseBusinessProvider.customerLookup({
        customerIdentifier: customerName,
      });

      expect(result.ok).toBe(true);

      if (!result.ok) {
        throw new Error(`Expected ok=true, got error: ${result.message}`);
      }

      expect(Array.isArray(result.customers)).toBe(true);
      expect(result.customers.length).toBeGreaterThan(0);
      expect(result.customers[0]).toHaveProperty("companyName");
      expect(result.customers.some((entry) => entry.id === customer.id)).toBe(true);
    } finally {
      await cleanupCustomer(customerId);
    }
  });

  it("returns follow-up when no customer matches", async () => {
    const { supabaseBusinessProvider } = await import("./supabase-business-provider");

    const result = await supabaseBusinessProvider.customerLookup({
      customerIdentifier: "KEIN_KUNDE_999999",
    });

    expect(result.ok).toBe(false);

    if (result.ok) {
      throw new Error("Expected follow-up result");
    }

    expect(result.code).toBe("FOLLOW_UP_REQUIRED");
    expect(result.message).toMatch(/keinen passenden kunden/i);
  });
});

describe("order_create integration", () => {
  it("creates an order and order items for an existing customer", async () => {
    const supabase = getSupabaseServer();
    const suffix = Date.now();
    let createdOrderId: string | null = null;
    let customerId: string | null = null;

    try {
      const customerName = `Bestellkunde ${suffix}`;
      const { data: customer, error: customerError } = await supabase
        .from("customers")
        .insert({
          customer_number: `C-IT-${suffix}`,
          company_name: customerName,
          contact_name: customerName,
        })
        .select("*")
        .single();

      if (customerError || !customer) {
        throw new Error(customerError?.message ?? "Customer setup failed");
      }
      customerId = customer.id;

      const result = await orderCreateTool.execute(
        {
          customerIdentifier: customerName,
          items: [
            {
              skuOrName: "Steine",
              quantity: 100,
            },
          ],
          note: "Integrationstest",
        },
        testCtx as any,
        true,
      );

      expect(result.ok).toBe(true);

      if (!result.ok) {
        throw new Error(`Expected success, got: ${result.message}`);
      }

      createdOrderId = result.order.id;
      expect(result.order.id).toBeTruthy();
      expect(result.order.order_number).toBeTruthy();
      expect(result.order.customer_id).toBe(customer.id);
      expect(result.order.status).toBe("draft");
    } finally {
      await cleanupOrder(createdOrderId);
      await cleanupCustomer(customerId);
    }
  });

  it("returns follow-up when customer is not found", async () => {
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
      testCtx as any,
      true,
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
    const suffix = Date.now();
    let createdJobId: string | null = null;
    let createdCustomerId: string | null = null;
    let customerWasCreated = false;

    try {
      const result = await jobCreateTool.execute(
        {
          customerName: `Musterfirma ${suffix}`,
          street: "TeststraÃƒÅ¸e 10",
          city: "Berlin",
          postalCode: "10115",
          note: "Integrationstest job_create",
        },
        testCtx as any,
        true,
      );

      expect(result.ok).toBe(true);

      if (!result.ok) {
        throw new Error(`Expected success, got: ${result.message}`);
      }

      createdJobId = result.job.id;
      createdCustomerId = result.customer.id;
      customerWasCreated = result.customerCreated;

      expect(result.customer.id).toBeTruthy();
      expect(result.job.id).toBeTruthy();
      expect(result.job.job_number).toBeTruthy();
      expect(result.job.status).toBe("new");
      expect(typeof result.customerCreated).toBe("boolean");
      expect(Array.isArray(result.missingFields)).toBe(true);
    } finally {
      await cleanupJobAndCustomer(
        createdJobId,
        createdCustomerId,
        customerWasCreated,
      );
    }
  });

  it("creates a quick job with only customerName", async () => {
    const suffix = Date.now();
    let createdJobId: string | null = null;
    let createdCustomerId: string | null = null;
    let customerWasCreated = false;

    try {
      const result = await jobCreateTool.execute(
        {
          customerName: `Quickkunde ${suffix}`,
        },
        testCtx as any,
        true,
      );

      expect(result.ok).toBe(true);

      if (!result.ok) {
        throw new Error(`Expected success, got: ${result.message}`);
      }

      createdJobId = result.job.id;
      createdCustomerId = result.customer.id;
      customerWasCreated = result.customerCreated;

      expect(result.customer.id).toBeTruthy();
      expect(result.job.id).toBeTruthy();
      expect(result.missingFields.length).toBeGreaterThan(0);
    } finally {
      await cleanupJobAndCustomer(
        createdJobId,
        createdCustomerId,
        customerWasCreated,
      );
    }
  });
});

describe("customer_update integration", () => {
  it("updates a uniquely resolved customer and appends a timestamped note", async () => {
    const supabase = getSupabaseServer();
    const suffix = Date.now();
    const customerName = `Kupferstern Ausbau GmbH ${suffix}`;
    let customerId: string | null = null;

    try {
      const { data: customer, error: customerError } = await supabase
        .from("customers")
        .insert({
          customer_number: `C-IT-${suffix}`,
          company_name: customerName,
          contact_name: "Mira Sonnberg",
          phone: "030123456",
          notes: "Bestehende Kundennotiz",
        })
        .select("*")
        .single();

      if (customerError || !customer) {
        throw new Error(customerError?.message ?? "Customer setup failed");
      }
      customerId = customer.id;

      const result = await customerUpdateTool.execute(
        {
          customerIdentifier: customerName,
          phone: "01701234567",
          email: "mira@kupferstern.test",
          city: "Koeln",
          note: "Telefonnummer aktualisiert.",
        },
        testCtx as any,
        true,
      );

      expect(result.ok).toBe(true);

      if (!result.ok) {
        throw new Error(`Expected success, got: ${result.message}`);
      }

      expect(result.updatedFields).toEqual(
        expect.arrayContaining(["phone", "email", "city", "note"]),
      );
      expect(result.customer.phone).toBe("01701234567");
      expect(result.customer.email).toBe("mira@kupferstern.test");
      expect(result.customer.city).toBe("Koeln");
      expect(result.customer.notes).toContain("Bestehende Kundennotiz");
      expect(result.customer.notes).toContain("Telefonnummer aktualisiert.");
    } finally {
      await cleanupCustomer(customerId);
    }
  });

  it("returns follow-up when multiple customers match the update target", async () => {
    const supabase = getSupabaseServer();
    const suffix = Date.now();
    const sharedName = `Sonnenhang Bau GmbH ${suffix}`;
    const customerIds: string[] = [];

    try {
      const { data: firstCustomer, error: firstCustomerError } = await supabase
        .from("customers")
        .insert({
          customer_number: `C-IT-${suffix}-A`,
          company_name: sharedName,
          contact_name: sharedName,
          street: "Nordufer 1",
          city: "Koeln",
        })
        .select("*")
        .single();

      if (firstCustomerError || !firstCustomer) {
        throw new Error(firstCustomerError?.message ?? "First customer setup failed");
      }
      customerIds.push(firstCustomer.id);

      const { data: secondCustomer, error: secondCustomerError } = await supabase
        .from("customers")
        .insert({
          customer_number: `C-IT-${suffix}-B`,
          company_name: sharedName,
          contact_name: sharedName,
          street: "Suedufer 2",
          city: "Bonn",
        })
        .select("*")
        .single();

      if (secondCustomerError || !secondCustomer) {
        throw new Error(
          secondCustomerError?.message ?? "Second customer setup failed",
        );
      }
      customerIds.push(secondCustomer.id);

      const result = await customerUpdateTool.execute(
        {
          customerIdentifier: sharedName,
          phone: "01510000000",
        },
        testCtx as any,
        true,
      );

      expect(result.ok).toBe(false);

      if (result.ok) {
        throw new Error("Expected follow-up result");
      }

      expect(result.code).toBe("FOLLOW_UP_REQUIRED");
      expect(result.message).toMatch(/mehrere|welchen|genau/i);
      expect(result.options ?? []).toHaveLength(2);
    } finally {
      if (customerIds.length > 0) {
        await supabase.from("customers").delete().in("id", customerIds);
      }
    }
  });
});

describe("job_dispatch integration", () => {
  it("assigns an employee via employee + customer + address and keeps unrelated jobs untouched", async () => {
    const supabase = getSupabaseServer();
    const suffix = Date.now();
    const employeeName = `Tilda Brandner ${suffix}`;
    const customerName = `Nordstern Ausbau GmbH ${suffix}`;
    const otherCustomerName = `Leitwerk Service GmbH ${suffix}`;
    const streetName = `Morgensternpfad ${suffix}`;
    const houseNumber = "7";

    let employeeId: string | null = null;
    let customerId: string | null = null;
    let otherCustomerId: string | null = null;
    let jobId: string | null = null;
    let otherJobId: string | null = null;

    try {
      const { data: employee, error: employeeError } = await supabase
        .from("employees")
        .insert({
          employee_number: `E-IT-${suffix}`,
          full_name: employeeName,
          role: "Dispo",
          active: true,
        })
        .select("*")
        .single();

      if (employeeError || !employee) {
        throw new Error(employeeError?.message ?? "Employee setup failed");
      }
      employeeId = employee.id;

      const { data: customer, error: customerError } = await supabase
        .from("customers")
        .insert({
          customer_number: `C-IT-${suffix}`,
          company_name: customerName,
          contact_name: customerName,
        })
        .select("*")
        .single();

      if (customerError || !customer) {
        throw new Error(customerError?.message ?? "Customer setup failed");
      }
      customerId = customer.id;

      const { data: otherCustomer, error: otherCustomerError } = await supabase
        .from("customers")
        .insert({
          customer_number: `C-IT-${suffix}-ALT`,
          company_name: otherCustomerName,
          contact_name: otherCustomerName,
        })
        .select("*")
        .single();

      if (otherCustomerError || !otherCustomer) {
        throw new Error(otherCustomerError?.message ?? "Other customer setup failed");
      }
      otherCustomerId = otherCustomer.id;

      const { data: createdJob, error: jobError } = await supabase
        .from("jobs")
        .insert({
          job_number: `J-IT-${suffix}`,
          customer_id: customer.id,
          status: "new",
          address: `${streetName} ${houseNumber}, Koeln`,
          notes: "Integrationstest job_dispatch",
        })
        .select("*")
        .single();

      if (jobError || !createdJob) {
        throw new Error(jobError?.message ?? "Job setup failed");
      }
      jobId = createdJob.id;

      const { data: otherJob, error: otherJobError } = await supabase
        .from("jobs")
        .insert({
          job_number: `J-IT-${suffix}-ALT`,
          customer_id: otherCustomer.id,
          status: "new",
          address: `${streetName} ${houseNumber}, Koeln`,
          notes: "Integrationstest job_dispatch anderer Kunde",
        })
        .select("*")
        .single();

      if (otherJobError || !otherJob) {
        throw new Error(otherJobError?.message ?? "Other job setup failed");
      }
      otherJobId = otherJob.id;

      const extractedArgs = JobDispatchSchema.parse({
        employeeName,
        companyName: customerName,
        street: streetName,
        houseNumber,
      });

      const result = await jobDispatchTool.execute(extractedArgs, testCtx as any, true);

      expect(result.ok).toBe(true);

      if (!result.ok) {
        throw new Error(`Expected success, got: ${result.message}`);
      }

      expect(result.employee.id).toBe(employee.id);
      expect(result.job.id).toBe(createdJob.id);
      expect(result.job.assigned_employee_id).toBe(employee.id);
      expect(result.job.status).toBe("scheduled");

      const { data: untouchedOtherJob, error: untouchedOtherJobError } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", otherJob.id)
        .single();

      if (untouchedOtherJobError || !untouchedOtherJob) {
        throw new Error(
          untouchedOtherJobError?.message ?? "Could not reload unrelated job",
        );
      }

      expect(untouchedOtherJob.assigned_employee_id).toBeNull();
      expect(untouchedOtherJob.status).toBe("new");
    } finally {
      if (jobId) {
        await supabase.from("jobs").delete().eq("id", jobId);
      }
      if (otherJobId) {
        await supabase.from("jobs").delete().eq("id", otherJobId);
      }
      if (customerId) {
        await supabase.from("customers").delete().eq("id", customerId);
      }
      if (otherCustomerId) {
        await supabase.from("customers").delete().eq("id", otherCustomerId);
      }
      if (employeeId) {
        await supabase.from("employees").delete().eq("id", employeeId);
      }
    }
  }, 20000);

  it("returns follow-up with concrete job options when multiple jobs match for one customer", async () => {
    const supabase = getSupabaseServer();
    const suffix = Date.now();
    const employeeName = `Tilda Brandner ${suffix}`;
    const customerName = `Nordstern Ausbau GmbH ${suffix}`;
    const streetName = `Morgensternpfad ${suffix}`;
    const houseNumber = "7";

    let employeeId: string | null = null;
    let customerId: string | null = null;
    const jobIds: string[] = [];

    try {
      const { data: employee, error: employeeError } = await supabase
        .from("employees")
        .insert({
          employee_number: `E-IT-${suffix}`,
          full_name: employeeName,
          role: "Dispo",
          active: true,
        })
        .select("*")
        .single();

      if (employeeError || !employee) {
        throw new Error(employeeError?.message ?? "Employee setup failed");
      }
      employeeId = employee.id;

      const { data: customer, error: customerError } = await supabase
        .from("customers")
        .insert({
          customer_number: `C-IT-${suffix}`,
          company_name: customerName,
          contact_name: customerName,
        })
        .select("*")
        .single();

      if (customerError || !customer) {
        throw new Error(customerError?.message ?? "Customer setup failed");
      }
      customerId = customer.id;

      const { data: jobOne, error: jobOneError } = await supabase
        .from("jobs")
        .insert({
          job_number: `J-IT-${suffix}-1`,
          customer_id: customer.id,
          status: "new",
          address: `${streetName} ${houseNumber} Nord, Koeln`,
          notes: "Integrationstest job_dispatch multi",
        })
        .select("*")
        .single();

      if (jobOneError || !jobOne) {
        throw new Error(jobOneError?.message ?? "Job setup failed");
      }
      jobIds.push(jobOne.id);

      const { data: jobTwo, error: jobTwoError } = await supabase
        .from("jobs")
        .insert({
          job_number: `J-IT-${suffix}-2`,
          customer_id: customer.id,
          status: "new",
          address: `${streetName} ${houseNumber} Sued, Koeln`,
          notes: "Integrationstest job_dispatch multi",
        })
        .select("*")
        .single();

      if (jobTwoError || !jobTwo) {
        throw new Error(jobTwoError?.message ?? "Job setup failed");
      }
      jobIds.push(jobTwo.id);

      const extractedArgs = JobDispatchSchema.parse({
        employeeName,
        companyName: customerName,
        street: streetName,
        houseNumber,
      });

      const result = await jobDispatchTool.execute(extractedArgs, testCtx as any, true);

      expect(result.ok).toBe(false);

      if (result.ok) {
        throw new Error("Expected follow-up result");
      }

      expect(result.code).toBe("FOLLOW_UP_REQUIRED");
      expect(result.message).toMatch(/mehrere|welchen|genau/i);
      expect(result.options ?? []).toEqual(
        expect.arrayContaining([
          expect.stringContaining(jobOne.job_number),
          expect.stringContaining(jobTwo.job_number),
        ]),
      );

      const { data: unchangedJobs, error: unchangedJobsError } = await supabase
        .from("jobs")
        .select("*")
        .in("id", jobIds);

      if (unchangedJobsError) {
        throw new Error(unchangedJobsError.message);
      }

      expect(unchangedJobs ?? []).toHaveLength(2);
      for (const job of unchangedJobs ?? []) {
        expect(job.assigned_employee_id).toBeNull();
        expect(job.status).toBe("new");
      }
    } finally {
      if (jobIds.length > 0) {
        await supabase.from("jobs").delete().in("id", jobIds);
      }
      if (customerId) {
        await supabase.from("customers").delete().eq("id", customerId);
      }
      if (employeeId) {
        await supabase.from("employees").delete().eq("id", employeeId);
      }
    }
  });

  it("returns labeled options when address matches jobs from multiple customers and no customer was provided", async () => {
    const supabase = getSupabaseServer();
    const suffix = Date.now();
    const employeeName = `Selma Kirchner ${suffix}`;
    const firstCustomerName = `Atlas Ausbau GmbH ${suffix}`;
    const secondCustomerName = `Kiesel Werkservice GmbH ${suffix}`;
    const streetName = `Hafenbogen ${suffix}`;
    const houseNumber = "7";

    let employeeId: string | null = null;
    let firstCustomerId: string | null = null;
    let secondCustomerId: string | null = null;
    const jobIds: string[] = [];

    try {
      const { data: employee, error: employeeError } = await supabase
        .from("employees")
        .insert({
          employee_number: `E-IT-${suffix}`,
          full_name: employeeName,
          role: "Dispo",
          active: true,
        })
        .select("*")
        .single();

      if (employeeError || !employee) {
        throw new Error(employeeError?.message ?? "Employee setup failed");
      }
      employeeId = employee.id;

      const { data: firstCustomer, error: firstCustomerError } = await supabase
        .from("customers")
        .insert({
          customer_number: `C-IT-${suffix}-A`,
          company_name: firstCustomerName,
          contact_name: firstCustomerName,
        })
        .select("*")
        .single();

      if (firstCustomerError || !firstCustomer) {
        throw new Error(firstCustomerError?.message ?? "First customer setup failed");
      }
      firstCustomerId = firstCustomer.id;

      const { data: secondCustomer, error: secondCustomerError } = await supabase
        .from("customers")
        .insert({
          customer_number: `C-IT-${suffix}-B`,
          company_name: secondCustomerName,
          contact_name: secondCustomerName,
        })
        .select("*")
        .single();

      if (secondCustomerError || !secondCustomer) {
        throw new Error(
          secondCustomerError?.message ?? "Second customer setup failed",
        );
      }
      secondCustomerId = secondCustomer.id;

      const { data: firstJob, error: firstJobError } = await supabase
        .from("jobs")
        .insert({
          job_number: `J-IT-${suffix}-A`,
          customer_id: firstCustomer.id,
          status: "new",
          address: `${streetName} ${houseNumber}, Koeln`,
          notes: "Integrationstest job_dispatch multi customer A",
        })
        .select("*")
        .single();

      if (firstJobError || !firstJob) {
        throw new Error(firstJobError?.message ?? "First job setup failed");
      }
      jobIds.push(firstJob.id);

      const { data: secondJob, error: secondJobError } = await supabase
        .from("jobs")
        .insert({
          job_number: `J-IT-${suffix}-B`,
          customer_id: secondCustomer.id,
          status: "new",
          address: `${streetName} ${houseNumber}, Koeln`,
          notes: "Integrationstest job_dispatch multi customer B",
        })
        .select("*")
        .single();

      if (secondJobError || !secondJob) {
        throw new Error(secondJobError?.message ?? "Second job setup failed");
      }
      jobIds.push(secondJob.id);

      const extractedArgs = JobDispatchSchema.parse({
        employeeName,
        street: streetName,
        houseNumber,
      });

      const result = await jobDispatchTool.execute(extractedArgs, testCtx as any, true);

      expect(result.ok).toBe(false);

      if (result.ok) {
        throw new Error("Expected follow-up result");
      }

      expect(result.code).toBe("FOLLOW_UP_REQUIRED");
      expect(result.message).toMatch(/mehrere|welchen|genau/i);
      expect(result.options ?? []).toEqual(
        expect.arrayContaining([
          expect.stringContaining(firstCustomerName),
          expect.stringContaining(secondCustomerName),
        ]),
      );
    } finally {
      if (jobIds.length > 0) {
        await supabase.from("jobs").delete().in("id", jobIds);
      }
      if (firstCustomerId) {
        await supabase.from("customers").delete().eq("id", firstCustomerId);
      }
      if (secondCustomerId) {
        await supabase.from("customers").delete().eq("id", secondCustomerId);
      }
      if (employeeId) {
        await supabase.from("employees").delete().eq("id", employeeId);
      }
    }
  });

  it("resolves employee names via loose normalization for umlaut variants", async () => {
    const supabase = getSupabaseServer();
    const suffix = Date.now();
    const storedEmployeeName = `J\u00fcrgen Falkner ${suffix}`;
    const extractedEmployeeName = `Juergen Falkner ${suffix}`;
    const customerName = `Morgenrot Ausbau GmbH ${suffix}`;
    const streetName = `Seebogen ${suffix}`;
    const houseNumber = "12";

    let employeeId: string | null = null;
    let customerId: string | null = null;
    let jobId: string | null = null;

    try {
      const { data: employee, error: employeeError } = await supabase
        .from("employees")
        .insert({
          employee_number: `E-IT-${suffix}`,
          full_name: storedEmployeeName,
          role: "Dispo",
          active: true,
        })
        .select("*")
        .single();

      if (employeeError || !employee) {
        throw new Error(employeeError?.message ?? "Employee setup failed");
      }
      employeeId = employee.id;

      const { data: customer, error: customerError } = await supabase
        .from("customers")
        .insert({
          customer_number: `C-IT-${suffix}`,
          company_name: customerName,
          contact_name: customerName,
        })
        .select("*")
        .single();

      if (customerError || !customer) {
        throw new Error(customerError?.message ?? "Customer setup failed");
      }
      customerId = customer.id;

      const { data: job, error: jobError } = await supabase
        .from("jobs")
        .insert({
          job_number: `J-IT-${suffix}`,
          customer_id: customer.id,
          status: "new",
          address: `${streetName} ${houseNumber}, Koeln`,
          notes: "Integrationstest job_dispatch umlaut employee",
        })
        .select("*")
        .single();

      if (jobError || !job) {
        throw new Error(jobError?.message ?? "Job setup failed");
      }
      jobId = job.id;

      const extractedArgs = JobDispatchSchema.parse({
        employeeName: extractedEmployeeName,
        companyName: customerName,
        street: streetName,
        houseNumber,
      });

      const result = await jobDispatchTool.execute(extractedArgs, testCtx as any, true);

      expect(result.ok).toBe(true);

      if (!result.ok) {
        throw new Error(`Expected success, got: ${result.message}`);
      }

      expect(result.employee.id).toBe(employee.id);
      expect(result.employee.fullName).toBe(storedEmployeeName);
      expect(result.job.id).toBe(job.id);
      expect(result.job.assigned_employee_id).toBe(employee.id);
    } finally {
      if (jobId) {
        await supabase.from("jobs").delete().eq("id", jobId);
      }
      if (customerId) {
        await supabase.from("customers").delete().eq("id", customerId);
      }
      if (employeeId) {
        await supabase.from("employees").delete().eq("id", employeeId);
      }
    }
  });

  it("returns follow-up when only a house number is available", async () => {
    const supabase = getSupabaseServer();
    const suffix = Date.now();
    const employeeName = `Nora Hagen ${suffix}`;
    const customerName = `Prisma Baukontor GmbH ${suffix}`;

    let employeeId: string | null = null;

    try {
      const { data: employee, error: employeeError } = await supabase
        .from("employees")
        .insert({
          employee_number: `E-IT-${suffix}`,
          full_name: employeeName,
          role: "Dispo",
          active: true,
        })
        .select("*")
        .single();

      if (employeeError || !employee) {
        throw new Error(employeeError?.message ?? "Employee setup failed");
      }
      employeeId = employee.id;

      const extractedArgs = JobDispatchSchema.parse({
        employeeName,
        companyName: customerName,
        houseNumber: "14",
      });

      const result = await jobDispatchTool.execute(extractedArgs, testCtx as any, true);

      expect(result.ok).toBe(false);

      if (result.ok) {
        throw new Error("Expected follow-up result");
      }

      expect(result.code).toBe("FOLLOW_UP_REQUIRED");
      expect(result.message).toMatch(/hausnummer|strasse|auftragsnummer/i);
    } finally {
      if (employeeId) {
        await supabase.from("employees").delete().eq("id", employeeId);
      }
    }
  });
});

describe("job_update integration", () => {
  it("updates address and schedule for a uniquely resolved job", async () => {
    const supabase = getSupabaseServer();
    const suffix = Date.now();
    const customerName = `Bernstein Projektbau GmbH ${suffix}`;
    const streetName = `Kastanienweg ${suffix}`;
    const houseNumber = "5";
    let customerId: string | null = null;
    let jobId: string | null = null;

    try {
      const { data: customer, error: customerError } = await supabase
        .from("customers")
        .insert({
          customer_number: `C-IT-${suffix}`,
          company_name: customerName,
          contact_name: customerName,
        })
        .select("*")
        .single();

      if (customerError || !customer) {
        throw new Error(customerError?.message ?? "Customer setup failed");
      }
      customerId = customer.id;

      const { data: job, error: jobError } = await supabase
        .from("jobs")
        .insert({
          job_number: `J-IT-${suffix}`,
          customer_id: customer.id,
          status: "new",
          address: `${streetName} ${houseNumber}, Koeln`,
        })
        .select("*")
        .single();

      if (jobError || !job) {
        throw new Error(jobError?.message ?? "Job setup failed");
      }
      jobId = job.id;

      const result = await jobUpdateTool.execute(
        {
          companyName: customerName,
          street: streetName,
          houseNumber,
          newAddress: "Neue Lindenallee 22, Bonn",
          scheduledDate: "2026-04-10",
          scheduledTime: "09:30",
          scheduledEndTime: "11:00",
        },
        testCtx as any,
        true,
      );

      expect(result.ok).toBe(true);

      if (!result.ok) {
        throw new Error(`Expected success, got: ${result.message}`);
      }

      expect(result.updatedFields).toEqual(
        expect.arrayContaining([
          "address",
          "scheduledDate",
          "scheduledTime",
          "scheduledEndTime",
        ]),
      );
      expect(result.job.address).toBe("Neue Lindenallee 22, Bonn");
      expect(result.job.status).toBe("scheduled");
      expect(result.job.scheduled_start).toBe("2026-04-10T09:30:00.000Z");
      expect(result.job.scheduled_end).toBe("2026-04-10T11:00:00.000Z");
    } finally {
      if (jobId) {
        await supabase.from("jobs").delete().eq("id", jobId);
      }
      if (customerId) {
        await supabase.from("customers").delete().eq("id", customerId);
      }
    }
  });

  it("returns follow-up when multiple jobs match the update target", async () => {
    const supabase = getSupabaseServer();
    const suffix = Date.now();
    const customerName = `Bernstein Projektbau GmbH ${suffix}`;
    const streetName = `Kastanienweg ${suffix}`;
    const houseNumber = "5";
    let customerId: string | null = null;
    const jobIds: string[] = [];

    try {
      const { data: customer, error: customerError } = await supabase
        .from("customers")
        .insert({
          customer_number: `C-IT-${suffix}`,
          company_name: customerName,
          contact_name: customerName,
        })
        .select("*")
        .single();

      if (customerError || !customer) {
        throw new Error(customerError?.message ?? "Customer setup failed");
      }
      customerId = customer.id;

      const { data: firstJob, error: firstJobError } = await supabase
        .from("jobs")
        .insert({
          job_number: `J-IT-${suffix}-A`,
          customer_id: customer.id,
          status: "new",
          address: `${streetName} ${houseNumber} Nord, Koeln`,
        })
        .select("*")
        .single();

      if (firstJobError || !firstJob) {
        throw new Error(firstJobError?.message ?? "First job setup failed");
      }
      jobIds.push(firstJob.id);

      const { data: secondJob, error: secondJobError } = await supabase
        .from("jobs")
        .insert({
          job_number: `J-IT-${suffix}-B`,
          customer_id: customer.id,
          status: "new",
          address: `${streetName} ${houseNumber} Sued, Koeln`,
        })
        .select("*")
        .single();

      if (secondJobError || !secondJob) {
        throw new Error(secondJobError?.message ?? "Second job setup failed");
      }
      jobIds.push(secondJob.id);

      const result = await jobUpdateTool.execute(
        {
          companyName: customerName,
          street: streetName,
          houseNumber,
          status: "done",
        },
        testCtx as any,
        true,
      );

      expect(result.ok).toBe(false);

      if (result.ok) {
        throw new Error("Expected follow-up result");
      }

      expect(result.code).toBe("FOLLOW_UP_REQUIRED");
      expect(result.message).toMatch(/mehrere|welchen|genau/i);
      expect(result.options ?? []).toEqual(
        expect.arrayContaining([
          expect.stringContaining(firstJob.job_number),
          expect.stringContaining(secondJob.job_number),
        ]),
      );
    } finally {
      if (jobIds.length > 0) {
        await supabase.from("jobs").delete().in("id", jobIds);
      }
      if (customerId) {
        await supabase.from("customers").delete().eq("id", customerId);
      }
    }
  });

  it("rejects reopening a completed job via generic update", async () => {
    const supabase = getSupabaseServer();
    const suffix = Date.now();
    const customerName = `Bernstein Projektbau GmbH ${suffix}`;
    const streetName = `Kastanienweg ${suffix}`;
    const houseNumber = "5";
    let customerId: string | null = null;
    let jobId: string | null = null;

    try {
      const { data: customer, error: customerError } = await supabase
        .from("customers")
        .insert({
          customer_number: `C-IT-${suffix}`,
          company_name: customerName,
          contact_name: customerName,
        })
        .select("*")
        .single();

      if (customerError || !customer) {
        throw new Error(customerError?.message ?? "Customer setup failed");
      }
      customerId = customer.id;

      const { data: job, error: jobError } = await supabase
        .from("jobs")
        .insert({
          job_number: `J-IT-${suffix}`,
          customer_id: customer.id,
          status: "done",
          address: `${streetName} ${houseNumber}, Koeln`,
        })
        .select("*")
        .single();

      if (jobError || !job) {
        throw new Error(jobError?.message ?? "Job setup failed");
      }
      jobId = job.id;

      const result = await jobUpdateTool.execute(
        {
          companyName: customerName,
          street: streetName,
          houseNumber,
          status: "scheduled",
        },
        testCtx as any,
        true,
      );

      expect(result.ok).toBe(false);

      if (result.ok) {
        throw new Error("Expected guarded failure result");
      }

      expect(result.code).toBe("JOB_UPDATE_FAILED");
      expect(result.message).toMatch(/nicht erlaubt/i);
    } finally {
      if (jobId) {
        await supabase.from("jobs").delete().eq("id", jobId);
      }
      if (customerId) {
        await supabase.from("customers").delete().eq("id", customerId);
      }
    }
  });
});

describe("job_complete integration", () => {
  it("marks a uniquely resolved job as done", async () => {
    const supabase = getSupabaseServer();
    const suffix = Date.now();
    const customerName = `Kupferbogen Projekt GmbH ${suffix}`;
    const streetName = `Lerchenpfad ${suffix}`;
    const houseNumber = "8";
    let customerId: string | null = null;
    let jobId: string | null = null;

    try {
      const { data: customer, error: customerError } = await supabase
        .from("customers")
        .insert({
          customer_number: `C-IT-${suffix}`,
          company_name: customerName,
          contact_name: customerName,
        })
        .select("*")
        .single();

      if (customerError || !customer) {
        throw new Error(customerError?.message ?? "Customer setup failed");
      }
      customerId = customer.id;

      const { data: job, error: jobError } = await supabase
        .from("jobs")
        .insert({
          job_number: `J-IT-${suffix}`,
          customer_id: customer.id,
          status: "scheduled",
          address: `${streetName} ${houseNumber}, Koeln`,
        })
        .select("*")
        .single();

      if (jobError || !job) {
        throw new Error(jobError?.message ?? "Job setup failed");
      }
      jobId = job.id;

      const result = await jobCompleteTool.execute(
        {
          companyName: customerName,
          street: streetName,
          houseNumber,
        },
        testCtx as any,
        true,
      );

      expect(result.ok).toBe(true);

      if (!result.ok) {
        throw new Error(`Expected success, got: ${result.message}`);
      }

      expect(result.job.status).toBe("done");
      expect(result.job.scheduled_end).toBeTruthy();
    } finally {
      if (jobId) {
        await supabase.from("jobs").delete().eq("id", jobId);
      }
      if (customerId) {
        await supabase.from("customers").delete().eq("id", customerId);
      }
    }
  });
});

describe("note_create integration", () => {
  it("appends a note to the uniquely resolved job and preserves existing notes", async () => {
    const supabase = getSupabaseServer();
    const suffix = Date.now();
    const customerName = `Bernstein Ausbau GmbH ${suffix}`;
    const streetName = `Birkenweg ${suffix}`;
    const houseNumber = "9";
    let customerId: string | null = null;
    let jobId: string | null = null;

    try {
      const { data: customer, error: customerError } = await supabase
        .from("customers")
        .insert({
          customer_number: `C-IT-${suffix}`,
          company_name: customerName,
          contact_name: customerName,
        })
        .select("*")
        .single();

      if (customerError || !customer) {
        throw new Error(customerError?.message ?? "Customer setup failed");
      }
      customerId = customer.id;

      const existingNote = "Bestehende Notiz";
      const { data: job, error: jobError } = await supabase
        .from("jobs")
        .insert({
          job_number: `J-IT-${suffix}`,
          customer_id: customer.id,
          status: "new",
          address: `${streetName} ${houseNumber}, Koeln`,
          notes: existingNote,
        })
        .select("*")
        .single();

      if (jobError || !job) {
        throw new Error(jobError?.message ?? "Job setup failed");
      }
      jobId = job.id;

      const result = await noteCreateTool.execute(
        {
          noteText: "Kunde bittet um Rueckruf vor Anfahrt.",
          companyName: customerName,
          street: streetName,
          houseNumber,
        },
        testCtx as any,
        true,
      );

      expect(result.ok).toBe(true);

      if (!result.ok) {
        throw new Error(`Expected success, got: ${result.message}`);
      }

      expect(result.job.id).toBe(job.id);
      expect(result.appendedNote).toMatch(/kunde bittet um rueckruf vor anfahrt\./i);
      expect(result.job.notes).toContain(existingNote);
      expect(result.job.notes).toContain("Kunde bittet um Rueckruf vor Anfahrt.");
      expect(result.job.notes).toContain(result.appendedNote);
    } finally {
      if (jobId) {
        await supabase.from("jobs").delete().eq("id", jobId);
      }
      if (customerId) {
        await supabase.from("customers").delete().eq("id", customerId);
      }
    }
  });

  it("returns follow-up when multiple jobs match the note target", async () => {
    const supabase = getSupabaseServer();
    const suffix = Date.now();
    const customerName = `Bernstein Ausbau GmbH ${suffix}`;
    const streetName = `Birkenweg ${suffix}`;
    const houseNumber = "9";
    let customerId: string | null = null;
    const jobIds: string[] = [];

    try {
      const { data: customer, error: customerError } = await supabase
        .from("customers")
        .insert({
          customer_number: `C-IT-${suffix}`,
          company_name: customerName,
          contact_name: customerName,
        })
        .select("*")
        .single();

      if (customerError || !customer) {
        throw new Error(customerError?.message ?? "Customer setup failed");
      }
      customerId = customer.id;

      const { data: firstJob, error: firstJobError } = await supabase
        .from("jobs")
        .insert({
          job_number: `J-IT-${suffix}-A`,
          customer_id: customer.id,
          status: "new",
          address: `${streetName} ${houseNumber} Nord, Koeln`,
        })
        .select("*")
        .single();

      if (firstJobError || !firstJob) {
        throw new Error(firstJobError?.message ?? "First job setup failed");
      }
      jobIds.push(firstJob.id);

      const { data: secondJob, error: secondJobError } = await supabase
        .from("jobs")
        .insert({
          job_number: `J-IT-${suffix}-B`,
          customer_id: customer.id,
          status: "new",
          address: `${streetName} ${houseNumber} Sued, Koeln`,
        })
        .select("*")
        .single();

      if (secondJobError || !secondJob) {
        throw new Error(secondJobError?.message ?? "Second job setup failed");
      }
      jobIds.push(secondJob.id);

      const result = await noteCreateTool.execute(
        {
          noteText: "Material bitte vorher pruefen.",
          companyName: customerName,
          street: streetName,
          houseNumber,
        },
        testCtx as any,
        true,
      );

      expect(result.ok).toBe(false);

      if (result.ok) {
        throw new Error("Expected follow-up result");
      }

      expect(result.code).toBe("FOLLOW_UP_REQUIRED");
      expect(result.message).toMatch(/mehrere|welchen|genau/i);
      expect(result.options ?? []).toEqual(
        expect.arrayContaining([
          expect.stringContaining(firstJob.job_number),
          expect.stringContaining(secondJob.job_number),
        ]),
      );

      const { data: unchangedJobs, error: unchangedJobsError } = await supabase
        .from("jobs")
        .select("*")
        .in("id", jobIds);

      if (unchangedJobsError) {
        throw new Error(unchangedJobsError.message);
      }

      for (const job of unchangedJobs ?? []) {
        expect(job.notes).toBeNull();
      }
    } finally {
      if (jobIds.length > 0) {
        await supabase.from("jobs").delete().in("id", jobIds);
      }
      if (customerId) {
        await supabase.from("customers").delete().eq("id", customerId);
      }
    }
  });

  it("returns follow-up when the note target only contains a house number", async () => {
    const result = await noteCreateTool.execute(
      {
        noteText: "Schluessel liegt im Briefkasten.",
        houseNumber: "14",
        companyName: "Kupferhain Ausbau GmbH",
      },
      testCtx as any,
      true,
    );

    expect(result.ok).toBe(false);

    if (result.ok) {
      throw new Error("Expected follow-up result");
    }

    expect(result.code).toBe("FOLLOW_UP_REQUIRED");
    expect(result.message).toMatch(/hausnummer|strasse|auftragsnummer/i);
  });
});

describe("job_lookup integration", () => {
  it("returns full job info for a uniquely resolved job", async () => {
    const supabase = getSupabaseServer();
    const suffix = Date.now();
    const customerName = `Aegidius Projektservice GmbH ${suffix}`;
    const employeeName = `Lea Hofmeister ${suffix}`;
    const streetName = `Aegidiusstrasse ${suffix}`;
    const houseNumber = "12";
    let customerId: string | null = null;
    let employeeId: string | null = null;
    let jobId: string | null = null;

    try {
      const { data: customer, error: customerError } = await supabase
        .from("customers")
        .insert({
          customer_number: `C-IT-${suffix}`,
          company_name: customerName,
          contact_name: customerName,
        })
        .select("*")
        .single();

      if (customerError || !customer) {
        throw new Error(customerError?.message ?? "Customer setup failed");
      }
      customerId = customer.id;

      const { data: employee, error: employeeError } = await supabase
        .from("employees")
        .insert({
          employee_number: `E-IT-${suffix}`,
          full_name: employeeName,
          role: "Dispo",
          active: true,
        })
        .select("*")
        .single();

      if (employeeError || !employee) {
        throw new Error(employeeError?.message ?? "Employee setup failed");
      }
      employeeId = employee.id;

      const existingNote = "Rueckmeldung vom Kunden liegt vor.";
      const { data: job, error: jobError } = await supabase
        .from("jobs")
        .insert({
          job_number: `J-IT-${suffix}`,
          customer_id: customer.id,
          assigned_employee_id: employee.id,
          status: "scheduled",
          address: `${streetName} ${houseNumber}, Koeln`,
          notes: existingNote,
        })
        .select("*")
        .single();

      if (jobError || !job) {
        throw new Error(jobError?.message ?? "Job setup failed");
      }
      jobId = job.id;

      const result = await jobLookupTool.execute(
        {
          companyName: customerName,
          street: streetName,
          houseNumber,
        },
        testCtx as any,
        true,
      );

      expect(result.ok).toBe(true);

      if (!result.ok) {
        throw new Error(`Expected success, got: ${result.message}`);
      }

      expect(result.job.id).toBe(job.id);
      expect(result.job.address).toContain(streetName);
      expect(result.job.address).toContain(houseNumber);
      expect(result.job.status).toBe("scheduled");
      expect(result.job.notes).toContain(existingNote);
      expect(result.customerName).toBe(customerName);
      expect(result.assignedEmployeeName).toBe(employeeName);
    } finally {
      if (jobId) {
        await supabase.from("jobs").delete().eq("id", jobId);
      }
      if (customerId) {
        await supabase.from("customers").delete().eq("id", customerId);
      }
      if (employeeId) {
        await supabase.from("employees").delete().eq("id", employeeId);
      }
    }
  });

  it("returns follow-up when multiple jobs match the lookup target", async () => {
    const supabase = getSupabaseServer();
    const suffix = Date.now();
    const customerName = `Aegidius Projektservice GmbH ${suffix}`;
    const streetName = `Aegidiusstrasse ${suffix}`;
    const houseNumber = "12";
    let customerId: string | null = null;
    const jobIds: string[] = [];

    try {
      const { data: customer, error: customerError } = await supabase
        .from("customers")
        .insert({
          customer_number: `C-IT-${suffix}`,
          company_name: customerName,
          contact_name: customerName,
        })
        .select("*")
        .single();

      if (customerError || !customer) {
        throw new Error(customerError?.message ?? "Customer setup failed");
      }
      customerId = customer.id;

      const { data: firstJob, error: firstJobError } = await supabase
        .from("jobs")
        .insert({
          job_number: `J-IT-${suffix}-A`,
          customer_id: customer.id,
          status: "new",
          address: `${streetName} ${houseNumber} Nord, Koeln`,
        })
        .select("*")
        .single();

      if (firstJobError || !firstJob) {
        throw new Error(firstJobError?.message ?? "First job setup failed");
      }
      jobIds.push(firstJob.id);

      const { data: secondJob, error: secondJobError } = await supabase
        .from("jobs")
        .insert({
          job_number: `J-IT-${suffix}-B`,
          customer_id: customer.id,
          status: "new",
          address: `${streetName} ${houseNumber} Sued, Koeln`,
        })
        .select("*")
        .single();

      if (secondJobError || !secondJob) {
        throw new Error(secondJobError?.message ?? "Second job setup failed");
      }
      jobIds.push(secondJob.id);

      const result = await jobLookupTool.execute(
        {
          companyName: customerName,
          street: streetName,
          houseNumber,
        },
        testCtx as any,
        true,
      );

      expect(result.ok).toBe(false);

      if (result.ok) {
        throw new Error("Expected follow-up result");
      }

      expect(result.code).toBe("FOLLOW_UP_REQUIRED");
      expect(result.message).toMatch(/mehrere|welchen|genau/i);
      expect(result.options ?? []).toEqual(
        expect.arrayContaining([
          expect.stringContaining(firstJob.job_number),
          expect.stringContaining(secondJob.job_number),
        ]),
      );
    } finally {
      if (jobIds.length > 0) {
        await supabase.from("jobs").delete().in("id", jobIds);
      }
      if (customerId) {
        await supabase.from("customers").delete().eq("id", customerId);
      }
    }
  });

  it("returns follow-up when the lookup target only contains a house number", async () => {
    const result = await jobLookupTool.execute(
      {
        companyName: "Kupferhain Ausbau GmbH",
        houseNumber: "14",
      },
      testCtx as any,
      true,
    );

    expect(result.ok).toBe(false);

    if (result.ok) {
      throw new Error("Expected follow-up result");
    }

    expect(result.code).toBe("FOLLOW_UP_REQUIRED");
    expect(result.message).toMatch(/hausnummer|strasse|auftragsnummer/i);
  });
});
