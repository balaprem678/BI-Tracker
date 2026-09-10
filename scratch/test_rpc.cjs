const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");

const envText = fs.readFileSync(".env", "utf8");
const envVars = {};
for (const line of envText.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx !== -1) {
    const k = trimmed.substring(0, eqIdx).trim();
    let v = trimmed.substring(eqIdx + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    envVars[k] = v;
  }
}

const url = envVars.SUPABASE_URL || envVars.VITE_SUPABASE_URL;
const key = envVars.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key);

async function main() {
  console.log("Testing RPC functions to execute SQL...");
  const sql = `
    ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS clock_in_lat NUMERIC;
    ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS clock_in_lng NUMERIC;
    ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS clock_in_location_name TEXT;
    ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS clock_out_lat NUMERIC;
    ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS clock_out_lng NUMERIC;
    ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS clock_out_location_name TEXT;
  `;

  // Test various common RPC function names
  const rpcNames = ["exec_sql", "execute_sql", "run_sql", "exec"];
  for (const name of rpcNames) {
    console.log(`Trying rpc("${name}")...`);
    const { data, error } = await supabase.rpc(name, { query: sql, sql: sql, sql_query: sql });
    if (!error) {
      console.log(`✅ SUCCESS WITH RPC "${name}"! Result:`, data);
      return;
    } else {
      console.log(`RPC "${name}" error:`, error.message);
    }
  }
}

main().catch(console.error);
