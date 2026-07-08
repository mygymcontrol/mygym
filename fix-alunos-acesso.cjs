const { createClient } = require('@supabase/supabase-js');
const s = createClient('https://kiifogmalbkcbwalhctc.supabase.co','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpaWZvZ21hbGJrY2J3YWxoY3RjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjEzOTk4NiwiZXhwIjoyMDk3NzE1OTg2fQ.aHqLdThV8jKWRO1dPqk_3qS_rzocVv4ZymXYetaOhHk');

const ACADEMIA_ID = '3f239e12-6a92-4af1-9d98-c10ad81d6d3a';

async function run() {
  console.log('🔍 Diagnóstico completo de acesso de alunos...\n');

  // 1. Buscar TODOS os alunos da academia
  const { data: alunos, error: alunosErr } = await s.from('alunos').select('id, nome, email, cpf, user_id, status').eq('academia_id', ACADEMIA_ID);
  if (alunosErr) { console.log('Erro ao buscar alunos:', alunosErr.message); return; }
  console.log(`📋 Total de alunos na academia: ${alunos.length}`);

  // 2. Buscar TODOS os auth users (paginado)
  let allAuthUsers = [];
  let page = 1;
  while (true) {
    const { data: authData, error: authErr } = await s.auth.admin.listUsers({ page, perPage: 1000 });
    if (authErr) { console.log('Erro ao buscar auth users:', authErr.message); break; }
    const users = authData?.users || [];
    allAuthUsers.push(...users);
    if (users.length < 1000) break;
    page++;
  }
  console.log(`🔐 Total de auth users: ${allAuthUsers.length}`);

  // Indexar por email
  const authByEmail = {};
  for (const u of allAuthUsers) {
    if (u.email) authByEmail[u.email.toLowerCase()] = u;
  }

  // 3. Buscar TODOS os profiles
  const { data: profiles } = await s.from('profiles').select('id, email, role, academia_id');
  const profileById = {};
  for (const p of profiles || []) { profileById[p.id] = p; }
  console.log(`👤 Total de profiles: ${(profiles || []).length}`);

  let problemas = 0;
  let fixedLink = 0;
  let fixedProfile = 0;
  let fixedRole = 0;
  let semAuth = 0;
  let authCriado = 0;

  for (const al of alunos) {
    const email = al.email?.toLowerCase()?.trim();
    if (!email) continue;

    const authUser = authByEmail[email];

    if (!authUser) {
      // Aluno cadastrado mas sem auth user — criar
      const cpfDigitos = (al.cpf || '').replace(/\D/g, '');
      const senha = cpfDigitos.length >= 6 ? cpfDigitos.slice(0, 6) : 'Gym123';

      const { data: newAuth, error } = await s.auth.admin.createUser({
        email: al.email.trim(), password: senha, email_confirm: true,
        user_metadata: { nome: al.nome, role: 'aluno' },
      });

      if (error) {
        console.log(`  ❌ SEM AUTH: ${al.nome} (${al.email}) — ${error.message}`);
        semAuth++;
        continue;
      }

      const userId = newAuth.user.id;
      await s.from('alunos').update({ user_id: userId }).eq('id', al.id);
      await s.from('profiles').upsert({ id: userId, email: al.email.trim(), nome: al.nome, role: 'aluno', academia_id: ACADEMIA_ID });
      console.log(`  ✅ AUTH CRIADO: ${al.nome} | ${al.email} | senha: ${senha}`);
      authCriado++;
      continue;
    }

    // Auth existe — verificar vinculações
    let fixed = false;

    // A) Verificar user_id no registro do aluno
    if (!al.user_id || al.user_id !== authUser.id) {
      await s.from('alunos').update({ user_id: authUser.id }).eq('id', al.id);
      fixedLink++;
      fixed = true;
    }

    // B) Verificar se profile existe
    const profile = profileById[authUser.id];
    if (!profile) {
      await s.from('profiles').upsert({
        id: authUser.id,
        email: al.email.trim(),
        nome: al.nome,
        role: 'aluno',
        academia_id: ACADEMIA_ID
      });
      fixedProfile++;
      fixed = true;
    } else if (profile.role !== 'aluno') {
      // C) Profile existe mas com role errado
      // Só corrige se não for admin/recepcao/professor (não rebaixar)
      if (!['admin', 'recepcao', 'professor'].includes(profile.role)) {
        await s.from('profiles').update({ role: 'aluno' }).eq('id', authUser.id);
        fixedRole++;
        fixed = true;
      }
    } else if (!profile.academia_id) {
      // D) Profile sem academia_id
      await s.from('profiles').update({ academia_id: ACADEMIA_ID }).eq('id', authUser.id);
      fixed = true;
    }

    if (fixed) {
      problemas++;
      console.log(`  🔧 CORRIGIDO: ${al.nome} (${al.email}) — link:${!al.user_id || al.user_id !== authUser.id ? '✓' : '-'} profile:${!profile ? '✓' : '-'} role:${profile && profile.role !== 'aluno' ? profile.role + '→aluno' : '-'}`);
    }
  }

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`🎉 Correção concluída:`);
  console.log(`   ${authCriado} auth users criados`);
  console.log(`   ${fixedLink} links user_id vinculados`);
  console.log(`   ${fixedProfile} profiles criados`);
  console.log(`   ${fixedRole} roles corrigidos`);
  console.log(`   ${semAuth} sem solução (erro ao criar auth)`);
  console.log(`   ${problemas} alunos corrigidos no total`);
  console.log(`${'═'.repeat(50)}`);
}

run();
