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
  console.log("Removing Alex Rivera (employee@bi-tracker.local) from projects 1 & 3...");
  const empId = 'a0000000-0000-4000-8000-000000000003';
  const proj1 = 'b0000000-0000-4000-8000-000000000001';
  const proj3 = 'b0000000-0000-4000-8000-000000000003';

  const { error } = await supabase
    .from("project_assignments")
    .delete()
    .eq("user_id", empId)
    .in("project_id", [proj1, proj3]);

  if (error) {
    console.error("Error deleting assignments:", error);
  } else {
    console.log("Successfully removed Alex Rivera from projects 1 & 3!");
  }
}

main().catch(console.error);
