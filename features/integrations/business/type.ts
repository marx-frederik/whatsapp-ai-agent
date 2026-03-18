import { CustomerLookupSchema } from "@/features/ai/tools/defs/customer_lookup";
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

export type CustomerLookupArgs = z.infer<typeof CustomerLookupSchema>

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

export interface BusinessProvider {
  customerLookup(args: CustomerLookupArgs): Promise<CustomerLookupResult>;
}
