const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://kiifogmalbkcbwalhctc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpaWZvZ21hbGJrY2J3YWxoY3RjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjEzOTk4NiwiZXhwIjoyMDk3NzE1OTg2fQ.aHqLdThV8jKWRO1dPqk_3qS_rzocVv4ZymXYetaOhHk',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const ACADEMIA_ID = '3f239e12-6a92-4af1-9d98-c10ad81d6d3a'; // Force Trainning

async function run() {
  // 1. Buscar pré-cadastros pendentes
  console.log('Buscando pré-cadastros...');
  const { data: precadastros, error } = await supabase
    .from('pre_cadastros')
    .select('*')
    .neq('status', 'importado')
    .order('created_at');

  if (error) { console.log('❌ Erro:', error.message); return; }
  if (!precadastros || precadastros.length === 0) {
    console.log('Nenhum pré-cadastro pendente encontrado.');
    return;
  }

  console.log(`Encontrados ${precadastros.length} pré-cadastros:\n`);
  precadastros.forEach((p, i) => {
    console.log(`${i+1}. ${p.nome} | ${p.email} | ${p.telefone} | obs: ${p.observacoes || '—'}`);
  });

  console.log('\n--- Importando para Force Trainning ---\n');

  let importados = 0;
  for (const pre of precadastros) {
    // Verificar se já existe aluno com esse e-mail
    const { data: existing } = await supabase.from('alunos').select('id').eq('email', pre.email).single();
    if (existing) {
      console.log(`  ⏭ ${pre.nome} (${pre.email}) — já existe como aluno`);
      await supabase.from('pre_cadastros').update({ status: 'importado' }).eq('id', pre.id);
      continue;
    }

    // Criar usuário auth
    const cpfDigitos = (pre.cpf || '').replace(/\D/g, '');
    const senhaTemp = cpfDigitos.length >= 6 ? cpfDigitos.slice(0, 6) : 'Gym123';

    let userId = null;
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: pre.email,
      password: senhaTemp,
      email_confirm: true,
      user_metadata: { nome: pre.nome, role: 'aluno' },
    });

    if (!authError && authUser?.user) {
      userId = authUser.user.id;
    } else if (authError?.message?.includes('already been registered')) {
      const { data: users } = await supabase.auth.admin.listUsers();
      const ex = users?.users?.find(u => u.email === pre.email);
      if (ex) { userId = ex.id; await supabase.auth.admin.updateUserById(ex.id, { password: senhaTemp }); }
    } else {
      console.log(`  ❌ ${pre.nome} — erro auth: ${authError?.message}`);
      continue;
    }

    // Criar aluno
    const { data: aluno, error: alunoErr } = await supabase.from('alunos').insert({
      user_id: userId,
      nome: pre.nome,
      email: pre.email,
      telefone: pre.telefone || '',
      cpf: pre.cpf || null,
      data_nascimento: pre.data_nascimento || null,
      status: 'ativo',
      observacoes: pre.observacoes || null,
      academia_id: ACADEMIA_ID,
    }).select().single();

    if (alunoErr) {
      console.log(`  ❌ ${pre.nome} — erro aluno: ${alunoErr.message}`);
      continue;
    }

    // Criar profile
    if (userId) {
      await supabase.from('profiles').upsert({
        id: userId,
        email: pre.email,
        nome: pre.nome,
        role: 'aluno',
        academia_id: ACADEMIA_ID,
      });
    }

    // Marcar pré-cadastro como importado
    await supabase.from('pre_cadastros').update({ status: 'importado' }).eq('id', pre.id);

    const senhaExibir = cpfDigitos.length >= 6 ? senhaTemp + ' (CPF)' : 'Gym123 (padrão)';
    console.log(`  ✅ ${pre.nome} | ${pre.email} | senha: ${senhaExibir}`);
    importados++;
  }

  console.log(`\n🎉 Importação concluída! ${importados} alunos importados para Force Trainning.`);
}

run();
