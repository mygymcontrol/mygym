const { createClient } = require('@supabase/supabase-js');
const s = createClient('https://kiifogmalbkcbwalhctc.supabase.co','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpaWZvZ21hbGJrY2J3YWxoY3RjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjEzOTk4NiwiZXhwIjoyMDk3NzE1OTg2fQ.aHqLdThV8jKWRO1dPqk_3qS_rzocVv4ZymXYetaOhHk');

const ACADEMIA_ID = '3f239e12-6a92-4af1-9d98-c10ad81d6d3a';

async function run() {
  console.log('🔍 Verificação completa de alunos vs profiles...\n');

  // Buscar todos os alunos
  const { data: alunos } = await s.from('alunos').select('id, nome, email, cpf, user_id, status').eq('academia_id', ACADEMIA_ID);
  
  // Buscar TODOS os auth users
  let allAuthUsers = [];
  let page = 1;
  while (true) {
    const { data: authData } = await s.auth.admin.listUsers({ page, perPage: 1000 });
    const users = authData?.users || [];
    allAuthUsers.push(...users);
    if (users.length < 1000) break;
    page++;
  }

  // Buscar todos os profiles
  const { data: profiles } = await s.from('profiles').select('id, email, role, academia_id');

  // Indexar
  const authByEmail = {};
  for (const u of allAuthUsers) {
    if (u.email) authByEmail[u.email.toLowerCase().trim()] = u;
  }
  const profileById = {};
  for (const p of profiles || []) { profileById[p.id] = p; }

  console.log(`Alunos: ${alunos.length} | Auth Users: ${allAuthUsers.length} | Profiles: ${(profiles||[]).length}\n`);

  let semProfile = 0;
  let semLink = 0;
  let roleErrado = 0;
  let semAcademia = 0;
  let totalCorrigido = 0;

  for (const al of alunos) {
    const email = al.email?.toLowerCase()?.trim();
    if (!email) continue;

    const authUser = authByEmail[email];
    if (!authUser) {
      // Sem auth — já tratado pelo outro script
      continue;
    }

    let correcoes = [];

    // 1. user_id não vinculado
    if (!al.user_id || al.user_id !== authUser.id) {
      await s.from('alunos').update({ user_id: authUser.id }).eq('id', al.id);
      correcoes.push('user_id vinculado');
      semLink++;
    }

    // 2. Profile não existe
    const profile = profileById[authUser.id];
    if (!profile) {
      await s.from('profiles').upsert({
        id: authUser.id,
        email: email,
        nome: al.nome,
        role: 'aluno',
        academia_id: ACADEMIA_ID
      });
      correcoes.push('profile criado');
      semProfile++;
    } else {
      // 3. Role errado ou null
      if (!profile.role || (profile.role !== 'aluno' && !['admin','recepcao','professor'].includes(profile.role))) {
        await s.from('profiles').update({ role: 'aluno' }).eq('id', authUser.id);
        correcoes.push(`role: ${profile.role || 'null'} → aluno`);
        roleErrado++;
      }
      // 4. Sem academia_id
      if (!profile.academia_id) {
        await s.from('profiles').update({ academia_id: ACADEMIA_ID }).eq('id', authUser.id);
        correcoes.push('academia_id adicionado');
        semAcademia++;
      }
    }

    if (correcoes.length > 0) {
      totalCorrigido++;
      console.log(`  🔧 ${al.nome} (${al.email}): ${correcoes.join(', ')}`);
    }
  }

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`✅ Total corrigido: ${totalCorrigido} alunos`);
  console.log(`   - ${semLink} user_id vinculados`);
  console.log(`   - ${semProfile} profiles criados`);
  console.log(`   - ${roleErrado} roles corrigidos`);
  console.log(`   - ${semAcademia} academia_id adicionados`);
  console.log(`${'═'.repeat(50)}`);
}

run();
