"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { Customer, Employee, Job, Order, OrderItem } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";

function SortableHeader({
  column,
  title,
}: {
  column: any;
  title: string;
}) {
  return (
    <Button
      variant="ghost"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      className="-ml-4"
    >
      {title}
      <ArrowUpDown className="ml-2 h-4 w-4" />
    </Button>
  );
}

function formatDate(dateString: string | null) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  return `${day}.${month}.${year}`;
}

function formatDateTime(dateString: string | null) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${day}.${month}.${year} ${hours}:${minutes}`;
}

function formatCurrency(amount: number | null) {
  const normalizedAmount = amount ?? 0;
  return `${normalizedAmount.toFixed(2).replace(".", ",")} EUR`;
}

function renderOrderStatus(status: string) {
  const variants: Record<
    string,
    "default" | "secondary" | "destructive" | "outline"
  > = {
    draft: "outline",
    pending: "outline",
    processing: "secondary",
    shipped: "secondary",
    delivered: "default",
    cancelled: "destructive",
  };

  return <Badge variant={variants[status] ?? "outline"}>{status}</Badge>;
}

function renderJobStatus(status: string) {
  const variants: Record<
    string,
    "default" | "secondary" | "destructive" | "outline"
  > = {
    new: "outline",
    scheduled: "secondary",
    done: "default",
    cancelled: "destructive",
  };

  return <Badge variant={variants[status] ?? "outline"}>{status}</Badge>;
}

export const customerColumns: ColumnDef<Customer>[] = [
  {
    accessorKey: "display_name",
    header: ({ column }) => <SortableHeader column={column} title="Name" />,
  },
  {
    accessorKey: "customer_number",
    header: "Kundennr.",
  },
  {
    accessorKey: "contact_name",
    header: "Kontakt",
    cell: ({ row }) => row.getValue("contact_name") || "-",
  },
  {
    accessorKey: "phone",
    header: "Telefon",
    cell: ({ row }) => row.getValue("phone") || "-",
  },
  {
    accessorKey: "city",
    header: ({ column }) => <SortableHeader column={column} title="Stadt" />,
    cell: ({ row }) => row.getValue("city") || "-",
  },
  {
    accessorKey: "created_at",
    header: "Erstellt",
    cell: ({ row }) => formatDate(row.getValue("created_at")),
  },
];

export const orderColumns: ColumnDef<Order>[] = [
  {
    accessorKey: "order_number",
    header: "Bestellnr.",
  },
  {
    accessorKey: "customer_label",
    header: ({ column }) => <SortableHeader column={column} title="Kunde" />,
  },
  {
    accessorKey: "type",
    header: "Typ",
  },
  {
    accessorKey: "requested_date",
    header: ({ column }) => <SortableHeader column={column} title="Datum" />,
    cell: ({ row }) => formatDate(row.getValue("requested_date")),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => renderOrderStatus(row.getValue("status")),
  },
];

export const orderItemColumns: ColumnDef<OrderItem>[] = [
  {
    accessorKey: "order_id",
    header: "Bestell-ID",
  },
  {
    accessorKey: "name",
    header: ({ column }) => <SortableHeader column={column} title="Position" />,
  },
  {
    accessorKey: "sku",
    header: "SKU",
    cell: ({ row }) => row.getValue("sku") || "-",
  },
  {
    accessorKey: "quantity",
    header: "Menge",
  },
  {
    accessorKey: "unit",
    header: "Einheit",
  },
  {
    accessorKey: "unit_price",
    header: "Einzelpreis",
    cell: ({ row }) => formatCurrency(row.getValue("unit_price")),
  },
  {
    accessorKey: "line_total",
    header: ({ column }) => <SortableHeader column={column} title="Gesamt" />,
    cell: ({ row }) => formatCurrency(row.getValue("line_total")),
  },
];

export const jobColumns: ColumnDef<Job>[] = [
  {
    accessorKey: "job_number",
    header: "Auftragsnr.",
  },
  {
    accessorKey: "customer_label",
    header: ({ column }) => <SortableHeader column={column} title="Kunde" />,
  },
  {
    accessorKey: "address",
    header: "Adresse",
    cell: ({ row }) => row.getValue("address") || "-",
  },
  {
    accessorKey: "employee_name",
    header: "Mitarbeiter",
    cell: ({ row }) => row.getValue("employee_name") || "-",
  },
  {
    accessorKey: "scheduled_start",
    header: ({ column }) => <SortableHeader column={column} title="Start" />,
    cell: ({ row }) => formatDateTime(row.getValue("scheduled_start")),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => renderJobStatus(row.getValue("status")),
  },
];

export const employeeColumns: ColumnDef<Employee>[] = [
  {
    accessorKey: "full_name",
    header: ({ column }) => <SortableHeader column={column} title="Name" />,
  },
  {
    accessorKey: "employee_number",
    header: "Mitarbeiternr.",
  },
  {
    accessorKey: "role",
    header: "Rolle",
  },
  {
    accessorKey: "email",
    header: "E-Mail",
    cell: ({ row }) => row.getValue("email") || "-",
  },
  {
    accessorKey: "phone",
    header: "Telefon",
    cell: ({ row }) => row.getValue("phone") || "-",
  },
  {
    accessorKey: "active",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant={row.getValue("active") ? "default" : "secondary"}>
        {row.getValue("active") ? "Aktiv" : "Inaktiv"}
      </Badge>
    ),
  },
];
