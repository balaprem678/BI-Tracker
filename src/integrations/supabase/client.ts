import { createClient } from "@supabase/supabase-js";
import { createLocalSupabaseClient } from "./local-db";

const supabaseUrl =
  (typeof process !== "undefined" && (process.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"])) ||
  import.meta.env?.VITE_SUPABASE_URL ||
  import.meta.env?.SUPABASE_URL;

const supabaseKey =
  (typeof process !== "undefined" &&
    (process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] || process.env["SUPABASE_PUBLISHABLE_KEY"])) ||
  import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env?.SUPABASE_PUBLISHABLE_KEY;

function createSupabaseClient() {
  if (supabaseUrl && supabaseKey && !supabaseUrl.includes("placeholder")) {
    return createClient(supabaseUrl, supabaseKey);
  }
  return createLocalSupabaseClient();
}

let _supabase: any;

export const supabase = new Proxy({} as any, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});




