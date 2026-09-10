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
  console.log("Testing insert with location columns into shifts...");
  const dummyUserId = "a0000000-0000-4000-8000-000000000001";
  const { data, error } = await supabase.from("shifts").insert({
    user_id: dummyUserId,
    clock_in: new Date().toISOString(),
    clock_in_lat: 10.0159,
    clock_in_lng: 76.3419,
    clock_in_location_name: "10.0159°, 76.3419°"
  }).select();

  if (error) {
    console.error("Error inserting shift with location:", error.message);
  } else {
    console.log("SUCCESS! Inserted shift record with location:", data);
    // Cleanup dummy record
    if (data && data[0]) {
      await supabase.from("shifts").delete().eq("id", data[0].id);
      console.log("Cleaned up test record.");
    }
  }
}

main().catch(console.error);
