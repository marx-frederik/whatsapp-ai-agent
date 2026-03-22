import { CustomerCreateSchema } from "@/features/ai/tools/defs/customer_create";
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

export type CustomerCreateArgs = z.infer<typeof CustomerCreateSchema>;

export type CustomerCreateResult =
  | {
      ok: true;
      message: string;
      customer: BusinessCustomer;
      customerCreated: boolean;
      missingFields: string[];
    }
  | {
      ok: false;
      code:
        | "FOLLOW_UP_REQUIRED"
        | "CUSTOMER_LOOKUP_FAILED"
        | "CUSTOMER_CREATE_FAILED";
      message: string;
      options?: string[];
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

export type Job = {
  id: string;
  job_number: string;
  customer_id: string;
  order_id: string | null;
  assigned_employee_id: string | null;
  status: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
};

export type JobCreateArgs = {
  customerName: string;
  street?: string | null;
  city?: string | null;
  postalCode?: string | null;
  phone?: string | null;
  email?: string | null;
  note?: string | null;
};

export type JobCreateResult =
  | {
      ok: true;
      message: string;
      customer: BusinessCustomer;
      customerCreated: boolean;
      missingFields: string[];
      job: Job;
    }
  | {
      ok: false;
      code:
        | "FOLLOW_UP_REQUIRED"
        | "CUSTOMER_LOOKUP_FAILED"
        | "CUSTOMER_CREATE_FAILED"
        | "JOB_CREATE_FAILED";
      message: string;
      options?: string[];
    };

export interface BusinessProvider {
  customerLookup(args: CustomerLookupArgs): Promise<CustomerLookupResult>;
  customerCreate(
    args: CustomerCreateArgs,
    debug: boolean,
  ): Promise<CustomerCreateResult>;
  orderCreate(
    args: OrderCreateArgs,
    debug: boolean,
  ): Promise<OrderCreateResult>;
  jobCreate(args: JobCreateArgs, debug: boolean): Promise<JobCreateResult>;
}
