const { createClient } = require('@supabase/supabase-js');
const s = createClient('https://kiifogmalbkcbwalhctc.supabase.co','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpaWZvZ21hbGJrY2J3YWxoY3RjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjEzOTk4NiwiZXhwIjoyMDk3NzE1OTg2fQ.aHqLdThV8jKWRO1dPqk_3qS_rzocVv4ZymXYetaOhHk');

const ACADEMIA_ID = '3f239e12-6a92-4af1-9d98-c10ad81d6d3a';

async function run() {
  console.log('🔍 REVISÃO COMPLETA DE ACESSO DE ALUNOS\n');
  console.log('═'.repeat(70));

  // 1. Buscar TODOS os alunos da academia
  const { data: alunos, error: alunosErr } = await s
    .from('alunos')
    .select('id, nome, email, cpf, user_id, status, academia_id')
    .eq('academia_id', ACADEMIA_ID);

  if (alunosErr) { console.log('Erro:', alunosErr.message); return; }
  console.log(`\n📋 Total de alunos na academia: ${alunos.length}\n`);

  // 2. Buscar TODOS os auth users
  let allAuthUsers = [];
  let page = 1;
  while (true) {
    const { data: authData, error: authErr } = await s.auth.admin.listUsers({ page, perPage: 1000 });
    if (authErr) { console.log('Erro auth:', authErr.message); break; }
    const users = authData?.users || [];
    allAuthUsers.push(...users);
    if (users.length < 1000) break;
    page++;
  }
  console.log(`🔐 Total de auth users: ${allAuthUsers.length}`);

  // Indexar auth por email
  const authByEmail = {};
  for (const u of allAuthUsers) {
    if (u.email) authByEmail[u.email.toLowerCase().trim()] = u;
  }

  // 3. Buscar TODOS os profiles
  const { data: profiles } = await s.from('profiles').select('id, email, role, academia_id');
  const profileById = {};
  for (const p of profiles || []) { profileById[p.id] = p; }
  console.log(`👤 Total de profiles: ${(profiles || []).length}`);
  console.log('═'.repeat(70));

  let totalProblemas = 0;
  let fixedAuth = 0;
  let fixedLink = 0;
  let fixedProfile = 0;
  let fixedAcademiaProfile = 0;
  let semEmail = 0;

  const problematicos = [];

  for (const al of alunos) {
    const email = al.email?.toLowerCase()?.trim();
    if (!email) {
      semEmail++;
      continue;
    }

    const authUser = authByEmail[email];
    let problemas = [];

    if (!authUser) {
      // Sem auth user — criar
      const cpfDigitos = (al.cpf || '').replace(/\D/g, '');
      const senha = cpfDigitos.length >= 6 ? cpfDigitos.slice(0, 6) : 'Gym123';

      const { data: newAuth, error } = await s.auth.admin.createUser({
        email: email,
        password: senha,
        email_confirm: true,
        user_metadata: { nome: al.nome, role: 'aluno' },
      });

      if (error) {
        problemas.push(`AUTH FALHOU: ${error.message}`);
        problematicos.push({ nome: al.nome, email, problemas });
        totalProblemas++;
        continue;
      }

      const userId = newAuth.user.id;
      await s.from('alunos').update({ user_id: userId }).eq('id', al.id);
      await s.from('profiles').upsert({
        id: userId, email: email, nome: al.nome, role: 'aluno', academia_id: ACADEMIA_ID,
      });
      fixedAuth++;
      problemas.push(`✅ AUTH CRIADO (senha: ${senha})`);
    } else {
      // Auth existe — verificar vinculações

      // A) user_id no aluno deve apontar para o auth user
      if (!al.user_id || al.user_id !== authUser.id) {
        await s.from('alunos').update({ user_id: authUser.id }).eq('id', al.id);
        fixedLink++;
        problemas.push('✅ user_id corrigido');
      }

      // B) Profile deve existir com role=aluno e academia_id
      const profile = profileById[authUser.id];
      if (!profile) {
        await s.from('profiles').upsert({
          id: authUser.id, email: email, nome: al.nome, role: 'aluno', academia_id: ACADEMIA_ID,
        });
        fixedProfile++;
        problemas.push('✅ Profile criado');
      } else {
        // Verificar se profile tem academia_id
        if (!profile.academia_id) {
          await s.from('profiles').update({ academia_id: ACADEMIA_ID }).eq('id', authUser.id);
          fixedAcademiaProfile++;
          problemas.push('✅ academia_id no profile corrigido');
        }
        // Verificar role
        if (!profile.role || profile.role === '') {
          await s.from('profiles').update({ role: 'aluno' }).eq('id', authUser.id);
          problemas.push('✅ role corrigido');
        }
        // Verificar se email no profile bate
        if (profile.email?.toLowerCase() !== email) {
          await s.from('profiles').update({ email: email }).eq('id', authUser.id);
          problemas.push('✅ email no profile corrigido');
        }
      }

      // C) Verificar se email no auth bate com o email no aluno
      if (authUser.email?.toLowerCase() !== email) {
        // Isso não deveria acontecer porque indexamos por email, mas por segurança
        problemas.push(`⚠️ Email no auth (${authUser.email}) difere do aluno (${email})`);
      }
    }

    if (problemas.length > 0) {
      problematicos.push({ nome: al.nome, email, problemas });
    }
  }

  // Relatório final
  console.log('\n' + '═'.repeat(70));
  console.log('📊 RELATÓRIO FINAL');
  console.log('═'.repeat(70));
  console.log(`  Auth users criados: ${fixedAuth}`);
  console.log(`  Links user_id corrigidos: ${fixedLink}`);
  console.log(`  Profiles criados: ${fixedProfile}`);
  console.log(`  academia_id em profiles corrigido: ${fixedAcademiaProfile}`);
  console.log(`  Alunos sem email: ${semEmail}`);
  console.log(`  Total de correções: ${fixedAuth + fixedLink + fixedProfile + fixedAcademiaProfile}`);

  if (problematicos.length > 0) {
    console.log(`\n📝 DETALHES (${problematicos.length} alunos com ações):`);
    console.log('─'.repeat(70));
    for (const p of problematicos) {
      console.log(`  ${p.nome} (${p.email})`);
      for (const prob of p.problemas) {
        console.log(`    ${prob}`);
      }
    }
  }

  // Verificar especificamente a Marcia Cristiane
  console.log('\n' + '═'.repeat(70));
  console.log('🔎 VERIFICAÇÃO ESPECÍFICA: Marcia Cristiane do Nascimento');
  console.log('─'.repeat(70));
  const { data: marcia } = await s.from('alunos').select('*').ilike('nome', '%marcia cristiane%');
  if (marcia && marcia.length > 0) {
    for (const m of marcia) {
      console.log(`  Nome: ${m.nome}`);
      console.log(`  Email no aluno: ${m.email}`);
      console.log(`  user_id: ${m.user_id}`);
      
      if (m.user_id) {
        const { data: authCheck } = await s.auth.admin.getUserById(m.user_id);
        if (authCheck?.user) {
          console.log(`  Email no auth: ${authCheck.user.email}`);
          console.log(`  Emails batem: ${authCheck.user.email?.toLowerCase() === m.email?.toLowerCase() ? '✅ SIM' : '❌ NÃO'}`);
        }
        const { data: profCheck } = await s.from('profiles').select('*').eq('id', m.user_id).single();
        if (profCheck) {
          console.log(`  Email no profile: ${profCheck.email}`);
          console.log(`  Role: ${profCheck.role}`);
          console.log(`  academia_id: ${profCheck.academia_id}`);
        }
      }
    }
  }

  console.log('\n✅ REVISÃO COMPLETA FINALIZADA');
}

run().catch(console.error);
