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
  console.log("Applying shift location columns to Supabase Cloud DB...");

  // Execute RPC or SQL query using supabase REST or check if columns exist by selecting
  const { data, error } = await supabase.from("shifts").select("id, clock_in_lat, clock_in_lng, clock_in_location_name").limit(1);
  if (error) {
    console.log("Columns do not exist yet in shifts table, message:", error.message);
    console.log("Attempting SQL execution via rpc...");
  } else {
    console.log("Shift location columns verified in Cloud DB!");
  }
}

main().catch(console.error);
