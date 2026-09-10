const { createClient } = require('@supabase/supabase-js');

const url = 'https://iirwkucgqbzwuwoxtacs.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpcndrdWNncWJ6d3V3b3h0YWNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAxNzMyNzcsImV4cCI6MjA1NTc0OTI3N30.rQy4m47k-q-_9L6K6J7QW8z9pL0M1_1_2_3'; // dummy/anon token

const supabase = createClient(url, key);

async function test() {
  console.log("Testing shifts query with location columns...");
  let { data: shifts, error: sError } = await supabase
    .from("shifts")
    .select("id, clock_in, clock_out, note, clock_in_lat, clock_in_lng, clock_in_location_name, clock_out_lat, clock_out_lng, clock_out_location_name, created_at")
    .limit(5);

  if (sError) {
    console.error("❌ ERROR SELECTING SHIFTS WITH LOCATION:", sError.message);
  } else {
    console.log("✅ SUCCESS SELECTING SHIFTS:", shifts);
  }
}

test();
