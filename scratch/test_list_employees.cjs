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

async function testListEmployees() {
  try {
    const [{ data: profiles, error }, { data: roles, error: rErr }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, email, full_name, job_title, department, staff_section, hourly_rate, is_active")
        .order("full_name", { ascending: true }),
      supabase.from("user_roles").select("user_id, role"),
    ]);

    if (error) {
      console.error('❌ Profiles query error:', error.message);
      return;
    }

    const adminIds = new Set((roles ?? []).filter((r) => r.role === 'admin').map((r) => r.user_id));
    const subAdminIds = new Set((roles ?? []).filter((r) => r.role === 'sub_admin').map((r) => r.user_id));

    const employees = (profiles ?? []).map((p) => ({
      ...p,
      role: adminIds.has(p.id) ? 'admin' : subAdminIds.has(p.id) ? 'sub_admin' : 'employee',
    }));

    console.log('✅ List employees result count:', employees.length);
    console.log('📋 All Employees from Live DB:', employees);
  } catch (err) {
    console.error('❌ Error testing listEmployees:', err);
  }
}

testListEmployees();
