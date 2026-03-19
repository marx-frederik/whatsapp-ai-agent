import { CustomerLookupSchema } from "@/features/ai/tools/defs/customer_lookup";
import { OrderCreateSchema } from "@/features/ai/tools/defs/order_create";
import z from "zod";

export type BusinessCustomer = {
  id: string;
  customerNumber: string;
  companyName: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  street: string | null;
  city: string | null;
  postalCode: string | null;
  notes: string | null;
  createdAt: string;
};

export type CustomerLookupArgs = z.infer<typeof CustomerLookupSchema>;

export type CustomerLookupResult =
  | {
      ok: true;
      customers: BusinessCustomer[];
    }
  | {
      ok: false;
      code: "CUSTOMER_LOOKUP_FAILED";
      message: string;
    };

export type Order = {
  id: string;
  order_number: string;
  customer_id: string;
  type: string;
  status: string;
  requested_date: string | null;
  notes: string | null;
  created_at: string;
};

export type OrderCreateArgs = z.infer<typeof OrderCreateSchema>;

export type OrderCreateResult =
  | {
      ok: true;
      message: string;
      order: Order;
    }
  | {
      ok: false;
      code: "ORDER_CREATE_FAILED";
      message: string;
    }
  | {
      ok: false;
      code: "CUSTOMER_NOT_FOUND";
      message: string;
    }
  | {
      ok: false;
      code: "FOLLOW_UP_REQUIRED";
      message: string;
      options?: string[];
    };

export interface BusinessProvider {
  customerLookup(args: CustomerLookupArgs): Promise<CustomerLookupResult>;
  orderCreate(
    args: OrderCreateArgs,
    debug: boolean,
  ): Promise<OrderCreateResult>;
}
