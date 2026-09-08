const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');

const env = {};
envContent.split(/\r?\n/).forEach(line => {
  const match = line.match(/^\s*([\w_]+)\s*=\s*(.*)\s*$/);
  if (match) {
    let key = match[1];
    let val = match[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
});

const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(url, key);

async function alterColumns() {
  const sqlCommands = [
    "ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'Medium';",
    "ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS deadline TIMESTAMPTZ;",
    "ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC NOT NULL DEFAULT 0;",
    "ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS progress_percent INTEGER NOT NULL DEFAULT 0;",
    "ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS start_date DATE;",
    "ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS completion_date DATE;"
  ];

  for (const sql of sqlCommands) {
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql }).catch(() => ({ error: { message: 'no exec_sql' } }));
    if (error) {
      console.log('Exec SQL RPC not available directly via REST API (Standard for Supabase security).');
      break;
    }
  }
}

alterColumns();
