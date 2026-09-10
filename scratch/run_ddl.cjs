const { Client } = require("pg");

const user = "postgres.iirwkucgqbzwuwoxtacs";
const pass = "BiTracker@07";
const hosts = [
  "aws-0-ap-south-1.pooler.supabase.com",
  "aws-0-us-east-1.pooler.supabase.com",
  "aws-0-eu-central-1.pooler.supabase.com",
  "db.iirwkucgqbzwuwoxtacs.supabase.co"
];

async function tryConnect(h, port, u) {
  console.log(`Connecting to ${h}:${port} with user ${u}...`);
  const client = new Client({
    user: u,
    host: h,
    database: "postgres",
    password: pass,
    port: port,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000
  });

  try {
    await client.connect();
    console.log(`SUCCESS! Connected to ${h}:${port}! Executing DDL...`);
    await client.query(`
      ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS clock_in_lat NUMERIC;
      ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS clock_in_lng NUMERIC;
      ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS clock_in_location_name TEXT;
      ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS clock_out_lat NUMERIC;
      ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS clock_out_lng NUMERIC;
      ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS clock_out_location_name TEXT;
    `);
    console.log("MIGRATION COMPLETED SUCCESSFULLY!");
    await client.end();
    return true;
  } catch (err) {
    console.log(`Failed ${h}:${port} (${u}) -> ${err.message}`);
    try { await client.end(); } catch {}
    return false;
  }
}

async function main() {
  for (const h of hosts) {
    if (await tryConnect(h, 6543, user)) break;
    if (await tryConnect(h, 5432, user)) break;
    if (await tryConnect(h, 5432, "postgres")) break;
  }
}

main().catch(console.error);
