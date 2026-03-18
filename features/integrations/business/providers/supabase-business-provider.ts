import { getSupabaseServer } from "@/services/supabase/server";
import {
  BusinessCustomer,
  BusinessProvider,
  CustomerLookupArgs,
  CustomerLookupResult,
} from "../type";

function mapCustomer(row: any): BusinessCustomer {
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

export const supabaseBusinessProvider: BusinessProvider = {
  async customerLookup(
    args: CustomerLookupArgs,
  ): Promise<CustomerLookupResult> {
    const supabaseServer = getSupabaseServer();

    const name = args.customerIdentifier?.trim();
    const phone = args.phone?.trim();
    const email = args.email?.trim();

    let query = supabaseServer
      .from("customers")
      .select("*")

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
};
