import { describe, expect, it } from "vitest";
import dotenv from "dotenv";
import { brainAgent } from "@/features/ai/brain/brain.agent";
import { getSupabaseServer } from "@/services/supabase/server";
import type { NormalizedMessage } from "@/features/messaging/schemas/normalized-message";

dotenv.config({ path: ".env.local", override: true });

type TestRecordIds = {
  employeeIds: string[];
  customerIds: string[];
  jobIds: string[];
};

async function cleanupTestRecords(ids: TestRecordIds): Promise<void> {
  const supabase = getSupabaseServer();

  if (ids.jobIds.length > 0) {
    await supabase.from("jobs").delete().in("id", ids.jobIds);
  }
  if (ids.customerIds.length > 0) {
    await supabase.from("customers").delete().in("id", ids.customerIds);
  }
  if (ids.employeeIds.length > 0) {
    await supabase.from("employees").delete().in("id", ids.employeeIds);
  }
}

// Remove .skip carefully: these tests call real OpenAI + real Supabase and generate costs.
describe("AI integration: job_dispatch (skipped by default)", () => {
  it.skip("dispatches successfully for a clear prompt (street + customer + employee)", async () => {
    const supabase = getSupabaseServer();
    const suffix = Date.now();
    const ids: TestRecordIds = {
      employeeIds: [],
      customerIds: [],
      jobIds: [],
    };

    const employeeName = "Zora Feldkamp";
    const customerName = "Quarzlicht Montage GmbH";
    const otherCustomerName = "Polygon Werkservice GmbH";
    const street = "Kornblumenpfad 14";

    try {
      const { data: employee } = await supabase
        .from("employees")
        .insert({
          employee_number: `E-AI-${suffix}`,
          full_name: employeeName,
          role: "Dispo",
          active: true,
        })
        .select("*")
        .single();
      if (!employee) throw new Error("Employee setup failed");
      ids.employeeIds.push(employee.id);

      const { data: customer } = await supabase
        .from("customers")
        .insert({
          customer_number: `C-AI-${suffix}`,
          company_name: customerName,
          contact_name: customerName,
        })
        .select("*")
        .single();
      if (!customer) throw new Error("Customer setup failed");
      ids.customerIds.push(customer.id);

      const { data: otherCustomer } = await supabase
        .from("customers")
        .insert({
          customer_number: `C-AI-${suffix}-ALT`,
          company_name: otherCustomerName,
          contact_name: otherCustomerName,
        })
        .select("*")
        .single();
      if (!otherCustomer) throw new Error("Other customer setup failed");
      ids.customerIds.push(otherCustomer.id);

      const { data: targetJob } = await supabase
        .from("jobs")
        .insert({
          job_number: `J-AI-${suffix}`,
          customer_id: customer.id,
          status: "new",
          address: `${street}, Koeln`,
          notes: "AI integration success case",
        })
        .select("*")
        .single();
      if (!targetJob) throw new Error("Target job setup failed");
      ids.jobIds.push(targetJob.id);

      const { data: otherJob } = await supabase
        .from("jobs")
        .insert({
          job_number: `J-AI-${suffix}-ALT`,
          customer_id: otherCustomer.id,
          status: "new",
          address: `${street}, Koeln`,
          notes: "AI integration same street different customer",
        })
        .select("*")
        .single();
      if (!otherJob) throw new Error("Other job setup failed");
      ids.jobIds.push(otherJob.id);

      const prompt = `Weise dem Auftrag in der ${street} fuer Kunde ${customerName} die Mitarbeiterin ${employeeName} zu.`;

      const result = await brainAgent.process({
        chatId: `ai-test-${suffix}`,
        text: prompt,
        brainContext: {
          locale: "de-DE",
          timezone: "Europe/Berlin",
        },
        debug: true,
      });

      expect(result.toolNames ?? []).toContain("job_dispatch");
      expect(result.finalOutput).toBeTypeOf("string");
      expect(result.finalOutput.length).toBeGreaterThan(0);

      const { data: updatedJob } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", targetJob.id)
        .single();
      if (!updatedJob) throw new Error("Could not reload updated job");

      expect(updatedJob.assigned_employee_id).toBe(employee.id);
      expect(updatedJob.status).toBe("scheduled");
    } finally {
      await cleanupTestRecords(ids);
    }
  }, 60000);

  it.skip("asks follow-up when prompt is ambiguous (multiple matching jobs)", async () => {
    const supabase = getSupabaseServer();
    const suffix = Date.now();
    const ids: TestRecordIds = {
      employeeIds: [],
      customerIds: [],
      jobIds: [],
    };

    const employeeName = "Zora Feldkamp";
    const customerName = "Quarzlicht Montage GmbH";
    const street = "Kornblumenpfad 14";

    try {
      const { data: employee } = await supabase
        .from("employees")
        .insert({
          employee_number: `E-AI-${suffix}`,
          full_name: employeeName,
          role: "Dispo",
          active: true,
        })
        .select("*")
        .single();
      if (!employee) throw new Error("Employee setup failed");
      ids.employeeIds.push(employee.id);

      const { data: customer } = await supabase
        .from("customers")
        .insert({
          customer_number: `C-AI-${suffix}`,
          company_name: customerName,
          contact_name: customerName,
        })
        .select("*")
        .single();
      if (!customer) throw new Error("Customer setup failed");
      ids.customerIds.push(customer.id);

      const { data: jobA } = await supabase
        .from("jobs")
        .insert({
          job_number: `J-AI-${suffix}-A`,
          customer_id: customer.id,
          status: "new",
          address: `${street} Nord, Koeln`,
          notes: "AI ambiguity case A",
        })
        .select("*")
        .single();
      if (!jobA) throw new Error("Job A setup failed");
      ids.jobIds.push(jobA.id);

      const { data: jobB } = await supabase
        .from("jobs")
        .insert({
          job_number: `J-AI-${suffix}-B`,
          customer_id: customer.id,
          status: "new",
          address: `${street} Sued, Koeln`,
          notes: "AI ambiguity case B",
        })
        .select("*")
        .single();
      if (!jobB) throw new Error("Job B setup failed");
      ids.jobIds.push(jobB.id);

      const prompt = `Weise ${employeeName} dem Auftrag in ${street} fuer Kunde ${customerName} zu.`;

      const result = await brainAgent.process({
        chatId: `ai-test-${suffix}`,
        text: prompt,
        brainContext: {
          locale: "de-DE",
          timezone: "Europe/Berlin",
        },
        debug: true,
      });

      expect(result.toolNames ?? []).toContain("job_dispatch");
      expect(result.finalOutput).toMatch(/mehrere|welchen|genau/i);

      const { data: unchangedJobs } = await supabase
        .from("jobs")
        .select("*")
        .in("id", ids.jobIds);
      expect((unchangedJobs ?? []).length).toBe(2);
      for (const job of unchangedJobs ?? []) {
        expect(job.assigned_employee_id).toBeNull();
        expect(job.status).toBe("new");
      }
    } finally {
      await cleanupTestRecords(ids);
    }
  }, 60000);

  it.skip("resolves ambiguity through a follow-up selection and dispatches the chosen job", async () => {
    const supabase = getSupabaseServer();
    const suffix = Date.now();
    const chatId = `ai-test-followup-${suffix}`;
    const ids: TestRecordIds = {
      employeeIds: [],
      customerIds: [],
      jobIds: [],
    };

    const employeeName = "Zora Feldkamp";
    const customerName = "Quarzlicht Montage GmbH";
    const street = "Kornblumenpfad 14";

    try {
      const { data: employee } = await supabase
        .from("employees")
        .insert({
          employee_number: `E-AI-${suffix}`,
          full_name: employeeName,
          role: "Dispo",
          active: true,
        })
        .select("*")
        .single();
      if (!employee) throw new Error("Employee setup failed");
      ids.employeeIds.push(employee.id);

      const { data: customer } = await supabase
        .from("customers")
        .insert({
          customer_number: `C-AI-${suffix}`,
          company_name: customerName,
          contact_name: customerName,
        })
        .select("*")
        .single();
      if (!customer) throw new Error("Customer setup failed");
      ids.customerIds.push(customer.id);

      const { data: jobA } = await supabase
        .from("jobs")
        .insert({
          job_number: `J-AI-${suffix}-A`,
          customer_id: customer.id,
          status: "new",
          address: `${street} Nord, Koeln`,
          notes: "AI follow-up case A",
        })
        .select("*")
        .single();
      if (!jobA) throw new Error("Job A setup failed");
      ids.jobIds.push(jobA.id);

      const { data: jobB } = await supabase
        .from("jobs")
        .insert({
          job_number: `J-AI-${suffix}-B`,
          customer_id: customer.id,
          status: "new",
          address: `${street} Sued, Koeln`,
          notes: "AI follow-up case B",
        })
        .select("*")
        .single();
      if (!jobB) throw new Error("Job B setup failed");
      ids.jobIds.push(jobB.id);

      const firstPrompt = `Weise ${employeeName} dem Auftrag in ${street} fuer Kunde ${customerName} zu.`;
      const firstResult = await brainAgent.process({
        chatId,
        text: firstPrompt,
        brainContext: {
          locale: "de-DE",
          timezone: "Europe/Berlin",
        },
        debug: true,
      });

      expect(firstResult.toolNames ?? []).toContain("job_dispatch");
      expect(firstResult.finalOutput).toMatch(/mehrere|welchen|genau/i);
      expect(firstResult.finalOutput).not.toMatch(/keinen passenden auftrag/i);

      const secondPrompt = `Nimm den Auftrag ${jobA.job_number}.`;
      const secondResult = await brainAgent.process({
        chatId,
        text: secondPrompt,
        brainContext: {
          locale: "de-DE",
          timezone: "Europe/Berlin",
        },
        debug: true,
      });

      expect(secondResult.toolNames ?? []).toContain("job_dispatch");
      expect(secondResult.finalOutput).toMatch(
        new RegExp(`auftrag\\s+${jobA.job_number}`, "i"),
      );

      const { data: refreshedA } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", jobA.id)
        .single();
      if (!refreshedA) throw new Error("Could not reload job A");

      const { data: refreshedB } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", jobB.id)
        .single();
      if (!refreshedB) throw new Error("Could not reload job B");

      expect(refreshedA.assigned_employee_id).toBe(employee.id);
      expect(refreshedA.status).toBe("scheduled");
      expect(refreshedB.assigned_employee_id).toBeNull();
      expect(refreshedB.status).toBe("new");
    } finally {
      await cleanupTestRecords(ids);
    }
  }, 60000);

  it.skip("asks for the customer first and dispatches after a follow-up when street + house number are ambiguous", async () => {
    const supabase = getSupabaseServer();
    const suffix = Date.now();
    const chatId = `ai-test-customer-followup-${suffix}`;
    const ids: TestRecordIds = {
      employeeIds: [],
      customerIds: [],
      jobIds: [],
    };

    const employeeName = "Mareike Sonnfeld";
    const firstCustomerName = "Kupferhain Ausbau GmbH";
    const secondCustomerName = "Silberufer Montage GmbH";
    const street = "Mondgasse 14";

    try {
      const { data: employee } = await supabase
        .from("employees")
        .insert({
          employee_number: `E-AI-${suffix}`,
          full_name: employeeName,
          role: "Dispo",
          active: true,
        })
        .select("*")
        .single();
      if (!employee) throw new Error("Employee setup failed");
      ids.employeeIds.push(employee.id);

      const { data: firstCustomer } = await supabase
        .from("customers")
        .insert({
          customer_number: `C-AI-${suffix}-A`,
          company_name: firstCustomerName,
          contact_name: firstCustomerName,
        })
        .select("*")
        .single();
      if (!firstCustomer) throw new Error("First customer setup failed");
      ids.customerIds.push(firstCustomer.id);

      const { data: secondCustomer } = await supabase
        .from("customers")
        .insert({
          customer_number: `C-AI-${suffix}-B`,
          company_name: secondCustomerName,
          contact_name: secondCustomerName,
        })
        .select("*")
        .single();
      if (!secondCustomer) throw new Error("Second customer setup failed");
      ids.customerIds.push(secondCustomer.id);

      const { data: firstJob } = await supabase
        .from("jobs")
        .insert({
          job_number: `J-AI-${suffix}-A`,
          customer_id: firstCustomer.id,
          status: "new",
          address: `${street}, Koeln`,
          notes: "AI customer follow-up case A",
        })
        .select("*")
        .single();
      if (!firstJob) throw new Error("First job setup failed");
      ids.jobIds.push(firstJob.id);

      const { data: secondJob } = await supabase
        .from("jobs")
        .insert({
          job_number: `J-AI-${suffix}-B`,
          customer_id: secondCustomer.id,
          status: "new",
          address: `${street}, Koeln`,
          notes: "AI customer follow-up case B",
        })
        .select("*")
        .single();
      if (!secondJob) throw new Error("Second job setup failed");
      ids.jobIds.push(secondJob.id);

      const firstPrompt = `Weise ${employeeName} dem Auftrag in der ${street} zu.`;
      const firstResult = await brainAgent.process({
        chatId,
        text: firstPrompt,
        brainContext: {
          locale: "de-DE",
          timezone: "Europe/Berlin",
        },
        debug: true,
      });

      expect(firstResult.finalOutput).toMatch(/mehrere|welchen|kunde|auftrag|genau/i);

      const { data: unchangedJobs } = await supabase
        .from("jobs")
        .select("*")
        .in("id", ids.jobIds);
      expect((unchangedJobs ?? []).length).toBe(2);
      for (const job of unchangedJobs ?? []) {
        expect(job.assigned_employee_id).toBeNull();
        expect(job.status).toBe("new");
      }

      const secondPrompt = `Fuer Kunde ${firstCustomerName}.`;
      const secondResult = await brainAgent.process({
        chatId,
        text: secondPrompt,
        brainContext: {
          locale: "de-DE",
          timezone: "Europe/Berlin",
        },
        debug: true,
      });

      expect(secondResult.toolNames ?? []).toContain("job_dispatch");
      expect(secondResult.finalOutput).toMatch(/mareike sonnfeld/i);
      expect(secondResult.finalOutput).toMatch(/mondgasse 14/i);
      expect(secondResult.finalOutput).toMatch(/kupferhain ausbau gmbh/i);
      expect(secondResult.finalOutput).toMatch(/zugewiesen|eingeplant|disponiert/i);
      expect(secondResult.finalOutput).not.toMatch(/keinen passenden auftrag/i);
      expect(secondResult.finalOutput).not.toMatch(/welchen|mehrere/i);

      const { data: refreshedFirstJob } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", firstJob.id)
        .single();
      if (!refreshedFirstJob) throw new Error("Could not reload first job");

      const { data: refreshedSecondJob } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", secondJob.id)
        .single();
      if (!refreshedSecondJob) throw new Error("Could not reload second job");

      expect(refreshedFirstJob.assigned_employee_id).toBe(employee.id);
      expect(refreshedFirstJob.status).toBe("scheduled");
      expect(refreshedSecondJob.assigned_employee_id).toBeNull();
      expect(refreshedSecondJob.status).toBe("new");
    } finally {
      await cleanupTestRecords(ids);
    }
  }, 60000);

  it.skip("asks follow-up when prompt has too little information", async () => {
    const suffix = Date.now();
    const prompt = "Weise Zora Feldkamp dem Auftrag zu.";

    const result = await brainAgent.process({
      chatId: `ai-test-${suffix}`,
      text: prompt,
      brainContext: {
        locale: "de-DE",
        timezone: "Europe/Berlin",
      },
      debug: true,
    });

    expect(result.finalOutput).toBeTypeOf("string");
    expect(result.finalOutput).toMatch(/auftragsnummer|kunde|adresse|strasse|welchen/i);
  }, 60000);
});

describe("AI integration: note_create (skipped by default)", () => {
  it.skip("adds a note to a clearly identified job", async () => {
    const supabase = getSupabaseServer();
    const suffix = Date.now();
    const ids: TestRecordIds = {
      employeeIds: [],
      customerIds: [],
      jobIds: [],
    };

    const customerName = "Parklicht Service GmbH";
    const street = "Mohnallee 8";
    const noteText = "Zugang nur ueber den Hof.";

    try {
      const { data: customer } = await supabase
        .from("customers")
        .insert({
          customer_number: `C-AI-${suffix}`,
          company_name: customerName,
          contact_name: customerName,
        })
        .select("*")
        .single();
      if (!customer) throw new Error("Customer setup failed");
      ids.customerIds.push(customer.id);

      const { data: job } = await supabase
        .from("jobs")
        .insert({
          job_number: `J-AI-${suffix}`,
          customer_id: customer.id,
          status: "new",
          address: `${street}, Koeln`,
          notes: "Bestehende Notiz",
        })
        .select("*")
        .single();
      if (!job) throw new Error("Job setup failed");
      ids.jobIds.push(job.id);

      const prompt = `Fuege dem Auftrag in der ${street} fuer Kunde ${customerName} die Notiz hinzu: ${noteText}`;

      const result = await brainAgent.process({
        chatId: `ai-note-test-${suffix}`,
        text: prompt,
        brainContext: {
          locale: "de-DE",
          timezone: "Europe/Berlin",
        },
        debug: true,
      });

      expect(result.toolNames ?? []).toContain("note_create");
      expect(result.finalOutput).toMatch(/notiz|hinzugefuegt|auftrag/i);

      const { data: updatedJob } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", job.id)
        .single();
      if (!updatedJob) throw new Error("Could not reload updated job");

      expect(updatedJob.notes).toContain("Bestehende Notiz");
      expect(updatedJob.notes).toContain(noteText);
    } finally {
      await cleanupTestRecords(ids);
    }
  }, 60000);
});

describe("AI integration: job_lookup (skipped by default)", () => {
  it.skip("returns address and status for a clearly identified job", async () => {
    const supabase = getSupabaseServer();
    const suffix = Date.now();
    const ids: TestRecordIds = {
      employeeIds: [],
      customerIds: [],
      jobIds: [],
    };

    const customerName = "Heinz Mueller Projektservice";
    const street = "Aegidiusstrasse 12";
    const noteText = "Ruecksprache mit Kunde erfolgt.";

    try {
      const { data: customer } = await supabase
        .from("customers")
        .insert({
          customer_number: `C-AI-${suffix}`,
          company_name: customerName,
          contact_name: customerName,
        })
        .select("*")
        .single();
      if (!customer) throw new Error("Customer setup failed");
      ids.customerIds.push(customer.id);

      const { data: job } = await supabase
        .from("jobs")
        .insert({
          job_number: `J-AI-${suffix}`,
          customer_id: customer.id,
          status: "scheduled",
          address: `${street}, Koeln`,
          notes: noteText,
        })
        .select("*")
        .single();
      if (!job) throw new Error("Job setup failed");
      ids.jobIds.push(job.id);

      const prompt = `Wie ist die Adresse vom Projekt fuer Kunde ${customerName}?`;

      const result = await brainAgent.process({
        chatId: `ai-job-lookup-${suffix}`,
        text: prompt,
        brainContext: {
          locale: "de-DE",
          timezone: "Europe/Berlin",
        },
        debug: true,
      });

      expect(result.toolNames ?? []).toContain("job_lookup");
      expect(result.finalOutput).toMatch(/aegidiusstrasse 12/i);
      expect(result.finalOutput).toMatch(/heinz mueller projektservice/i);
      expect(result.finalOutput).toMatch(/adresse|status|auftrag|projekt/i);
    } finally {
      await cleanupTestRecords(ids);
    }
  }, 60000);

  it.skip("asks for the right project when one customer has multiple jobs and does not ask for the address itself", async () => {
    const supabase = getSupabaseServer();
    const suffix = Date.now();
    const ids: TestRecordIds = {
      employeeIds: [],
      customerIds: [],
      jobIds: [],
    };

    const customerName = "Heinz Mueller Projektservice";
    const firstStreet = "Aegidiusstrasse 12";
    const secondStreet = "Mondgasse 14";

    try {
      const { data: customer } = await supabase
        .from("customers")
        .insert({
          customer_number: `C-AI-${suffix}`,
          company_name: customerName,
          contact_name: customerName,
        })
        .select("*")
        .single();
      if (!customer) throw new Error("Customer setup failed");
      ids.customerIds.push(customer.id);

      const { data: firstJob } = await supabase
        .from("jobs")
        .insert({
          job_number: `J-AI-${suffix}-A`,
          customer_id: customer.id,
          status: "new",
          address: `${firstStreet}, Koeln`,
          notes: "AI lookup ambiguity case A",
        })
        .select("*")
        .single();
      if (!firstJob) throw new Error("First job setup failed");
      ids.jobIds.push(firstJob.id);

      const { data: secondJob } = await supabase
        .from("jobs")
        .insert({
          job_number: `J-AI-${suffix}-B`,
          customer_id: customer.id,
          status: "scheduled",
          address: `${secondStreet}, Koeln`,
          notes: "AI lookup ambiguity case B",
        })
        .select("*")
        .single();
      if (!secondJob) throw new Error("Second job setup failed");
      ids.jobIds.push(secondJob.id);

      const prompt = `Wie ist die Adresse vom Projekt fuer Kunde ${customerName}?`;

      const result = await brainAgent.process({
        chatId: `ai-job-lookup-ambiguous-${suffix}`,
        text: prompt,
        brainContext: {
          locale: "de-DE",
          timezone: "Europe/Berlin",
        },
        debug: true,
      });

      expect(result.toolNames ?? []).toContain("job_lookup");
      expect(result.finalOutput).toMatch(/mehrere|welchen|genau|projekt/i);
      expect(result.finalOutput).not.toMatch(
        /nenne.*strasse|nenne.*hausnummer|brauch.*strasse|brauch.*hausnummer/i,
      );
      expect(result.finalOutput).not.toMatch(/strasse und hausnummer/i);
      expect(result.finalOutput).toMatch(
        new RegExp(
          `${firstJob.job_number}|${secondJob.job_number}|aegidiusstrasse|mondgasse`,
          "i",
        ),
      );
    } finally {
      await cleanupTestRecords(ids);
    }
  }, 60000);
});

describe("AI integration: customer_update (skipped by default)", () => {
  it.skip("updates phone and email for a clearly identified customer", async () => {
    const supabase = getSupabaseServer();
    const suffix = Date.now();
    const ids: TestRecordIds = {
      employeeIds: [],
      customerIds: [],
      jobIds: [],
    };

    const customerName = "Kupferstern Service GmbH";
    const updatedPhone = "01701234567";
    const updatedEmail = "kontakt@kupferstern-service.test";

    try {
      const { data: customer } = await supabase
        .from("customers")
        .insert({
          customer_number: `C-AI-${suffix}`,
          company_name: customerName,
          contact_name: customerName,
          phone: "030000000",
        })
        .select("*")
        .single();
      if (!customer) throw new Error("Customer setup failed");
      ids.customerIds.push(customer.id);

      const prompt = `Ergaenze bei Kunde ${customerName} die Telefonnummer ${updatedPhone} und die Mailadresse ${updatedEmail}.`;

      const result = await brainAgent.process({
        chatId: `ai-customer-update-${suffix}`,
        text: prompt,
        brainContext: {
          locale: "de-DE",
          timezone: "Europe/Berlin",
        },
        debug: true,
      });

      expect(result.toolNames ?? []).toContain("customer_update");
      expect(result.finalOutput).toMatch(/kunde|aktualisiert/i);
      expect(result.finalOutput).toMatch(/telefon|mail|email|geaendert/i);

      const { data: updatedCustomer } = await supabase
        .from("customers")
        .select("*")
        .eq("id", customer.id)
        .single();
      if (!updatedCustomer) throw new Error("Could not reload updated customer");

      expect(updatedCustomer.phone).toBe(updatedPhone);
      expect(updatedCustomer.email).toBe(updatedEmail);
    } finally {
      await cleanupTestRecords(ids);
    }
  }, 60000);
});

describe("AI integration: job_update (skipped by default)", () => {
  it.skip("updates the status for a clearly identified job", async () => {
    const supabase = getSupabaseServer();
    const suffix = Date.now();
    const ids: TestRecordIds = {
      employeeIds: [],
      customerIds: [],
      jobIds: [],
    };

    const customerName = "Bernstein Projektbau GmbH";
    const street = "Kastanienweg 5";

    try {
      const { data: customer } = await supabase
        .from("customers")
        .insert({
          customer_number: `C-AI-${suffix}`,
          company_name: customerName,
          contact_name: customerName,
        })
        .select("*")
        .single();
      if (!customer) throw new Error("Customer setup failed");
      ids.customerIds.push(customer.id);

      const { data: job } = await supabase
        .from("jobs")
        .insert({
          job_number: `J-AI-${suffix}`,
          customer_id: customer.id,
          status: "scheduled",
          address: `${street}, Koeln`,
          notes: "AI integration job update case",
        })
        .select("*")
        .single();
      if (!job) throw new Error("Job setup failed");
      ids.jobIds.push(job.id);

      const prompt = `Setze den Auftrag in der ${street} fuer Kunde ${customerName} auf erledigt.`;

      const result = await brainAgent.process({
        chatId: `ai-job-update-${suffix}`,
        text: prompt,
        brainContext: {
          locale: "de-DE",
          timezone: "Europe/Berlin",
        },
        debug: true,
      });

      expect(result.toolNames ?? []).toContain("job_update");
      expect(result.finalOutput).toMatch(/auftrag|aktualisiert|erledigt/i);

      const { data: updatedJob } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", job.id)
        .single();
      if (!updatedJob) throw new Error("Could not reload updated job");

      expect(updatedJob.status).toBe("done");
    } finally {
      await cleanupTestRecords(ids);
    }
  }, 60000);
});

describe("AI integration: existing legacy scenarios (kept skipped)", () => {
  it.skip("processes an inbound message, executes customer lookup and returns a customer reply", async () => {
    const msg: NormalizedMessage = {
      channel: "twilio",
      kind: "text",
      messageId: `test-${Date.now()}`,
      from: `+4912345${Math.floor(Math.random() * 1000)}`,
      timestamp: Math.floor(Date.now() / 1000),
      text: "Gib mir die Adresse fuer Kunde Mueller",
      contactName: "Test User",
      replyToken: {
        twilioFrom: "whatsapp:+491111111111",
      },
    };

    const result = await brainAgent.process({
      chatId: msg.from,
      text: msg.text,
      brainContext: {
        locale: "de-DE",
        timezone: "Europe/Berlin",
      },
      debug: true,
    });

    expect(result).toBeDefined();
    expect(result.finalOutput).toBeTypeOf("string");
    expect(result.finalOutput.length).toBeGreaterThan(0);
  }, 20000);

  it.skip("processes an inbound message, executes order_create and returns a customer reply", async () => {
    const msg: NormalizedMessage = {
      channel: "twilio",
      kind: "text",
      messageId: `test-${Date.now()}`,
      from: `+4912345${Math.floor(Math.random() * 1000)}`,
      timestamp: Math.floor(Date.now() / 1000),
      text: "Lege eine Bestellung ueber 2000 Steine fuer Kunde Mueller an.",
      contactName: "Test User",
      replyToken: {
        twilioFrom: "whatsapp:+491111111111",
      },
    };

    const result = await brainAgent.process({
      chatId: msg.from,
      text: msg.text,
      brainContext: {
        locale: "de-DE",
        timezone: "Europe/Berlin",
      },
      debug: true,
    });

    expect(result).toBeDefined();
    expect(result.finalOutput).toBeTypeOf("string");
    expect(result.finalOutput.length).toBeGreaterThan(0);
  }, 20000);
});
