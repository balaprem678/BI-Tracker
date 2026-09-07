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

console.log('🔗 Testing connection to Supabase Cloud URL:', url);

const supabase = createClient(url, key);

async function checkConnection() {
  try {
    const { data, error } = await supabase.from('profiles').select('id, full_name, email').limit(5);
    
    if (error) {
      console.error('❌ DB Error:', error.message);
    } else {
      console.log('✅ SUCCESSFULLY CONNECTED TO SUPABASE CLOUD DATABASE!');
      console.log('📋 Existing profiles in Cloud DB:', data);
    }
  } catch (err) {
    console.error('❌ Exception connecting:', err);
  }
}

checkConnection();
