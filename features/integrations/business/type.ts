import { CustomerCreateSchema } from "@/features/ai/tools/defs/customer_create";
import { CustomerUpdateSchema } from "@/features/ai/tools/defs/customer_update";
import { JobCompleteSchema } from "@/features/ai/tools/defs/job_complete";
import { JobDispatchSchema } from "@/features/ai/tools/defs/job_dispatch";
import { JobLookupSchema } from "@/features/ai/tools/defs/job_lookup";
import { JobUpdateSchema } from "@/features/ai/tools/defs/job_update";
import { NoteCreateSchema } from "@/features/ai/tools/defs/note_create";
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
      code: "FOLLOW_UP_REQUIRED" | "CUSTOMER_LOOKUP_FAILED";
      message: string;
      options?: string[];
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

export type CustomerUpdateArgs = z.infer<typeof CustomerUpdateSchema>;

export type CustomerUpdateResult =
  | {
      ok: true;
      message: string;
      customer: BusinessCustomer;
      updatedFields: string[];
    }
  | {
      ok: false;
      code:
        | "FOLLOW_UP_REQUIRED"
        | "CUSTOMER_LOOKUP_FAILED"
        | "CUSTOMER_UPDATE_FAILED";
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

export type BusinessEmployee = {
  id: string;
  employeeNumber: string;
  fullName: string;
  role: string;
  phone: string | null;
  email: string | null;
  active: boolean;
  createdAt: string;
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

export type JobDispatchArgs = z.infer<typeof JobDispatchSchema>;

export type JobDispatchResult =
  | {
      ok: true;
      message: string;
      job: Job;
      employee: BusinessEmployee;
    }
  | {
      ok: false;
      code:
        | "FOLLOW_UP_REQUIRED"
        | "EMPLOYEE_LOOKUP_FAILED"
        | "JOB_LOOKUP_FAILED"
        | "JOB_DISPATCH_FAILED";
      message: string;
      options?: string[];
    };

export type JobCompleteArgs = z.infer<typeof JobCompleteSchema>;

export type JobCompleteResult =
  | {
      ok: true;
      message: string;
      job: Job;
    }
  | {
      ok: false;
      code:
        | "FOLLOW_UP_REQUIRED"
        | "JOB_LOOKUP_FAILED"
        | "JOB_COMPLETE_FAILED";
      message: string;
      options?: string[];
    };

export type JobUpdateArgs = z.infer<typeof JobUpdateSchema>;

export type JobUpdateResult =
  | {
      ok: true;
      message: string;
      job: Job;
      updatedFields: string[];
    }
  | {
      ok: false;
      code:
        | "FOLLOW_UP_REQUIRED"
        | "JOB_LOOKUP_FAILED"
        | "JOB_UPDATE_FAILED";
      message: string;
      options?: string[];
    };

export type JobLookupArgs = z.infer<typeof JobLookupSchema>;

export type JobLookupResult =
  | {
      ok: true;
      message: string;
      job: Job;
      customerName: string;
      assignedEmployeeName: string | null;
    }
  | {
      ok: false;
      code: "FOLLOW_UP_REQUIRED" | "JOB_LOOKUP_FAILED";
      message: string;
      options?: string[];
    };

export type NoteCreateArgs = z.infer<typeof NoteCreateSchema>;

export type NoteCreateResult =
  | {
      ok: true;
      message: string;
      job: Job;
      appendedNote: string;
    }
  | {
      ok: false;
      code: "FOLLOW_UP_REQUIRED" | "JOB_LOOKUP_FAILED" | "NOTE_CREATE_FAILED";
      message: string;
      options?: string[];
    };

export interface BusinessProvider {
  customerLookup(args: CustomerLookupArgs): Promise<CustomerLookupResult>;
  customerCreate(
    args: CustomerCreateArgs,
    debug: boolean,
  ): Promise<CustomerCreateResult>;
  customerUpdate(
    args: CustomerUpdateArgs,
    debug: boolean,
  ): Promise<CustomerUpdateResult>;
  orderCreate(
    args: OrderCreateArgs,
    debug: boolean,
  ): Promise<OrderCreateResult>;
  jobCreate(args: JobCreateArgs, debug: boolean): Promise<JobCreateResult>;
  jobDispatch(
    args: JobDispatchArgs,
    debug: boolean,
  ): Promise<JobDispatchResult>;
  jobComplete(
    args: JobCompleteArgs,
    debug: boolean,
  ): Promise<JobCompleteResult>;
  jobUpdate(args: JobUpdateArgs, debug: boolean): Promise<JobUpdateResult>;
  jobLookup(args: JobLookupArgs, debug: boolean): Promise<JobLookupResult>;
  noteCreate(args: NoteCreateArgs, debug: boolean): Promise<NoteCreateResult>;
}
