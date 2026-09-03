import { createClient } from "@supabase/supabase-js";
import { createLocalSupabaseClient } from "./local-db";

const supabaseUrl =
  (typeof process !== "undefined" && (process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"])) ||
  import.meta.env?.VITE_SUPABASE_URL ||
  import.meta.env?.SUPABASE_URL;

const supabaseSecretKey =
  (typeof process !== "undefined" &&
    (process.env["SUPABASE_SECRET_KEY"] ||
      process.env["SUPABASE_SERVICE_ROLE_KEY"] ||
      process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
      process.env["SUPABASE_PUBLISHABLE_KEY"])) ||
  import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env?.SUPABASE_PUBLISHABLE_KEY;

function createSupabaseAdminClient() {
  if (supabaseUrl && supabaseSecretKey && !supabaseUrl.includes("placeholder")) {
    return createClient(supabaseUrl, supabaseSecretKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return createLocalSupabaseClient();
}

let _supabaseAdmin: any;

// Server-side Supabase client with service role - bypasses RLS
// SECURITY: Only use this for trusted server-side operations, never expose to client code
// Load inside server handlers: const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
// Top-level import is safe only in other .server.ts modules - route files and *.functions.ts ship to the client bundle.
export const supabaseAdmin = new Proxy({} as any, {
  get(_, prop, receiver) {
    if (!_supabaseAdmin) _supabaseAdmin = createSupabaseAdminClient();
    return Reflect.get(_supabaseAdmin, prop, receiver);
  },
});



