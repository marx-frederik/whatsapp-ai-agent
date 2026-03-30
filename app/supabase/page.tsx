import { unstable_noStore as noStore } from "next/cache";
import {
  Briefcase,
  Package,
  ShoppingCart,
  UserCheck,
  Users,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/data-table/data-table";
import {
  customerColumns,
  employeeColumns,
  jobColumns,
  orderColumns,
  orderItemColumns,
} from "@/components/data-table/columns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getSupabaseServer } from "@/services/supabase/server";
import type { Customer, Employee, Job, Order, OrderItem } from "@/lib/types";

type OverviewData = {
  customers: Customer[];
  orders: Order[];
  orderItems: OrderItem[];
  jobs: Job[];
  employees: Employee[];
};

async function loadOverviewData(): Promise<OverviewData> {
  const supabase = getSupabaseServer();

  const [
    customersResult,
    ordersResult,
    orderItemsResult,
    jobsResult,
    employeesResult,
  ] = await Promise.all([
    supabase.from("customers").select("*").order("created_at", { ascending: false }),
    supabase.from("orders").select("*").order("created_at", { ascending: false }),
    supabase
      .from("order_items")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase.from("jobs").select("*").order("created_at", { ascending: false }),
    supabase.from("employees").select("*").order("created_at", { ascending: false }),
  ]);

  const firstError =
    customersResult.error ||
    ordersResult.error ||
    orderItemsResult.error ||
    jobsResult.error ||
    employeesResult.error;

  if (firstError) {
    throw new Error(firstError.message);
  }

  const customers = (customersResult.data ?? []).map((customer) => ({
    ...customer,
    display_name:
      customer.company_name || customer.contact_name || customer.customer_number,
  }));

  const customerLabelsById = new Map(
    customers.map((customer) => [
      customer.id,
      customer.display_name,
    ]),
  );

  const employees = employeesResult.data ?? [];
  const employeeNamesById = new Map(
    employees.map((employee) => [employee.id, employee.full_name]),
  );

  return {
    customers,
    orders: (ordersResult.data ?? []).map((order) => ({
      ...order,
      customer_label: customerLabelsById.get(order.customer_id) ?? order.customer_id,
    })),
    orderItems: (orderItemsResult.data ?? []).map((item) => ({
      ...item,
      line_total: (item.unit_price ?? 0) * item.quantity,
    })),
    jobs: (jobsResult.data ?? []).map((job) => ({
      ...job,
      customer_label: customerLabelsById.get(job.customer_id) ?? job.customer_id,
      employee_name: job.assigned_employee_id
        ? employeeNamesById.get(job.assigned_employee_id) ?? null
        : null,
    })),
    employees,
  };
}

export default async function DatabaseOverviewPage() {
  noStore();

  let data: OverviewData = {
    customers: [],
    orders: [],
    orderItems: [],
    jobs: [],
    employees: [],
  };
  let loadError: string | null = null;

  try {
    data = await loadOverviewData();
  } catch (error) {
    loadError =
      error instanceof Error
        ? error.message
        : "Die Supabase-Daten konnten nicht geladen werden.";
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">
            Supabase Datenbank-Uebersicht
          </h1>
          <p className="mt-2 text-muted-foreground">
            Live-Daten aus den Tabellen fuer Kunden, Bestellungen, Positionen,
            Jobs und Mitarbeiter.
          </p>
        </header>

        {loadError ? (
          <Card className="mb-8 border-destructive/30">
            <CardHeader>
              <CardTitle>Daten konnten nicht geladen werden</CardTitle>
              <CardDescription>{loadError}</CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        <div className="mb-8 grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Kunden</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.customers.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Bestellungen</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.orders.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Positionen</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.orderItems.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Jobs</CardTitle>
              <Briefcase className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.jobs.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Mitarbeiter</CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.employees.length}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="customers" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="customers">Kunden</TabsTrigger>
            <TabsTrigger value="orders">Bestellungen</TabsTrigger>
            <TabsTrigger value="order_items">Positionen</TabsTrigger>
            <TabsTrigger value="jobs">Jobs</TabsTrigger>
            <TabsTrigger value="employees">Mitarbeiter</TabsTrigger>
          </TabsList>

          <TabsContent value="customers">
            <Card>
              <CardHeader>
                <CardTitle>Kunden</CardTitle>
                <CardDescription>
                  Alle Kunden aus der Tabelle &quot;customers&quot;
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DataTable
                  columns={customerColumns}
                  data={data.customers}
                  searchKey="display_name"
                  searchPlaceholder="Nach Kunde suchen..."
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <CardTitle>Bestellungen</CardTitle>
                <CardDescription>
                  Alle Bestellungen aus der Tabelle &quot;orders&quot;
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DataTable
                  columns={orderColumns}
                  data={data.orders}
                  searchKey="order_number"
                  searchPlaceholder="Nach Bestellnummer suchen..."
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="order_items">
            <Card>
              <CardHeader>
                <CardTitle>Bestellpositionen</CardTitle>
                <CardDescription>
                  Alle Positionen aus der Tabelle &quot;order_items&quot;
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DataTable
                  columns={orderItemColumns}
                  data={data.orderItems}
                  searchKey="name"
                  searchPlaceholder="Nach Positionsname suchen..."
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="jobs">
            <Card>
              <CardHeader>
                <CardTitle>Jobs</CardTitle>
                <CardDescription>
                  Alle Auftraege aus der Tabelle &quot;jobs&quot;
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DataTable
                  columns={jobColumns}
                  data={data.jobs}
                  searchKey="job_number"
                  searchPlaceholder="Nach Auftragsnummer suchen..."
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="employees">
            <Card>
              <CardHeader>
                <CardTitle>Mitarbeiter</CardTitle>
                <CardDescription>
                  Alle Mitarbeiter aus der Tabelle &quot;employees&quot;
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DataTable
                  columns={employeeColumns}
                  data={data.employees}
                  searchKey="full_name"
                  searchPlaceholder="Nach Mitarbeiter suchen..."
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
