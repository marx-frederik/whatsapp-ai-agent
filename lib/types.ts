import type { Database } from "@/services/supabase/database.types";

type CustomerRow = Database["public"]["Tables"]["customers"]["Row"];
type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type OrderItemRow = Database["public"]["Tables"]["order_items"]["Row"];
type JobRow = Database["public"]["Tables"]["jobs"]["Row"];
type EmployeeRow = Database["public"]["Tables"]["employees"]["Row"];

export type Customer = CustomerRow & {
  display_name: string;
};

export type Order = OrderRow & {
  customer_label: string;
};

export type OrderItem = OrderItemRow & {
  line_total: number;
};

export type Job = JobRow & {
  customer_label: string;
  employee_name: string | null;
};

export type Employee = EmployeeRow;
