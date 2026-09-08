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
  console.log("Checking DB assignments & roles...");
  const { data: profiles } = await supabase.from("profiles").select("id, full_name, email");
  console.log("Profiles:", profiles);

  const { data: roles } = await supabase.from("user_roles").select("*");
  console.log("User Roles:", roles);

  const { data: projects } = await supabase.from("projects").select("id, name, assigned_sub_admin_id");
  console.log("Projects:", projects);

  const { data: assignments } = await supabase.from("project_assignments").select("*");
  console.log("Project Assignments:", assignments);
}

main().catch(console.error);
