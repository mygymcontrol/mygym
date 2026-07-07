const { createClient } = require('@supabase/supabase-js');
const s = createClient('https://kiifogmalbkcbwalhctc.supabase.co','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpaWZvZ21hbGJrY2J3YWxoY3RjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjEzOTk4NiwiZXhwIjoyMDk3NzE1OTg2fQ.aHqLdThV8jKWRO1dPqk_3qS_rzocVv4ZymXYetaOhHk');

const ACADEMIA_ID = '3f239e12-6a92-4af1-9d98-c10ad81d6d3a';

async function run() {
  // Buscar todos os alunos da academia
  const { data: alunos } = await s.from('alunos').select('id, nome, email, cpf, user_id').eq('academia_id', ACADEMIA_ID);
  
  // Buscar todos os auth users
  const { data: authData } = await s.auth.admin.listUsers();
  const authUsers = authData?.users || [];
  const authEmails = new Set(authUsers.map(u => u.email?.toLowerCase()));

  // Buscar todos os profiles
  const { data: profiles } = await s.from('profiles').select('id, email');
  const profileIds = new Set(profiles.map(p => p.id));

  let fixedAuth = 0;
  let fixedProfile = 0;
  let fixedLink = 0;

  for (const al of alunos) {
    const email = al.email?.toLowerCase();
    if (!email) continue;

    // 1. Verificar se tem auth user
    const authUser = authUsers.find(u => u.email?.toLowerCase() === email);
    
    if (!authUser) {
      // Criar auth user
      const cpfDigitos = (al.cpf || '').replace(/\D/g, '');
      const senha = cpfDigitos.length >= 6 ? cpfDigitos.slice(0, 6) : 'Gym123';
      
      const { data: newAuth, error } = await s.auth.admin.createUser({
        email: al.email, password: senha, email_confirm: true,
        user_metadata: { nome: al.nome, role: 'aluno' },
      });
      
      if (error) {
        console.log(`  ❌ ${al.nome} (${al.email}) — ${error.message}`);
        continue;
      }
      
      const userId = newAuth.user.id;
      
      // Atualizar aluno com user_id
      await s.from('alunos').update({ user_id: userId }).eq('id', al.id);
      
      // Criar profile
      await s.from('profiles').upsert({ id: userId, email: al.email, nome: al.nome, role: 'aluno', academia_id: ACADEMIA_ID });
      
      console.log(`  ✅ CRIADO: ${al.nome} | ${al.email} | senha: ${senha}`);
      fixedAuth++;
    } else {
      // Auth existe — verificar link e profile
      if (!al.user_id || al.user_id !== authUser.id) {
        await s.from('alunos').update({ user_id: authUser.id }).eq('id', al.id);
        fixedLink++;
      }
      
      if (!profileIds.has(authUser.id)) {
        await s.from('profiles').upsert({ id: authUser.id, email: al.email, nome: al.nome, role: 'aluno', academia_id: ACADEMIA_ID });
        fixedProfile++;
      }
    }
  }

  console.log(`\n🎉 Correção concluída:`);
  console.log(`   ${fixedAuth} auth users criados`);
  console.log(`   ${fixedLink} links user_id corrigidos`);
  console.log(`   ${fixedProfile} profiles criados`);
}

run();
