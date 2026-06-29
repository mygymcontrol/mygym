const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://kiifogmalbkcbwalhctc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpaWZvZ21hbGJrY2J3YWxoY3RjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjEzOTk4NiwiZXhwIjoyMDk3NzE1OTg2fQ.aHqLdThV8jKWRO1dPqk_3qS_rzocVv4ZymXYetaOhHk',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function run() {
  console.log('=== ACADEMIAS ===');
  const { data: academias } = await supabase.from('academias').select('*');
  console.log(JSON.stringify(academias, null, 2));

  console.log('\n=== SUPER ADMINS ===');
  const { data: superAdmins } = await supabase.from('super_admins').select('*');
  console.log(JSON.stringify(superAdmins, null, 2));

  console.log('\n=== PROFILES ===');
  const { data: profiles } = await supabase.from('profiles').select('*');
  console.log(JSON.stringify(profiles, null, 2));

  console.log('\n=== AUTH USERS ===');
  const { data: users } = await supabase.auth.admin.listUsers();
  users.users.forEach(u => {
    console.log(`  ${u.email} | role: ${u.user_metadata?.role} | id: ${u.id}`);
  });
}

run();
