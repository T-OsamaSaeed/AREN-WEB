import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log("VITE_SUPABASE_URL exists:", Boolean(supabaseUrl));
console.log("VITE_SUPABASE_ANON_KEY exists:", Boolean(supabaseAnonKey));
console.log("VITE_SUPABASE_URL preview:", supabaseUrl ? supabaseUrl.slice(0, 30) : "missing");

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export function getSupabaseDebugInfo() {
  return {
    hasUrl: Boolean(supabaseUrl),
    hasAnonKey: Boolean(supabaseAnonKey),
    urlPreview: supabaseUrl ? supabaseUrl.slice(0, 30) + "..." : "missing",
  };
}
