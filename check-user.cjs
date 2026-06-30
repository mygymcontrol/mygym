const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://kiifogmalbkcbwalhctc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpaWZvZ21hbGJrY2J3YWxoY3RjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjEzOTk4NiwiZXhwIjoyMDk3NzE1OTg2fQ.aHqLdThV8jKWRO1dPqk_3qS_rzocVv4ZymXYetaOhHk',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function run() {
  const email = 'covalsqui.arrabal1@gmail.com';

  // Auth user
  const { data: users } = await supabase.auth.admin.listUsers();
  const user = users.users.find(u => u.email === email);
  console.log('=== AUTH USER ===');
  console.log('  ID:', user?.id);
  console.log('  Email:', user?.email);
  console.log('  Role metadata:', user?.user_metadata?.role);
  console.log('  Confirmed:', user?.email_confirmed_at ? 'sim' : 'NÃO');

  // Profiles
  const { data: profiles } = await supabase.from('profiles').select('*').eq('email', email);
  console.log('\n=== PROFILES (todos) ===');
  console.log(JSON.stringify(profiles, null, 2));

  // Academias como proprietario
  const { data: academias } = await supabase.from('academias').select('*').eq('email_proprietario', email);
  console.log('\n=== ACADEMIAS (proprietario) ===');
  console.log(JSON.stringify(academias, null, 2));

  // Super admin?
  const { data: sa } = await supabase.from('super_admins').select('*').eq('email', email);
  console.log('\n=== SUPER ADMIN? ===');
  console.log(sa && sa.length > 0 ? 'SIM' : 'NÃO');
}

run();
