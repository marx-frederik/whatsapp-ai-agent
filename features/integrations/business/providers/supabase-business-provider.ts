import { getSupabaseServer } from "@/services/supabase/server";
import {
  BusinessCustomer,
  BusinessProvider,
  CustomerLookupArgs,
  CustomerLookupResult,
  Job,
  JobCreateArgs,
  JobCreateResult,
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

function normalize(value?: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

function generateUniqueNumber(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
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
        message: "Für einen neuen Auftrag brauche ich mindestens den Kundennamen.",
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
};
