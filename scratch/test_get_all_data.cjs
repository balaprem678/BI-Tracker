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
  console.log("Testing shift query with fallback...");
  const employeeId = "a0000000-0000-4000-8000-000000000003";

  let shifts = null;
  const shiftRes = await supabase
    .from("shifts")
    .select("id, clock_in, clock_out, note, clock_in_lat, clock_in_lng, clock_in_location_name, clock_out_lat, clock_out_lng, clock_out_location_name, created_at")
    .eq("user_id", employeeId)
    .order("clock_in", { ascending: false });

  if (shiftRes.error) {
    console.warn("⚠️ Primary shift query with location columns failed:", shiftRes.error.message);
    console.log("🔄 Running fallback shift query without location columns...");
    const fallbackRes = await supabase
      .from("shifts")
      .select("id, clock_in, clock_out, note, created_at")
      .eq("user_id", employeeId)
      .order("clock_in", { ascending: false });
    
    if (fallbackRes.error) {
      console.error("❌ Fallback query failed:", fallbackRes.error.message);
    } else {
      console.log("✅ Fallback query succeeded! Fetched shifts count:", fallbackRes.data.length);
    }
  } else {
    console.log("✅ Primary shift query succeeded! Fetched shifts count:", shiftRes.data.length);
  }
}

main().catch(console.error);
