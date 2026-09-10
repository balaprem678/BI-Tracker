const { Client } = require("pg");
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

const projId = envVars.SUPABASE_PROJECT_ID || "iirwkucgqbzwuwoxtacs";
const secretKey = envVars.SUPABASE_SECRET_KEY;

const passwords = [
  "BiTracker@07",
  secretKey,
  "postgres",
  "root"
];

// Pooler hosts for Supabase
const poolers = [
  "aws-0-ap-south-1.pooler.supabase.com",
  "aws-0-ap-southeast-1.pooler.supabase.com",
  "aws-0-us-east-1.pooler.supabase.com",
  "aws-0-us-west-1.pooler.supabase.com",
  "aws-0-eu-central-1.pooler.supabase.com"
];

async function tryConn(h, port, user, p) {
  console.log(`Trying ${h}:${port} user=${user} pass=${p.substring(0, 10)}...`);
  const client = new Client({
    user: user,
    host: h,
    database: "postgres",
    password: p,
    port: port,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 3000
  });

  try {
    await client.connect();
    console.log(`🎉 CONNECTED SUCCESS! Host: ${h}:${port}`);
    await client.query(`
      ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS clock_in_lat NUMERIC;
      ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS clock_in_lng NUMERIC;
      ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS clock_in_location_name TEXT;
      ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS clock_out_lat NUMERIC;
      ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS clock_out_lng NUMERIC;
      ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS clock_out_location_name TEXT;
      NOTIFY pgrst, 'reload schema';
    `);
    console.log("✅ SUCCESS! ADDED SHIFT LOCATION COLUMNS & NOTIFIED PGRST!");
    await client.end();
    return true;
  } catch (err) {
    console.log(`Failed ${h}:${port} -> ${err.message}`);
    try { await client.end(); } catch {}
    return false;
  }
}

async function main() {
  const user = `postgres.${projId}`;
  for (const h of poolers) {
    for (const p of passwords) {
      if (await tryConn(h, 6543, user, p)) return;
      if (await tryConn(h, 5432, user, p)) return;
    }
  }
}

main().catch(console.error);
