// src/lib/supabase/server.ts
import { env } from "@/data/env/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

let supabaseServer: SupabaseClient<Database> | null = null;

export function getSupabaseServer(): SupabaseClient<Database> {
  if (supabaseServer) {
    return supabaseServer;
  }

  const url = env.SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required when using Supabase.",
    );
  }

  supabaseServer = createClient<Database>(url, serviceRoleKey);
  return supabaseServer;
}
