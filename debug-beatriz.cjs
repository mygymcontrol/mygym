const { createClient } = require('@supabase/supabase-js');
const s = createClient('https://kiifogmalbkcbwalhctc.supabase.co','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpaWZvZ21hbGJrY2J3YWxoY3RjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjEzOTk4NiwiZXhwIjoyMDk3NzE1OTg2fQ.aHqLdThV8jKWRO1dPqk_3qS_rzocVv4ZymXYetaOhHk');

const ACADEMIA_ID = '3f239e12-6a92-4af1-9d98-c10ad81d6d3a';

async function run() {
  console.log('🔍 Diagnóstico: Beatriz dos Santos Guimarães\n');

  // 1. Buscar na tabela alunos
  const { data: aluno, error: err1 } = await s.from('alunos').select('*').ilike('nome', '%beatriz%guimar%');
  console.log('📋 Aluno na tabela alunos:');
  if (aluno && aluno.length > 0) {
    for (const a of aluno) {
      console.log(`  ID: ${a.id}`);
      console.log(`  Nome: ${a.nome}`);
      console.log(`  Email: ${a.email}`);
      console.log(`  CPF: ${a.cpf}`);
      console.log(`  user_id: ${a.user_id || '❌ VAZIO'}`);
      console.log(`  academia_id: ${a.academia_id}`);
      console.log(`  Status: ${a.status}`);
      console.log('');
    }
  } else {
    console.log('  ❌ NÃO ENCONTRADA na tabela alunos!');
    console.log('  Erro:', err1?.message);
  }

  // 2. Verificar auth user pelo email
  const email = aluno?.[0]?.email;
  if (email) {
    const { data: authData } = await s.auth.admin.listUsers();
    const authUser = authData?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
    console.log('🔐 Auth user:');
    if (authUser) {
      console.log(`  ID: ${authUser.id}`);
      console.log(`  Email: ${authUser.email}`);
      console.log(`  Created: ${authUser.created_at}`);
      console.log(`  Confirmed: ${authUser.email_confirmed_at ? 'SIM' : 'NÃO'}`);
      console.log(`  Metadata: ${JSON.stringify(authUser.user_metadata)}`);

      // 3. Verificar profile
      const { data: profile } = await s.from('profiles').select('*').eq('id', authUser.id).single();
      console.log('\n👤 Profile:');
      if (profile) {
        console.log(`  ID: ${profile.id}`);
        console.log(`  Email: ${profile.email}`);
        console.log(`  Nome: ${profile.nome}`);
        console.log(`  Role: ${profile.role}`);
        console.log(`  academia_id: ${profile.academia_id || '❌ VAZIO'}`);
      } else {
        console.log('  ❌ PROFILE NÃO EXISTE!');
      }

      // 4. Verificar se o user_id no aluno bate
      if (aluno[0].user_id !== authUser.id) {
        console.log(`\n⚠️  MISMATCH: aluno.user_id (${aluno[0].user_id}) !== auth.id (${authUser.id})`);
      }
    } else {
      console.log('  ❌ AUTH USER NÃO EXISTE para este email!');
    }
  }

  // 5. Verificar RLS policies na tabela alunos
  console.log('\n📊 Verificando RLS...');
  // Testar se query com anon key funciona para este user_id
  if (aluno?.[0]?.user_id) {
    const { data: rlsTest, error: rlsErr } = await s.from('alunos').select('id, nome').eq('user_id', aluno[0].user_id);
    console.log(`  Query com service_role (user_id=${aluno[0].user_id}): ${rlsTest?.length || 0} resultado(s)`);
    if (rlsErr) console.log(`  Erro: ${rlsErr.message}`);
  }
}

run().catch(console.error);
