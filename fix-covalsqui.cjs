const { createClient } = require('@supabase/supabase-js');
const s = createClient('https://kiifogmalbkcbwalhctc.supabase.co','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpaWZvZ21hbGJrY2J3YWxoY3RjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjEzOTk4NiwiZXhwIjoyMDk3NzE1OTg2fQ.aHqLdThV8jKWRO1dPqk_3qS_rzocVv4ZymXYetaOhHk');

const ACADEMIA_ID = '3f239e12-6a92-4af1-9d98-c10ad81d6d3a';

async function run() {
  const email = 'covalsqui.arrabal@gmail.com';
  
  // Buscar TODOS os auth users paginados (pode ser que o listUsers de 1 página não pegou)
  let allUsers = [];
  let page = 1;
  while (true) {
    const { data, error } = await s.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) break;
    const users = data?.users || [];
    allUsers.push(...users);
    if (users.length < 1000) break;
    page++;
  }
  console.log(`Total auth users: ${allUsers.length}`);
  
  // Buscar por email
  const found = allUsers.find(u => u.email?.toLowerCase() === email.toLowerCase());
  if (found) {
    console.log(`\n✅ Encontrado na página ${page}:`);
    console.log(`  ID: ${found.id}`);
    console.log(`  Email: ${found.email}`);
    
    // Corrigir tudo
    const senha = '328756';
    await s.auth.admin.updateUserById(found.id, { password: senha, email_confirm: true });
    console.log(`  Senha resetada para: ${senha}`);
    
    // Vincular ao aluno
    const { data: aluno } = await s.from('alunos').select('id, nome').eq('email', email).single();
    if (aluno) {
      await s.from('alunos').update({ user_id: found.id }).eq('id', aluno.id);
      await s.from('profiles').upsert({ id: found.id, email, nome: aluno.nome, role: 'aluno', academia_id: ACADEMIA_ID });
      console.log('  user_id vinculado + profile criado');
    }
    
    // Testar login
    const { error: loginErr } = await s.auth.signInWithPassword({ email, password: senha });
    console.log(loginErr ? `  ❌ Login falhou: ${loginErr.message}` : '  ✅ Login OK!');
  } else {
    console.log('Não encontrado em nenhuma página. Tentando criar com signUp...');
    // O "already registered" pode ser de um user deletado (soft delete) ou identities
    // Tentar via signUp normal
    const { data: signUpData, error: signUpErr } = await s.auth.admin.createUser({
      email: email,
      password: '328756',
      email_confirm: true,
      user_metadata: { nome: 'covalsqui arrabal', role: 'aluno' },
    });
    console.log('SignUp result:', signUpErr?.message || signUpData?.user?.id);
    
    // Se ainda falha, tentar deletar possível user fantasma e recriar
    // Buscar por identities
    const { data: identities } = await s.rpc('get_user_by_email', { p_email: email });
    console.log('RPC result:', identities);
  }
}

run().catch(console.error);
