const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://kiifogmalbkcbwalhctc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpaWZvZ21hbGJrY2J3YWxoY3RjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjEzOTk4NiwiZXhwIjoyMDk3NzE1OTg2fQ.aHqLdThV8jKWRO1dPqk_3qS_rzocVv4ZymXYetaOhHk',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function run() {
  // Remover super admin antigo
  await supabase.from('super_admins').delete().eq('email', 'covalsqui.arrabal@gmail.com');
  console.log('✅ Removido super admin: covalsqui.arrabal@gmail.com');

  // Adicionar novo super admin
  const { data: user } = await supabase.auth.admin.listUsers();
  const newAdmin = user.users.find(u => u.email === 'covalsqui.arrabal1@gmail.com');
  
  if (newAdmin) {
    await supabase.from('super_admins').insert({
      user_id: newAdmin.id,
      email: 'covalsqui.arrabal1@gmail.com',
    });
    console.log('✅ Novo super admin: covalsqui.arrabal1@gmail.com');
  } else {
    console.log('❌ Usuário covalsqui.arrabal1@gmail.com não encontrado no auth');
  }
}

run();
