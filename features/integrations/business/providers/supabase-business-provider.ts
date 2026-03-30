import { getSupabaseServer } from "@/services/supabase/server";
import {
  BusinessEmployee,
  BusinessCustomer,
  BusinessProvider,
  CustomerCreateArgs,
  CustomerCreateResult,
  CustomerLookupArgs,
  CustomerLookupResult,
  CustomerUpdateArgs,
  CustomerUpdateResult,
  Job,
  JobDispatchArgs,
  JobDispatchResult,
  JobLookupArgs,
  JobLookupResult,
  JobCreateArgs,
  JobCreateResult,
  JobUpdateArgs,
  JobUpdateResult,
  NoteCreateArgs,
  NoteCreateResult,
  Order,
  OrderCreateArgs,
  OrderCreateResult,
} from "../type";

type CustomerRow = {
  id: string;
  customer_number: string;
  company_name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  street: string | null;
  city: string | null;
  postal_code: string | null;
  notes: string | null;
  created_at: string;
};

type EmployeeRow = {
  id: string;
  employee_number: string;
  full_name: string;
  role: string;
  phone: string | null;
  email: string | null;
  active: boolean;
  created_at: string;
};

function mapCustomer(row: CustomerRow): BusinessCustomer {
  return {
    id: row.id,
    customerNumber: row.customer_number,
    companyName: row.company_name,
    contactName: row.contact_name,
    phone: row.phone,
    email: row.email,
    street: row.street,
    city: row.city,
    postalCode: row.postal_code,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

function mapEmployee(row: EmployeeRow): BusinessEmployee {
  return {
    id: row.id,
    employeeNumber: row.employee_number,
    fullName: row.full_name,
    role: row.role,
    phone: row.phone,
    email: row.email,
    active: row.active,
    createdAt: row.created_at,
  };
}

function normalize(value?: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

function normalizeLoose(value?: string | null): string {
  return normalize(value)
    .replace(/\u00e4/g, "ae")
    .replace(/\u00f6/g, "oe")
    .replace(/\u00fc/g, "ue")
    .replace(/\u00df/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizePhone(value?: string | null): string {
  return (value ?? "").replace(/\D/g, "");
}

function generateUniqueNumber(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function getUtcDayBounds(dateString: string): { from: string; to: string } {
  const start = new Date(`${dateString}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  return {
    from: start.toISOString(),
    to: end.toISOString(),
  };
}

type ResolveSuccess<T> = {
  ok: true;
  value: T;
};

type ResolveFailure<TFailureResult> = {
  ok: false;
  result: TFailureResult;
};

type ResolveResult<T, TFailureResult> =
  | ResolveSuccess<T>
  | ResolveFailure<TFailureResult>;

type EmployeeResolveFailure = {
  ok: false;
  code: "FOLLOW_UP_REQUIRED" | "EMPLOYEE_LOOKUP_FAILED";
  message: string;
  options?: string[];
};

type CustomerResolveFailure = {
  ok: false;
  code: "FOLLOW_UP_REQUIRED" | "CUSTOMER_LOOKUP_FAILED";
  message: string;
  options?: string[];
};

type JobReferenceFailure = {
  ok: false;
  code: "FOLLOW_UP_REQUIRED" | "JOB_LOOKUP_FAILED";
  message: string;
  options?: string[];
};

type ResolvedCustomerScope = {
  customerIds: string[] | null;
  customerLabelsById: Map<string, string>;
};

type JobReferenceCriteria = {
  jobNumber: string | null;
  customerIdentifier: string | null;
  jobDate: string | null;
  street: string | null;
  houseNumber: string | null;
  hasAddressCriteria: boolean;
};

function normalizeSearchText(value?: string | null): string {
  return normalizeLoose(value)
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsNormalizedPhrase(
  haystack?: string | null,
  needle?: string | null,
): boolean {
  const normalizedNeedle = normalizeSearchText(needle);
  if (!normalizedNeedle) {
    return true;
  }

  const normalizedHaystack = normalizeSearchText(haystack);
  if (!normalizedHaystack) {
    return false;
  }

  return ` ${normalizedHaystack} `.includes(` ${normalizedNeedle} `);
}

function matchesStructuredAddress(
  haystack?: string | null,
  criteria?: {
    street: string | null;
    houseNumber: string | null;
  },
): boolean {
  if (!criteria) {
    return true;
  }

  if (criteria.street && !containsNormalizedPhrase(haystack, criteria.street)) {
    return false;
  }

  if (
    criteria.houseNumber &&
    !containsNormalizedPhrase(haystack, criteria.houseNumber)
  ) {
    return false;
  }

  return true;
}

function extractJobReferenceCriteria(args: {
  jobNumber?: string | null;
  customerIdentifier?: string | null;
  customerName?: string | null;
  companyName?: string | null;
  jobDate?: string | null;
  street?: string | null;
  houseNumber?: string | null;
}): JobReferenceCriteria {
  const jobNumber = args.jobNumber?.trim() || null;
  const customerIdentifier =
    (args.customerIdentifier ?? args.customerName ?? args.companyName)?.trim() ||
    null;
  const jobDate = args.jobDate?.trim() || null;
  const street = args.street?.trim() || null;
  const houseNumber = args.houseNumber?.trim() || null;

  return {
    jobNumber,
    customerIdentifier,
    jobDate,
    street,
    houseNumber,
    hasAddressCriteria: Boolean(street),
  };
}

function validateJobReferenceCriteria(
  criteria: JobReferenceCriteria,
): JobReferenceFailure | null {
  if (!criteria.jobNumber && criteria.houseNumber && !criteria.street) {
    return {
      ok: false,
      code: "FOLLOW_UP_REQUIRED",
      message:
        "Die Hausnummer allein reicht nicht. Bitte nenne auch die Strasse oder die Auftragsnummer.",
    };
  }

  if (!criteria.jobNumber) {
    const criteriaCount = [
      criteria.customerIdentifier,
      criteria.jobDate,
      criteria.hasAddressCriteria ? "street" : null,
    ].filter(Boolean).length;

    if (criteriaCount < 1) {
      return {
        ok: false,
        code: "FOLLOW_UP_REQUIRED",
        message:
          "Ohne Auftragsnummer brauche ich mindestens ein Kriterium wie Kunde, Strasse oder Datum.",
      };
    }
  }

  return null;
}

function buildTimestampedNote(noteText: string): string {
  const timestamp = new Date().toISOString().replace("T", " ").slice(0, 16);
  return `[${timestamp}] ${noteText.trim()}`;
}

function buildCustomerLabel(customer: {
  customer_number: string;
  company_name: string;
  contact_name: string | null;
}): string {
  const primaryName = customer.company_name?.trim() || customer.contact_name?.trim();
  if (!primaryName) {
    return customer.customer_number;
  }

  return `${primaryName} (${customer.customer_number})`;
}

function buildEmployeeLabel(employee: EmployeeRow): string {
  return `${employee.full_name} (${employee.role}, ${employee.employee_number})`;
}

function buildJobLabel(job: Job, customerLabelsById: Map<string, string>): string {
  const parts = [
    customerLabelsById.get(job.customer_id) ?? null,
    job.address,
    job.status,
  ].filter((part): part is string => Boolean(part));

  return `${job.job_number} (${parts.join(", ")})`;
}

async function ensureCustomerLabelsForJobs(
  supabase: ReturnType<typeof getSupabaseServer>,
  jobs: Job[],
  existingLabelsById: Map<string, string>,
  debug: boolean,
): Promise<Map<string, string>> {
  const labelsById = new Map(existingLabelsById);
  const missingCustomerIds = Array.from(
    new Set(
      jobs
        .map((job) => job.customer_id)
        .filter((customerId) => customerId && !labelsById.has(customerId)),
    ),
  );

  if (missingCustomerIds.length === 0) {
    return labelsById;
  }

  const { data: customers, error } = await supabase
    .from("customers")
    .select("id, customer_number, company_name, contact_name")
    .in("id", missingCustomerIds);

  if (debug) {
    console.log("Dispatch Customer Labels:", customers);
    console.log("Dispatch Customer Labels Error:", error);
  }

  if (error) {
    return labelsById;
  }

  for (const customer of customers ?? []) {
    labelsById.set(customer.id, buildCustomerLabel(customer));
  }

  return labelsById;
}

function exactCustomerMatch(
  customer: {
    customer_number: string;
    company_name: string;
    contact_name: string | null;
  },
  identifier: string,
): boolean {
  const normalizedIdentifier = normalizeLoose(identifier);
  return [
    customer.customer_number,
    customer.company_name,
    customer.contact_name,
  ].some((value) => normalizeLoose(value) === normalizedIdentifier);
}

function buildDetailedCustomerLabel(customer: {
  customer_number: string;
  company_name: string;
  contact_name: string | null;
  street?: string | null;
  city?: string | null;
}): string {
  const name = customer.company_name?.trim() || customer.contact_name?.trim();
  const address = [customer.street?.trim(), customer.city?.trim()]
    .filter((part): part is string => Boolean(part))
    .join(", ");

  const base = name
    ? `${name} (${customer.customer_number})`
    : customer.customer_number;

  return address ? `${base}, ${address}` : base;
}

async function resolveCustomerReference(
  supabase: ReturnType<typeof getSupabaseServer>,
  criteria: {
    customerIdentifier: string | null;
  },
  debug: boolean,
): Promise<ResolveResult<CustomerRow, CustomerResolveFailure>> {
  if (!criteria.customerIdentifier) {
    return {
      ok: false,
      result: {
        ok: false,
        code: "FOLLOW_UP_REQUIRED",
        message:
          "Bitte nenne den Kunden genauer, zum Beispiel mit Kundennummer oder Namen.",
      },
    };
  }

  const { data: customerMatches, error: customerLookupError } = await supabase
    .from("customers")
    .select("*")
    .or(
      [
        `customer_number.ilike.%${criteria.customerIdentifier}%`,
        `company_name.ilike.%${criteria.customerIdentifier}%`,
        `contact_name.ilike.%${criteria.customerIdentifier}%`,
      ].join(","),
    )
    .limit(20);

  if (debug) {
    console.log("Customer Reference Lookup:", customerMatches);
    console.log("Customer Reference Lookup Error:", customerLookupError);
  }

  if (customerLookupError) {
    return {
      ok: false,
      result: {
        ok: false,
        code: "CUSTOMER_LOOKUP_FAILED",
        message: customerLookupError.message,
      },
    };
  }

  let resolvedCustomerMatches = (customerMatches ?? []) as CustomerRow[];

  if (resolvedCustomerMatches.length === 0) {
    const { data: fallbackCustomers, error: fallbackCustomersError } = await supabase
      .from("customers")
      .select("*")
      .limit(100);

    if (fallbackCustomersError) {
      return {
        ok: false,
        result: {
          ok: false,
          code: "CUSTOMER_LOOKUP_FAILED",
          message: fallbackCustomersError.message,
        },
      };
    }

    const normalizedIdentifier = normalizeLoose(criteria.customerIdentifier);
    resolvedCustomerMatches = (fallbackCustomers ?? []).filter((customer) => {
      const haystacks = [
        customer.customer_number,
        customer.company_name,
        customer.contact_name,
      ];

      return haystacks.some((value) =>
        normalizeLoose(value).includes(normalizedIdentifier),
      );
    }) as CustomerRow[];
  }

  if (resolvedCustomerMatches.length === 0) {
    return {
      ok: false,
      result: {
        ok: false,
        code: "FOLLOW_UP_REQUIRED",
        message: "Ich konnte keinen passenden Kunden finden.",
      },
    };
  }

  const exactMatches = resolvedCustomerMatches.filter((customer) =>
    exactCustomerMatch(customer, criteria.customerIdentifier as string),
  );

  if (exactMatches.length === 1) {
    return {
      ok: true,
      value: exactMatches[0] as CustomerRow,
    };
  }

  const scopedMatches =
    exactMatches.length > 1 ? exactMatches : resolvedCustomerMatches;

  if (scopedMatches.length > 1) {
    return {
      ok: false,
      result: {
        ok: false,
        code: "FOLLOW_UP_REQUIRED",
        message: "Ich habe mehrere passende Kunden gefunden. Welchen meinst du genau?",
        options: scopedMatches.map((customer) =>
          buildDetailedCustomerLabel(customer as CustomerRow),
        ),
      },
    };
  }

  return {
    ok: true,
    value: scopedMatches[0] as CustomerRow,
  };
}

function buildScheduledWindowForDate(
  dateString: string,
  currentJob: Pick<Job, "scheduled_start" | "scheduled_end">,
): {
  scheduled_start: string;
  scheduled_end: string | null;
} {
  const start = new Date(`${dateString}T00:00:00.000Z`);
  const currentStart = currentJob.scheduled_start
    ? new Date(currentJob.scheduled_start)
    : null;
  const currentEnd = currentJob.scheduled_end
    ? new Date(currentJob.scheduled_end)
    : null;

  if (currentStart) {
    start.setUTCHours(
      currentStart.getUTCHours(),
      currentStart.getUTCMinutes(),
      currentStart.getUTCSeconds(),
      currentStart.getUTCMilliseconds(),
    );
  } else {
    start.setUTCHours(8, 0, 0, 0);
  }

  let scheduledEnd: string | null = null;

  if (
    currentStart &&
    currentEnd &&
    currentEnd.getTime() > currentStart.getTime()
  ) {
    const durationMs = currentEnd.getTime() - currentStart.getTime();
    scheduledEnd = new Date(start.getTime() + durationMs).toISOString();
  }

  return {
    scheduled_start: start.toISOString(),
    scheduled_end: scheduledEnd,
  };
}

async function resolveEmployee(
  supabase: ReturnType<typeof getSupabaseServer>,
  employeeName: string,
  debug: boolean,
): Promise<ResolveResult<EmployeeRow, EmployeeResolveFailure>> {
  const normalizedEmployeeName = normalizeLoose(employeeName);
  const { data: employeeCandidates, error: employeeLookupError } = await supabase
    .from("employees")
    .select("*")
    .ilike("full_name", `%${employeeName}%`)
    .eq("active", true)
    .limit(10);

  if (debug) {
    console.log("Dispatch Employee Lookup:", employeeCandidates);
    console.log("Dispatch Employee Lookup Error:", employeeLookupError);
  }

  if (employeeLookupError) {
    return {
      ok: false,
      result: {
        ok: false,
        code: "EMPLOYEE_LOOKUP_FAILED",
        message: employeeLookupError.message,
      },
    };
  }

  let resolvedEmployeeCandidates = (employeeCandidates ?? []) as EmployeeRow[];

  if (resolvedEmployeeCandidates.length === 0) {
    const { data: fallbackEmployees, error: fallbackEmployeeError } = await supabase
      .from("employees")
      .select("*")
      .eq("active", true)
      .limit(100);

    if (debug) {
      console.log("Dispatch Employee Fallback Lookup:", fallbackEmployees);
      console.log(
        "Dispatch Employee Fallback Lookup Error:",
        fallbackEmployeeError,
      );
    }

    if (fallbackEmployeeError) {
      return {
        ok: false,
        result: {
          ok: false,
          code: "EMPLOYEE_LOOKUP_FAILED",
          message: fallbackEmployeeError.message,
        },
      };
    }

    resolvedEmployeeCandidates = (fallbackEmployees ?? []).filter((candidate) =>
      normalizeLoose(candidate.full_name).includes(normalizedEmployeeName),
    ) as EmployeeRow[];
  }

  if (resolvedEmployeeCandidates.length === 0) {
    return {
      ok: false,
      result: {
        ok: false,
        code: "FOLLOW_UP_REQUIRED",
        message: "Ich habe keinen aktiven Mitarbeiter mit diesem Namen gefunden.",
      },
    };
  }

  const exactEmployeeMatches = resolvedEmployeeCandidates.filter(
    (candidate) => normalizeLoose(candidate.full_name) === normalizedEmployeeName,
  );

  if (exactEmployeeMatches.length === 1) {
    return {
      ok: true,
      value: exactEmployeeMatches[0] as EmployeeRow,
    };
  }

  if (exactEmployeeMatches.length > 1 || resolvedEmployeeCandidates.length > 1) {
    return {
      ok: false,
      result: {
        ok: false,
        code: "FOLLOW_UP_REQUIRED",
        message: "Ich habe mehrere passende Mitarbeiter gefunden. Wen genau soll ich zuweisen?",
        options: resolvedEmployeeCandidates.map((employee) =>
          buildEmployeeLabel(employee as EmployeeRow),
        ),
      },
    };
  }

  return {
    ok: true,
    value: resolvedEmployeeCandidates[0] as EmployeeRow,
  };
}

async function resolveCustomerScope(
  supabase: ReturnType<typeof getSupabaseServer>,
  customerIdentifier: string | null,
  context: {
    hasAddressCriteria: boolean;
    jobNumber: string | null;
    jobDate: string | null;
  },
  debug: boolean,
): Promise<ResolveResult<ResolvedCustomerScope, JobReferenceFailure>> {
  if (!customerIdentifier) {
    return {
      ok: true,
      value: {
        customerIds: null,
        customerLabelsById: new Map(),
      },
    };
  }

  const { data: customerMatches, error: customerLookupError } = await supabase
    .from("customers")
    .select("id, customer_number, company_name, contact_name")
    .or(
      [
        `customer_number.ilike.%${customerIdentifier}%`,
        `company_name.ilike.%${customerIdentifier}%`,
        `contact_name.ilike.%${customerIdentifier}%`,
      ].join(","),
    )
    .limit(20);

  if (debug) {
    console.log("Dispatch Customer Lookup:", customerMatches);
    console.log("Dispatch Customer Lookup Error:", customerLookupError);
  }

  if (customerLookupError) {
    return {
      ok: false,
      result: {
        ok: false,
        code: "JOB_LOOKUP_FAILED",
        message: customerLookupError.message,
      },
    };
  }

  let resolvedCustomerMatches = customerMatches ?? [];

  if (resolvedCustomerMatches.length === 0) {
    const { data: fallbackCustomers, error: fallbackCustomersError } = await supabase
      .from("customers")
      .select("id, customer_number, company_name, contact_name")
      .limit(100);

    if (fallbackCustomersError) {
      return {
        ok: false,
        result: {
          ok: false,
          code: "JOB_LOOKUP_FAILED",
          message: fallbackCustomersError.message,
        },
      };
    }

    const normalizedCustomerIdentifier = normalizeLoose(customerIdentifier);
    resolvedCustomerMatches = (fallbackCustomers ?? []).filter((customer) => {
      const haystacks = [
        customer.customer_number,
        customer.company_name,
        customer.contact_name,
      ];

      return haystacks.some((candidateValue) =>
        normalizeLoose(candidateValue).includes(normalizedCustomerIdentifier),
      );
    });
  }

  if (resolvedCustomerMatches.length === 0) {
    return {
      ok: false,
      result: {
        ok: false,
        code: "FOLLOW_UP_REQUIRED",
        message: "Ich konnte keinen passenden Kunden zur Jobsuche finden.",
      },
    };
  }

  const exactMatches = resolvedCustomerMatches.filter((customer) =>
    exactCustomerMatch(customer, customerIdentifier),
  );

  const scopedMatches = exactMatches.length > 0 ? exactMatches : resolvedCustomerMatches;

  if (
    scopedMatches.length > 1 &&
    !context.hasAddressCriteria &&
    !context.jobNumber &&
    !context.jobDate
  ) {
    return {
      ok: false,
      result: {
        ok: false,
        code: "FOLLOW_UP_REQUIRED",
        message: "Ich habe mehrere passende Kunden gefunden. Welchen meinst du genau?",
        options: scopedMatches.map((customer) => buildCustomerLabel(customer)),
      },
    };
  }

  return {
    ok: true,
    value: {
      customerIds: scopedMatches.map((customer) => customer.id),
      customerLabelsById: new Map(
        scopedMatches.map((customer) => [customer.id, buildCustomerLabel(customer)]),
      ),
    },
  };
}

async function resolveJob(
  supabase: ReturnType<typeof getSupabaseServer>,
  criteria: {
    jobNumber: string | null;
    customerIds: string[] | null;
    jobDate: string | null;
    street: string | null;
    houseNumber: string | null;
    customerLabelsById: Map<string, string>;
  },
  debug: boolean,
): Promise<ResolveResult<Job, JobReferenceFailure>> {
  let jobQuery = supabase.from("jobs").select("*");

  if (criteria.jobNumber) {
    jobQuery = jobQuery.ilike("job_number", `%${criteria.jobNumber}%`);
  }

  if (criteria.customerIds && criteria.customerIds.length > 0) {
    jobQuery = jobQuery.in("customer_id", criteria.customerIds);
  }

  if (criteria.jobDate) {
    const bounds = getUtcDayBounds(criteria.jobDate);
    jobQuery = jobQuery.gte("created_at", bounds.from).lt("created_at", bounds.to);
  }

  const { data: jobCandidates, error: jobLookupError } = await jobQuery
    .order("created_at", { ascending: false })
    .limit(criteria.jobNumber ? 20 : 50);

  if (debug) {
    console.log("Dispatch Job Lookup:", jobCandidates);
    console.log("Dispatch Job Lookup Error:", jobLookupError);
  }

  if (jobLookupError) {
    return {
      ok: false,
      result: {
        ok: false,
        code: "JOB_LOOKUP_FAILED",
        message: jobLookupError.message,
      },
    };
  }

  const resolvedJobCandidates = (jobCandidates ?? []).filter((job) =>
    matchesStructuredAddress(job.address, {
      street: criteria.street,
      houseNumber: criteria.houseNumber,
    }),
  );

  if (resolvedJobCandidates.length === 0) {
    return {
      ok: false,
      result: {
        ok: false,
        code: "FOLLOW_UP_REQUIRED",
        message: "Ich konnte keinen passenden Auftrag finden.",
      },
    };
  }

  if (criteria.jobNumber) {
    const exactJobMatches = resolvedJobCandidates.filter(
      (candidate) =>
        normalizeLoose(candidate.job_number) === normalizeLoose(criteria.jobNumber),
    );

    if (exactJobMatches.length === 1) {
      return {
        ok: true,
        value: exactJobMatches[0] as Job,
      };
    }

    if (exactJobMatches.length > 1) {
      const customerLabelsById = await ensureCustomerLabelsForJobs(
        supabase,
        exactJobMatches as Job[],
        criteria.customerLabelsById,
        debug,
      );

      return {
        ok: false,
        result: {
          ok: false,
          code: "FOLLOW_UP_REQUIRED",
          message: "Ich habe mehrere Auftraege mit dieser Auftragsnummer gefunden. Welchen meinst du?",
          options: exactJobMatches.map((job) =>
            buildJobLabel(job as Job, customerLabelsById),
          ),
        },
      };
    }
  }

  if (resolvedJobCandidates.length === 1) {
    return {
      ok: true,
      value: resolvedJobCandidates[0] as Job,
    };
  }

  const customerLabelsById = await ensureCustomerLabelsForJobs(
    supabase,
    resolvedJobCandidates as Job[],
    criteria.customerLabelsById,
    debug,
  );

  return {
    ok: false,
    result: {
      ok: false,
      code: "FOLLOW_UP_REQUIRED",
      message: "Ich habe mehrere passende Auftraege gefunden. Welchen soll ich zuweisen?",
      options: resolvedJobCandidates.map((job) =>
        buildJobLabel(job as Job, customerLabelsById),
      ),
    },
  };
}

async function resolveJobReference(
  supabase: ReturnType<typeof getSupabaseServer>,
  criteria: JobReferenceCriteria,
  debug: boolean,
): Promise<ResolveResult<Job, JobReferenceFailure>> {
  const validationFailure = validateJobReferenceCriteria(criteria);
  if (validationFailure) {
    return {
      ok: false,
      result: validationFailure,
    };
  }

  const customerScopeResolution = await resolveCustomerScope(
    supabase,
    criteria.customerIdentifier,
    {
      hasAddressCriteria: criteria.hasAddressCriteria,
      jobNumber: criteria.jobNumber,
      jobDate: criteria.jobDate,
    },
    debug,
  );
  if (!customerScopeResolution.ok) {
    return customerScopeResolution;
  }

  return await resolveJob(
    supabase,
    {
      jobNumber: criteria.jobNumber,
      customerIds: customerScopeResolution.value.customerIds,
      jobDate: criteria.jobDate,
      street: criteria.street,
      houseNumber: criteria.houseNumber,
      customerLabelsById: customerScopeResolution.value.customerLabelsById,
    },
    debug,
  );
}

export const supabaseBusinessProvider: BusinessProvider = {
  async customerLookup(
    args: CustomerLookupArgs,
    debug: boolean = false,
  ): Promise<CustomerLookupResult> {
    const supabaseServer = getSupabaseServer();

    const name = args.customerIdentifier?.trim();
    const phone = args.phone?.trim();
    const email = args.email?.trim();

    let query = supabaseServer.from("customers").select("*");

    if (phone) {
      query = query.ilike("phone", `%${phone}%`);
    }

    if (email) {
      query = query.ilike("email", `%${email}%`);
    }

    // customer_name = OR innerhalb des Felds
    // also company_name ODER contact_name
    if (name) {
      query = query.or(
        [`company_name.ilike.%${name}%`, `contact_name.ilike.%${name}%`].join(
          ",",
        ),
      );
    }

    const { data, error } = await query;

    if (debug) {
      console.log("Data:", data);
      console.log("Error:", error);
    }

    if (error) {
      return {
        ok: false,
        code: "CUSTOMER_LOOKUP_FAILED",
        message: error.message,
      };
    }
    return {
      ok: true,
      customers: (data ?? []).map(mapCustomer),
    };
  },

  async customerCreate(
    args: CustomerCreateArgs,
    debug: boolean = false,
  ): Promise<CustomerCreateResult> {
    const supabase = getSupabaseServer();

    const customerName = args.customerName?.trim() ?? "";
    const phone = args.phone?.trim() ?? "";
    const contactName = args.contactName?.trim() || null;
    const email = args.email?.trim() || null;
    const street = args.street?.trim() || null;
    const city = args.city?.trim() || null;
    const postalCode = args.postalCode?.trim() || null;
    const note = args.note?.trim() || null;

    if (!customerName || !phone) {
      return {
        ok: false,
        code: "FOLLOW_UP_REQUIRED",
        message:
          "FÃ¼r einen neuen Kunden brauche ich mindestens Name und Telefonnummer.",
      };
    }

    const missingFields: string[] = [];
    if (!contactName) missingFields.push("contactName");
    if (!email) missingFields.push("email");
    if (!street) missingFields.push("street");
    if (!city) missingFields.push("city");
    if (!postalCode) missingFields.push("postalCode");
    if (!note) missingFields.push("note");

    const normalizedPhone = normalizePhone(phone);
    if (normalizedPhone.length > 0) {
      const { data: matchingByPhone, error: phoneLookupError } = await supabase
        .from("customers")
        .select("*")
        .ilike("phone", `%${phone}%`)
        .limit(10);

      if (debug) {
        console.log("Customer Create Phone Lookup:", matchingByPhone);
        console.log("Customer Create Phone Lookup Error:", phoneLookupError);
      }

      if (phoneLookupError) {
        return {
          ok: false,
          code: "CUSTOMER_LOOKUP_FAILED",
          message: phoneLookupError.message,
        };
      }

      const existingCustomer = (matchingByPhone ?? []).find(
        (candidate) => normalizePhone(candidate.phone) === normalizedPhone,
      );

      if (existingCustomer) {
        return {
          ok: true,
          message: `Kunde ${existingCustomer.customer_number} existiert bereits.`,
          customer: mapCustomer(existingCustomer as CustomerRow),
          customerCreated: false,
          missingFields,
        };
      }
    }

    const { data: createdCustomer, error: createCustomerError } = await supabase
      .from("customers")
      .insert({
        customer_number: generateUniqueNumber("C"),
        company_name: customerName,
        contact_name: contactName ?? customerName,
        phone,
        email,
        street,
        city,
        postal_code: postalCode,
        notes: note,
      })
      .select("*")
      .single();

    if (debug) {
      console.log("Customer Create Result:", createdCustomer);
      console.log("Customer Create Error:", createCustomerError);
    }

    if (createCustomerError || !createdCustomer) {
      return {
        ok: false,
        code: "CUSTOMER_CREATE_FAILED",
        message: createCustomerError?.message ?? "Kunde konnte nicht angelegt werden.",
      };
    }

    return {
      ok: true,
      message: `Kunde ${createdCustomer.customer_number} wurde angelegt.`,
      customer: mapCustomer(createdCustomer as CustomerRow),
      customerCreated: true,
      missingFields,
    };
  },

  async customerUpdate(
    args: CustomerUpdateArgs,
    debug: boolean = false,
  ): Promise<CustomerUpdateResult> {
    const supabase = getSupabaseServer();
    const customerIdentifier =
      (args.customerIdentifier ?? args.customerName ?? args.companyName)?.trim() ||
      null;
    const newCompanyName = args.newCompanyName?.trim() || null;
    const contactName = args.contactName?.trim() || null;
    const phone = args.phone?.trim() || null;
    const email = args.email?.trim() || null;
    const street = args.street?.trim() || null;
    const city = args.city?.trim() || null;
    const postalCode = args.postalCode?.trim() || null;
    const note = args.note?.trim() || null;

    const updatedFields: string[] = [];

    if (newCompanyName) updatedFields.push("companyName");
    if (contactName) updatedFields.push("contactName");
    if (phone) updatedFields.push("phone");
    if (email) updatedFields.push("email");
    if (street) updatedFields.push("street");
    if (city) updatedFields.push("city");
    if (postalCode) updatedFields.push("postalCode");
    if (note) updatedFields.push("note");

    if (!customerIdentifier) {
      return {
        ok: false,
        code: "FOLLOW_UP_REQUIRED",
        message:
          "Bitte nenne den Kunden, den ich aktualisieren soll, zum Beispiel mit Name oder Kundennummer.",
      };
    }

    if (updatedFields.length === 0) {
      return {
        ok: false,
        code: "FOLLOW_UP_REQUIRED",
        message:
          "Bitte nenne mindestens ein Feld, das ich beim Kunden ändern soll.",
      };
    }

    if (debug) {
      console.log("Customer Update Criteria:", {
        customerIdentifier,
        updatedFields,
      });
    }

    const customerResolution = await resolveCustomerReference(
      supabase,
      {
        customerIdentifier,
      },
      debug,
    );
    if (!customerResolution.ok) {
      return customerResolution.result;
    }

    const resolvedCustomer = customerResolution.value;
    const notes = note
      ? resolvedCustomer.notes?.trim()
        ? `${resolvedCustomer.notes.trim()}\n${buildTimestampedNote(note)}`
        : buildTimestampedNote(note)
      : resolvedCustomer.notes;

    const updatePayload = {
      company_name: newCompanyName ?? resolvedCustomer.company_name,
      contact_name: contactName ?? resolvedCustomer.contact_name,
      phone: phone ?? resolvedCustomer.phone,
      email: email ?? resolvedCustomer.email,
      street: street ?? resolvedCustomer.street,
      city: city ?? resolvedCustomer.city,
      postal_code: postalCode ?? resolvedCustomer.postal_code,
      notes,
    };

    const { data: updatedCustomer, error: updateError } = await supabase
      .from("customers")
      .update(updatePayload)
      .eq("id", resolvedCustomer.id)
      .select("*")
      .single();

    if (debug) {
      console.log("Customer Update Result:", updatedCustomer);
      console.log("Customer Update Error:", updateError);
    }

    if (updateError || !updatedCustomer) {
      return {
        ok: false,
        code: "CUSTOMER_UPDATE_FAILED",
        message: updateError?.message ?? "Kunde konnte nicht aktualisiert werden.",
      };
    }

    return {
      ok: true,
      message: `Kunde ${updatedCustomer.customer_number} wurde aktualisiert.`,
      customer: mapCustomer(updatedCustomer as CustomerRow),
      updatedFields,
    };
  },

  async orderCreate(
    args: OrderCreateArgs,
    debug: boolean = false,
  ): Promise<OrderCreateResult> {
    const supabase = getSupabaseServer();
    if (!args.customerIdentifier) {
      return {
        ok: false,
        code: "CUSTOMER_NOT_FOUND",
        message: "Customer not found",
      };
    }

    const { data: customers, error } = await supabase
      .from("customers")
      .select("id, customer_number, contact_name, company_name, street")
      .or(
        [
          `customer_number.ilike.%${args.customerIdentifier}%`,
          `contact_name.ilike.%${args.customerIdentifier}%`,
          `company_name.ilike.%${args.customerIdentifier}%`,
          `street.ilike.%${args.customerIdentifier}%`,
        ].join(","),
      )
      .limit(10);

    if (debug) {
      console.log("Customer Lookup:", customers);
      console.log("Customer Lookup Error:", error);
    }

    if (error) {
      return {
        ok: false,
        code: "CUSTOMER_NOT_FOUND",
        message: error.message,
      };
    }

    if (!customers || customers.length === 0) {
      return {
        ok: false,
        code: "FOLLOW_UP_REQUIRED",
        message: "Ich konnte keinen passenden Kunden finden.",
      };
    }

    if (customers.length > 1) {
      return {
        ok: false,
        code: "FOLLOW_UP_REQUIRED",
        message:
          "Ich habe mehrere passende Kunden gefunden. Welchen meinst du genau?",
        options: customers.map(
          (c) => c.company_name ?? c.contact_name ?? c.customer_number ?? c.id,
        ),
      };
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        order_number: new Date().getTime().toString(), //TODO: Generate order number with sequence
        customer_id: customers[0].id,
        type: "order",
        status: "draft",
        requested_date: new Date().toISOString().slice(0, 10),
        notes: args.note ?? null,
      })
      .select("*")
      .single();

    if (debug) {
      console.log("Created Order:", order);
      console.log("Created Order Error:", orderError);
    }

    if (orderError || !order) {
      return {
        ok: false,
        code: "ORDER_CREATE_FAILED",
        message: orderError?.message ?? "Order could not be created.",
      };
    }

    const itemRows = args.items.map((item) => ({
      order_id: order.id,
      sku: item.skuOrName,
      name: item.skuOrName,
      quantity: item.quantity,
      unit: "Stk",
      unit_price: 10,
    }));

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(itemRows);

    if (itemsError) {
      return {
        ok: false,
        code: "ORDER_CREATE_FAILED",
        message: itemsError.message,
      };
    }
    return {
      ok: true,
      message: `Order ${order.order_number} created`,
      order: order as Order,
    };
  },

  async jobCreate(
    args: JobCreateArgs,
    debug: boolean = false,
  ): Promise<JobCreateResult> {
    const supabase = getSupabaseServer();

    const customerName = args.customerName.trim();
    const street = args.street?.trim() || null;
    const city = args.city?.trim() || null;
    const postalCode = args.postalCode?.trim() || null;
    const phone = args.phone?.trim() || null;
    const email = args.email?.trim() || null;
    const note = args.note?.trim() || null;

    if (!customerName) {
      return {
        ok: false,
        code: "FOLLOW_UP_REQUIRED",
        message: "FÃ¼r einen neuen Auftrag brauche ich mindestens den Kundennamen.",
      };
    }

    const missingFields: string[] = [];
    if (!street) missingFields.push("street");
    if (!city) missingFields.push("city");
    if (!phone) missingFields.push("phone");
    if (!email) missingFields.push("email");
    if (!note) missingFields.push("note");

    const { data: customerCandidates, error: customerLookupError } = await supabase
      .from("customers")
      .select("*")
      .or(
        [
          `company_name.ilike.%${customerName}%`,
          `contact_name.ilike.%${customerName}%`,
        ].join(","),
      )
      .limit(10);

    if (debug) {
      console.log("Job Customer Lookup:", customerCandidates);
      console.log("Job Customer Lookup Error:", customerLookupError);
    }

    if (customerLookupError) {
      return {
        ok: false,
        code: "CUSTOMER_LOOKUP_FAILED",
        message: customerLookupError.message,
      };
    }

    const normalizedStreet = normalize(street);
    const normalizedCity = normalize(city);

    const exactAddressMatch = (customerCandidates ?? []).find((candidate) => {
      const candidateStreet = normalize(candidate.street);
      const candidateCity = normalize(candidate.city);
      if (!street || !city) {
        return false;
      }
      return (
        candidateStreet === normalizedStreet && candidateCity === normalizedCity
      );
    });

    let selectedCustomer: CustomerRow | null =
      (exactAddressMatch as CustomerRow | undefined) ?? null;
    let customerCreated = false;

    if (!selectedCustomer && (customerCandidates?.length ?? 0) > 1 && !!street && !!city) {
      return {
        ok: false,
        code: "FOLLOW_UP_REQUIRED",
        message:
          "Ich habe mehrere Kunden mit diesem Namen gefunden. Bitte nenne mir die genaue Adresse oder Kundennummer.",
        options: (customerCandidates ?? []).map(
          (c) => `${c.company_name ?? c.contact_name ?? "Unbekannt"} (${c.street ?? "-"}, ${c.city ?? "-"})`,
        ),
      };
    }

    if (!selectedCustomer && customerCandidates?.length === 1) {
      selectedCustomer = customerCandidates[0] as CustomerRow;
    }

    if (!selectedCustomer) {
      const { data: createdCustomer, error: createCustomerError } = await supabase
        .from("customers")
        .insert({
          customer_number: generateUniqueNumber("C"),
          company_name: customerName,
          contact_name: customerName,
          phone,
          email,
          street,
          city,
          postal_code: postalCode,
        })
        .select("*")
        .single();

      if (debug) {
        console.log("Created Customer:", createdCustomer);
        console.log("Created Customer Error:", createCustomerError);
      }

      if (createCustomerError || !createdCustomer) {
        return {
          ok: false,
          code: "CUSTOMER_CREATE_FAILED",
          message: createCustomerError?.message ?? "Kunde konnte nicht angelegt werden.",
        };
      }

      selectedCustomer = createdCustomer as CustomerRow;
      customerCreated = true;
    }

    const derivedStreet = street ?? selectedCustomer.street;
    const derivedCity = city ?? selectedCustomer.city;
    const derivedPostalCode = postalCode ?? selectedCustomer.postal_code;
    const addressParts = [derivedStreet, derivedPostalCode, derivedCity].filter(
      (value): value is string => Boolean(value),
    );
    const address = addressParts.length > 0 ? addressParts.join(", ") : null;
    const { data: job, error: createJobError } = await supabase
      .from("jobs")
      .insert({
        job_number: generateUniqueNumber("J"),
        customer_id: selectedCustomer.id,
        status: "new",
        address,
        notes: note ?? "Schnellerfassung ohne Leistungsbeschreibung.",
      })
      .select("*")
      .single();

    if (debug) {
      console.log("Created Job:", job);
      console.log("Created Job Error:", createJobError);
    }

    if (createJobError || !job) {
      return {
        ok: false,
        code: "JOB_CREATE_FAILED",
        message: createJobError?.message ?? "Auftrag konnte nicht angelegt werden.",
      };
    }

    return {
      ok: true,
      message: `Auftrag ${job.job_number} wurde erstellt.`,
      customer: mapCustomer(selectedCustomer),
      customerCreated,
      missingFields,
      job: job as Job,
    };
  },

  async jobDispatch(
    args: JobDispatchArgs,
    debug: boolean = false,
  ): Promise<JobDispatchResult> {
    const supabase = getSupabaseServer();

    const employeeName = args.employeeName?.trim() ?? "";
    const jobReferenceCriteria = extractJobReferenceCriteria(args);

    if (!employeeName) {
      return {
        ok: false,
        code: "FOLLOW_UP_REQUIRED",
        message: "Bitte nenne den vollstaendigen Namen des Mitarbeiters.",
      };
    }

    if (debug) {
      console.log("Dispatch Criteria:", {
        employeeName,
        ...jobReferenceCriteria,
      });
    }

    const employeeResolution = await resolveEmployee(supabase, employeeName, debug);
    if (!employeeResolution.ok) {
      return employeeResolution.result;
    }

    const jobResolution = await resolveJobReference(
      supabase,
      jobReferenceCriteria,
      debug,
    );
    if (!jobResolution.ok) {
      return jobResolution.result;
    }

    const resolvedEmployee = employeeResolution.value;
    const resolvedJob = jobResolution.value;

    if (resolvedJob.status === "done" || resolvedJob.status === "cancelled") {
      return {
        ok: false,
        code: "JOB_DISPATCH_FAILED",
        message:
          "Dieser Auftrag ist bereits abgeschlossen oder storniert und kann nicht neu disponiert werden.",
      };
    }

    const { data: dispatchedJob, error: dispatchUpdateError } = await supabase
      .from("jobs")
      .update({
        assigned_employee_id: resolvedEmployee.id,
        status: "scheduled",
      })
      .eq("id", resolvedJob.id)
      .select("*")
      .single();

    if (debug) {
      console.log("Dispatch Updated Job:", dispatchedJob);
      console.log("Dispatch Updated Job Error:", dispatchUpdateError);
    }

    if (dispatchUpdateError || !dispatchedJob) {
      return {
        ok: false,
        code: "JOB_DISPATCH_FAILED",
        message: dispatchUpdateError?.message ?? "Mitarbeiter konnte nicht zugewiesen werden.",
      };
    }

    return {
      ok: true,
      message: `Auftrag ${dispatchedJob.job_number} wurde ${resolvedEmployee.full_name} zugewiesen.`,
      job: dispatchedJob as Job,
      employee: mapEmployee(resolvedEmployee),
    };
  },

  async jobUpdate(
    args: JobUpdateArgs,
    debug: boolean = false,
  ): Promise<JobUpdateResult> {
    const supabase = getSupabaseServer();
    const jobReferenceCriteria = extractJobReferenceCriteria(args);
    const newAddress = args.newAddress?.trim() || null;
    const scheduledDate = args.scheduledDate?.trim() || null;
    const status = args.status?.trim() || null;

    const updatedFields: string[] = [];
    if (newAddress) updatedFields.push("address");
    if (scheduledDate) updatedFields.push("scheduledDate");
    if (status) updatedFields.push("status");

    if (updatedFields.length === 0) {
      return {
        ok: false,
        code: "FOLLOW_UP_REQUIRED",
        message:
          "Bitte nenne mindestens ein Feld, das ich beim Auftrag ändern soll.",
      };
    }

    if (debug) {
      console.log("Job Update Criteria:", {
        ...jobReferenceCriteria,
        newAddress,
        scheduledDate,
        status,
      });
    }

    const jobResolution = await resolveJobReference(
      supabase,
      jobReferenceCriteria,
      debug,
    );
    if (!jobResolution.ok) {
      return jobResolution.result;
    }

    const resolvedJob = jobResolution.value;
    const scheduledWindow = scheduledDate
      ? buildScheduledWindowForDate(scheduledDate, resolvedJob)
      : null;

    const nextStatus =
      status ?? (scheduledDate && resolvedJob.status === "new"
        ? "scheduled"
        : resolvedJob.status);

    const updatePayload = {
      address: newAddress ?? resolvedJob.address,
      status: nextStatus,
      scheduled_start:
        scheduledWindow?.scheduled_start ?? resolvedJob.scheduled_start,
      scheduled_end: scheduledWindow?.scheduled_end ?? resolvedJob.scheduled_end,
    };

    const { data: updatedJob, error: updateError } = await supabase
      .from("jobs")
      .update(updatePayload)
      .eq("id", resolvedJob.id)
      .select("*")
      .single();

    if (debug) {
      console.log("Job Update Result:", updatedJob);
      console.log("Job Update Error:", updateError);
    }

    if (updateError || !updatedJob) {
      return {
        ok: false,
        code: "JOB_UPDATE_FAILED",
        message: updateError?.message ?? "Auftrag konnte nicht aktualisiert werden.",
      };
    }

    return {
      ok: true,
      message: `Auftrag ${updatedJob.job_number} wurde aktualisiert.`,
      job: updatedJob as Job,
      updatedFields,
    };
  },

  async jobLookup(
    args: JobLookupArgs,
    debug: boolean = false,
  ): Promise<JobLookupResult> {
    const supabase = getSupabaseServer();
    const jobReferenceCriteria = extractJobReferenceCriteria(args);

    if (debug) {
      console.log("Job Lookup Criteria:", jobReferenceCriteria);
    }

    const jobResolution = await resolveJobReference(
      supabase,
      jobReferenceCriteria,
      debug,
    );
    if (!jobResolution.ok) {
      return jobResolution.result;
    }

    const resolvedJob = jobResolution.value;

    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("*")
      .eq("id", resolvedJob.customer_id)
      .single();

    if (debug) {
      console.log("Job Lookup Customer:", customer);
      console.log("Job Lookup Customer Error:", customerError);
    }

    if (customerError || !customer) {
      return {
        ok: false,
        code: "JOB_LOOKUP_FAILED",
        message:
          customerError?.message ??
          "Kundendaten zum Auftrag konnten nicht geladen werden.",
      };
    }

    let assignedEmployeeName: string | null = null;

    if (resolvedJob.assigned_employee_id) {
      const { data: employee, error: employeeError } = await supabase
        .from("employees")
        .select("full_name")
        .eq("id", resolvedJob.assigned_employee_id)
        .single();

      if (debug) {
        console.log("Job Lookup Employee:", employee);
        console.log("Job Lookup Employee Error:", employeeError);
      }

      if (employeeError) {
        return {
          ok: false,
          code: "JOB_LOOKUP_FAILED",
          message: employeeError.message,
        };
      }

      assignedEmployeeName = employee?.full_name ?? null;
    }

    return {
      ok: true,
      message: `Auftragsinformationen fuer ${resolvedJob.job_number} wurden geladen.`,
      job: resolvedJob,
      customerName:
        customer.company_name?.trim() ||
        customer.contact_name?.trim() ||
        customer.customer_number,
      assignedEmployeeName,
    };
  },

  async noteCreate(
    args: NoteCreateArgs,
    debug: boolean = false,
  ): Promise<NoteCreateResult> {
    const supabase = getSupabaseServer();
    const noteText = args.noteText.trim();
    const jobReferenceCriteria = extractJobReferenceCriteria(args);

    if (!noteText) {
      return {
        ok: false,
        code: "FOLLOW_UP_REQUIRED",
        message: "Bitte nenne den Text der Notiz.",
      };
    }

    if (debug) {
      console.log("Note Create Criteria:", {
        noteText,
        ...jobReferenceCriteria,
      });
    }

    const jobResolution = await resolveJobReference(
      supabase,
      jobReferenceCriteria,
      debug,
    );
    if (!jobResolution.ok) {
      return jobResolution.result;
    }

    const resolvedJob = jobResolution.value;
    const appendedNote = buildTimestampedNote(noteText);
    const notes = resolvedJob.notes?.trim()
      ? `${resolvedJob.notes.trim()}\n${appendedNote}`
      : appendedNote;

    const { data: updatedJob, error: updateError } = await supabase
      .from("jobs")
      .update({
        notes,
      })
      .eq("id", resolvedJob.id)
      .select("*")
      .single();

    if (debug) {
      console.log("Note Create Updated Job:", updatedJob);
      console.log("Note Create Updated Job Error:", updateError);
    }

    if (updateError || !updatedJob) {
      return {
        ok: false,
        code: "NOTE_CREATE_FAILED",
        message: updateError?.message ?? "Notiz konnte nicht gespeichert werden.",
      };
    }

    return {
      ok: true,
      message: `Die Notiz wurde zu Auftrag ${updatedJob.job_number} hinzugefuegt.`,
      job: updatedJob as Job,
      appendedNote,
    };
  },
};

