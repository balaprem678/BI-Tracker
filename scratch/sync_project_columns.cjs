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

async function syncSchema() {
  console.log('🔄 Checking live projects table columns...');
  const { data: projects, error } = await supabase.from('projects').select('*').limit(1);

  if (error) {
    console.error('❌ Query error:', error.message);
    return;
  }

  console.log('Current sample project columns:', projects && projects[0] ? Object.keys(projects[0]) : 'No rows yet');
}

syncSchema();
