// src/lib/supabase/server.ts
import { env } from "@/data/env/server";
import { createClient } from "@supabase/supabase-js";

let supabaseServer: ReturnType<typeof createClient> | null = null;

export function getSupabaseServer() {
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

  supabaseServer = createClient(url, serviceRoleKey);
  return supabaseServer;
}
