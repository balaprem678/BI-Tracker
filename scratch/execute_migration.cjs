const https = require("https");
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

const sql = `
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS clock_in_lat NUMERIC;
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS clock_in_lng NUMERIC;
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS clock_in_location_name TEXT;
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS clock_out_lat NUMERIC;
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS clock_out_lng NUMERIC;
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS clock_out_location_name TEXT;
`;

// Try calling Supabase SQL query API if accessible, or pg
async function runSql() {
  const projectRef = envVars.SUPABASE_PROJECT_ID || "iirwkucgqbzwuwoxtacs";
  const secretKey = envVars.SUPABASE_SECRET_KEY || envVars.SUPABASE_SERVICE_ROLE_KEY;

  console.log(`Executing SQL migration for project ${projectRef}...`);
  const req = https.request(`https://${projectRef}.supabase.co/rest/v1/rpc/exec_sql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": secretKey,
      "Authorization": `Bearer ${secretKey}`,
    }
  }, (res) => {
    let body = "";
    res.on("data", chunk => body += chunk);
    res.on("end", () => {
      console.log("Response:", res.statusCode, body);
    });
  });

  req.write(JSON.stringify({ query: sql }));
  req.end();
}

runSql().catch(console.error);
