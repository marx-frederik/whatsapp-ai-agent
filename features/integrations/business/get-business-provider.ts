import { supabaseBusinessProvider } from "./providers/supabase-business-provider";
import { BusinessProvider } from "./type";

export function getBusinessProvider(): BusinessProvider {
  return supabaseBusinessProvider;
}
