const { createClient } = require('@supabase/supabase-js');
const s = createClient('https://kiifogmalbkcbwalhctc.supabase.co','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpaWZvZ21hbGJrY2J3YWxoY3RjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjEzOTk4NiwiZXhwIjoyMDk3NzE1OTg2fQ.aHqLdThV8jKWRO1dPqk_3qS_rzocVv4ZymXYetaOhHk');

const ACADEMIA_ID = '3f239e12-6a92-4af1-9d98-c10ad81d6d3a';

async function run() {
  // Buscar alunos que têm user_id mas profile com role != 'aluno' ou sem academia_id
  const { data: alunos } = await s.from('alunos').select('id, nome, email, user_id').eq('status', 'ativo').not('user_id', 'is', null);
  
  const { data: profiles } = await s.from('profiles').select('id, role, academia_id');
  const profileMap = {};
  profiles.forEach(p => { profileMap[p.id] = p; });

  let problems = 0;
  for (const al of alunos) {
    const prof = profileMap[al.user_id];
    if (!prof) {
      console.log(`SEM PROFILE: ${al.nome} | ${al.email}`);
      // Criar profile
      await s.from('profiles').upsert({ id: al.user_id, email: al.email, nome: al.nome, role: 'aluno', academia_id: ACADEMIA_ID });
      problems++;
    } else if (prof.role !== 'aluno') {
      // Pular admins
      if (prof.role === 'admin') continue;
      console.log(`ROLE ERRADO (${prof.role}): ${al.nome} | ${al.email}`);
      await s.from('profiles').update({ role: 'aluno' }).eq('id', al.user_id);
      problems++;
    } else if (!prof.academia_id) {
      console.log(`SEM ACADEMIA: ${al.nome} | ${al.email}`);
      await s.from('profiles').update({ academia_id: ACADEMIA_ID }).eq('id', al.user_id);
      problems++;
    }
  }

  // Alunos sem user_id
  const { data: semUser } = await s.from('alunos').select('nome, email').eq('status', 'ativo').is('user_id', null);
  if (semUser && semUser.length > 0) {
    console.log(`\nSEM USER_ID (${semUser.length}):`);
    semUser.forEach(a => console.log(`  - ${a.nome} | ${a.email}`));
  }

  console.log(`\n✅ ${problems} problemas corrigidos.`);
  if (semUser) console.log(`⚠️ ${semUser.length} alunos sem user_id (precisam de fix-login-alunos.cjs)`);
}
run();
