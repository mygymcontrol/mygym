const { createClient } = require('@supabase/supabase-js');
const s = createClient('https://kiifogmalbkcbwalhctc.supabase.co','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpaWZvZ21hbGJrY2J3YWxoY3RjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjEzOTk4NiwiZXhwIjoyMDk3NzE1OTg2fQ.aHqLdThV8jKWRO1dPqk_3qS_rzocVv4ZymXYetaOhHk');

const ACADEMIA_ID = '3f239e12-6a92-4af1-9d98-c10ad81d6d3a';

async function run() {
  const email = 'covalsqui.arrabal@gmail.com';
  console.log(`🔍 Diagnóstico: ${email}\n`);

  // 1. Buscar aluno
  const { data: aluno } = await s.from('alunos').select('id, nome, email, cpf, user_id, academia_id, status').eq('email', email).single();
  if (!aluno) {
    console.log('❌ Aluno NÃO encontrado na tabela alunos!');
    // Buscar case-insensitive
    const { data: aluno2 } = await s.from('alunos').select('id, nome, email, cpf, user_id, academia_id, status').ilike('email', email);
    console.log('  Busca case-insensitive:', aluno2);
    return;
  }
  console.log('📋 Aluno encontrado:');
  console.log(`  Nome: ${aluno.nome}`);
  console.log(`  Email: ${aluno.email}`);
  console.log(`  CPF: ${aluno.cpf}`);
  console.log(`  user_id: ${aluno.user_id || '❌ VAZIO'}`);
  console.log(`  academia_id: ${aluno.academia_id || '❌ VAZIO'}`);
  console.log(`  Status: ${aluno.status}`);

  // 2. Verificar auth user
  const { data: authData } = await s.auth.admin.listUsers();
  const authUser = authData?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
  console.log('\n🔐 Auth user:');
  if (authUser) {
    console.log(`  ID: ${authUser.id}`);
    console.log(`  Email: ${authUser.email}`);
    console.log(`  Confirmed: ${authUser.email_confirmed_at ? 'SIM' : '❌ NÃO'}`);
  } else {
    console.log('  ❌ NÃO EXISTE no auth!');
  }

  // 3. Calcular senha esperada
  const cpfDigitos = (aluno.cpf || '').replace(/\D/g, '');
  const senhaEsperada = cpfDigitos.length >= 6 ? cpfDigitos.slice(0, 6) : 'Gym123';
  console.log(`\n🔑 Senha esperada: ${senhaEsperada}`);

  // 4. Se não tem auth, criar. Se tem, corrigir tudo.
  if (!authUser) {
    console.log('\n🔧 Criando auth user...');
    const { data: newAuth, error } = await s.auth.admin.createUser({
      email: email,
      password: senhaEsperada,
      email_confirm: true,
      user_metadata: { nome: aluno.nome, role: 'aluno' },
    });
    if (error) {
      console.log(`  ❌ Erro: ${error.message}`);
      return;
    }
    const userId = newAuth.user.id;
    console.log(`  ✅ Criado com ID: ${userId}`);

    // Vincular
    await s.from('alunos').update({ user_id: userId, academia_id: ACADEMIA_ID }).eq('id', aluno.id);
    await s.from('profiles').upsert({ id: userId, email: email, nome: aluno.nome, role: 'aluno', academia_id: ACADEMIA_ID });
    console.log('  ✅ user_id vinculado + profile criado');
  } else {
    // Auth existe — corrigir senha e vínculos
    console.log('\n🔧 Corrigindo senha e vínculos...');
    await s.auth.admin.updateUserById(authUser.id, { password: senhaEsperada, email_confirm: true });
    console.log(`  ✅ Senha resetada para: ${senhaEsperada}`);

    if (!aluno.user_id || aluno.user_id !== authUser.id) {
      await s.from('alunos').update({ user_id: authUser.id }).eq('id', aluno.id);
      console.log('  ✅ user_id corrigido');
    }

    if (!aluno.academia_id) {
      await s.from('alunos').update({ academia_id: ACADEMIA_ID }).eq('id', aluno.id);
      console.log('  ✅ academia_id corrigido');
    }

    await s.from('profiles').upsert({ id: authUser.id, email: email, nome: aluno.nome, role: 'aluno', academia_id: ACADEMIA_ID });
    console.log('  ✅ Profile garantido');
  }

  // 5. Testar login
  console.log('\n🧪 Testando login...');
  const { error: loginErr } = await s.auth.signInWithPassword({ email, password: senhaEsperada });
  console.log(loginErr ? `  ❌ FALHOU: ${loginErr.message}` : `  ✅ LOGIN OK! Senha: ${senhaEsperada}`);
}

run().catch(console.error);
