const { createClient } = require('@supabase/supabase-js');
const s = createClient('https://kiifogmalbkcbwalhctc.supabase.co','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpaWZvZ21hbGJrY2J3YWxoY3RjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjEzOTk4NiwiZXhwIjoyMDk3NzE1OTg2fQ.aHqLdThV8jKWRO1dPqk_3qS_rzocVv4ZymXYetaOhHk');

const ACADEMIA_ID = '3f239e12-6a92-4af1-9d98-c10ad81d6d3a';

async function run() {
  console.log('🔧 Passo 1: Alterando constraint para aceitar status "suspenso"...\n');

  // Alterar o check constraint para incluir 'suspenso'
  const { error: alterErr } = await s.rpc('exec_sql', {
    sql: `
      ALTER TABLE mensalidades DROP CONSTRAINT IF EXISTS mensalidades_status_check;
      ALTER TABLE mensalidades ADD CONSTRAINT mensalidades_status_check 
        CHECK (status IN ('pendente', 'pago', 'atrasado', 'cancelado', 'suspenso'));
    `
  });

  if (alterErr) {
    console.log('⚠️  Tentando via SQL direto (RPC não disponível)...');
    // Tentar diretamente pelo postgres
    const { error: sqlErr } = await s.from('_sql').select('*');
    console.log('Erro ao alterar constraint:', alterErr.message);
    console.log('\n⚠️  Você precisa rodar o seguinte SQL no Supabase Dashboard (SQL Editor):');
    console.log('─'.repeat(60));
    console.log(`
ALTER TABLE mensalidades DROP CONSTRAINT IF EXISTS mensalidades_status_check;
ALTER TABLE mensalidades ADD CONSTRAINT mensalidades_status_check 
  CHECK (status IN ('pendente', 'pago', 'atrasado', 'cancelado', 'suspenso'));
    `);
    console.log('─'.repeat(60));
    console.log('\nDepois de rodar o SQL acima, execute este script novamente com:');
    console.log('  node fix-suspensos-mensalidades.cjs --update\n');
    
    if (process.argv.includes('--update')) {
      console.log('⚠️  Flag --update detectada, tentando atualizar mesmo assim...');
      await atualizarMensalidades();
    }
    return;
  }

  console.log('✅ Constraint atualizado!\n');
  await atualizarMensalidades();
}

async function atualizarMensalidades() {
  console.log('🔍 Buscando alunos com status "suspenso"...\n');

  // 1. Buscar todos os alunos suspensos
  const { data: alunosSuspensos, error: alunosErr } = await s
    .from('alunos')
    .select('id, nome')
    .eq('academia_id', ACADEMIA_ID)
    .eq('status', 'suspenso');

  if (alunosErr) {
    console.log('❌ Erro ao buscar alunos:', alunosErr.message);
    return;
  }

  console.log(`📋 Total de alunos suspensos: ${alunosSuspensos.length}\n`);

  if (alunosSuspensos.length === 0) {
    console.log('Nenhum aluno suspenso encontrado.');
    return;
  }

  for (const al of alunosSuspensos) {
    console.log(`  - ${al.nome}`);
  }

  // 2. Pegar os IDs dos alunos suspensos
  const ids = alunosSuspensos.map(a => a.id);

  // 3. Atualizar mensalidades pendentes/atrasadas desses alunos para "suspenso"
  const { data: updated, error: updateErr } = await s
    .from('mensalidades')
    .update({ status: 'suspenso' })
    .in('aluno_id', ids)
    .in('status', ['pendente', 'atrasado'])
    .select('id, aluno_id');

  if (updateErr) {
    console.log('\n❌ Erro ao atualizar mensalidades:', updateErr.message);
    return;
  }

  console.log(`\n✅ ${updated.length} mensalidade(s) atualizada(s) para status "suspenso".`);

  if (updated.length > 0) {
    const porAluno = {};
    for (const m of updated) {
      const aluno = alunosSuspensos.find(a => a.id === m.aluno_id);
      const nome = aluno ? aluno.nome : m.aluno_id;
      porAluno[nome] = (porAluno[nome] || 0) + 1;
    }
    console.log('\n📊 Detalhes:');
    for (const [nome, qtd] of Object.entries(porAluno)) {
      console.log(`  - ${nome}: ${qtd} mensalidade(s)`);
    }
  }
}

run().catch(console.error);
