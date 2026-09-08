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
  const userId = 'a0000000-0000-4000-8000-000000000003'; // Alex Rivera

  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const isAdmin = (roles ?? []).some((r) => r.role === "admin");
  const isSubAdmin = (roles ?? []).some((r) => r.role === "sub_admin");

  const [{ data: allProjects }, { data: assignments }] = await Promise.all([
    supabase.from("projects").select("*"),
    supabase.from("project_assignments").select("project_id, user_id"),
  ]);

  const assignedProjectIds = new Set(
    (assignments ?? []).filter((a) => a.user_id === userId).map((a) => a.project_id),
  );

  let filteredProjects = [];
  if (isAdmin) {
    filteredProjects = allProjects ?? [];
  } else if (isSubAdmin) {
    filteredProjects = (allProjects ?? []).filter((p) => p.assigned_sub_admin_id === userId);
  } else {
    filteredProjects = (allProjects ?? []).filter((p) => assignedProjectIds.has(p.id));
  }

  console.log(`User Alex Rivera (role employee) assigned project count: ${filteredProjects.length}`);
  console.log("Visible Projects for Alex Rivera:", filteredProjects.map(p => p.name));
}

main().catch(console.error);
