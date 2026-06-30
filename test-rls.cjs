const { createClient } = require('@supabase/supabase-js');

// Com service key (bypassa RLS)
const sAdmin = createClient('https://kiifogmalbkcbwalhctc.supabase.co','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpaWZvZ21hbGJrY2J3YWxoY3RjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjEzOTk4NiwiZXhwIjoyMDk3NzE1OTg2fQ.aHqLdThV8jKWRO1dPqk_3qS_rzocVv4ZymXYetaOhHk');

// Com anon key (respeita RLS)
const sAnon = createClient('https://kiifogmalbkcbwalhctc.supabase.co','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpaWZvZ21hbGJrY2J3YWxoY3RjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxMzk5ODYsImV4cCI6MjA5NzcxNTk4Nn0.UVMyUg_xiZ6FEZ6b7_jDb3YpyR5_rNy2qXZOIrol5LU');

async function run() {
  // Check se RLS está ativado em mensalidades
  const { count: adminCount } = await sAdmin.from('mensalidades').select('*', { count: 'exact', head: true });
  const { count: anonCount } = await sAnon.from('mensalidades').select('*', { count: 'exact', head: true });
  
  console.log('Service role (bypassa RLS):', adminCount);
  console.log('Anon (respeita RLS):', anonCount);
  
  if (adminCount > 0 && anonCount === 0) {
    console.log('\n⚠️ RLS está bloqueando! Precisa de policy para mensalidades.');
  }
}
run();
