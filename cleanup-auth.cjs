const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://kiifogmalbkcbwalhctc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpaWZvZ21hbGJrY2J3YWxoY3RjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjEzOTk4NiwiZXhwIjoyMDk3NzE1OTg2fQ.aHqLdThV8jKWRO1dPqk_3qS_rzocVv4ZymXYetaOhHk',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function run() {
  console.log('Buscando usuários de teste...');
  
  const { data: users, error } = await supabase.auth.admin.listUsers();
  if (error) { console.log('❌ Erro:', error.message); return; }

  const testUsers = users.users.filter(u => {
    // Manter apenas o admin principal (covalsqui.arrabal@gmail.com com role admin)
    const meta = u.user_metadata || {};
    if (u.email === 'covalsqui.arrabal@gmail.com' && meta.role === 'admin') return false;
    // Todos os outros são de teste
    return true;
  });

  console.log(`Encontrados ${testUsers.length} usuários para remover:`);
  testUsers.forEach(u => console.log(`  - ${u.email} (${u.user_metadata?.role || 'sem role'})`));

  if (testUsers.length === 0) {
    console.log('✅ Nenhum usuário de teste para remover.');
    return;
  }

  for (const user of testUsers) {
    const { error: delError } = await supabase.auth.admin.deleteUser(user.id);
    if (delError) {
      console.log(`  ❌ Erro ao remover ${user.email}: ${delError.message}`);
    } else {
      console.log(`  ✅ Removido: ${user.email}`);
    }
  }

  // Limpar tabela profiles (exceto admin)
  await supabase.from('profiles').delete().neq('role', 'admin');
  
  console.log('\n✅ Limpeza concluída! Sistema pronto para uso.');
}

run();
