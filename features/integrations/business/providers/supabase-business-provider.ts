import { getSupabaseServer } from "@/services/supabase/server";
import {
  BusinessCustomer,
  BusinessProvider,
  CustomerLookupArgs,
  CustomerLookupResult,
  Order,
  OrderCreateArgs,
  OrderCreateResult,
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
};
