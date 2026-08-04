const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kiifogmalbkcbwalhctc.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpaWZvZ21hbGJrY2J3YWxoY3RjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjEzOTk4NiwiZXhwIjoyMDk3NzE1OTg2fQ.aHqLdThV8jKWRO1dPqk_3qS_rzocVv4ZymXYetaOhHk';

const supabase = createClient(supabaseUrl, serviceKey);

async function run() {
  const hoje = new Date().toISOString().split('T')[0];
  console.log(`📅 Hoje: ${hoje}\n`);

  // 1. Buscar alunos ativos
  const { data: alunosAtivos } = await supabase
    .from('alunos')
    .select('id, nome')
    .eq('status', 'ativo');

  if (!alunosAtivos || alunosAtivos.length === 0) {
    console.log('Nenhum aluno ativo');
    return;
  }

  const alunoIds = alunosAtivos.map(a => a.id);

  // 2. Buscar mensalidades canceladas com vencimento >= hoje para alunos ativos
  const { data: canceladasFuturas } = await supabase
    .from('mensalidades')
    .select('id, aluno_id, data_vencimento, valor')
    .in('aluno_id', alunoIds)
    .eq('status', 'cancelado')
    .gte('data_vencimento', hoje);

  if (!canceladasFuturas || canceladasFuturas.length === 0) {
    console.log('✅ Nenhuma mensalidade cancelada futura para alunos ativos');
    return;
  }

  console.log(`🔧 Encontradas ${canceladasFuturas.length} mensalidades canceladas de alunos ativos com vencimento futuro:\n`);

  for (const m of canceladasFuturas) {
    const aluno = alunosAtivos.find(a => a.id === m.aluno_id);
    console.log(`  ${aluno?.nome || 'Desconhecido'} | ${m.data_vencimento} | R$ ${m.valor}`);
  }

  // 3. Corrigir para pendente
  const ids = canceladasFuturas.map(m => m.id);
  const { error } = await supabase
    .from('mensalidades')
    .update({ status: 'pendente' })
    .in('id', ids);

  if (error) {
    console.log(`\n❌ Erro: ${error.message}`);
  } else {
    console.log(`\n✅ ${ids.length} mensalidade(s) corrigida(s) para pendente`);
  }

  // 4. Verificar e remover duplicatas de setembro
  console.log('\n🔍 Verificando duplicatas...');
  const { data: allPendentes } = await supabase
    .from('mensalidades')
    .select('id, aluno_id, data_vencimento, status')
    .in('aluno_id', alunoIds)
    .eq('status', 'pendente')
    .gte('data_vencimento', hoje)
    .order('data_vencimento', { ascending: true });

  // Agrupar por aluno_id + data_vencimento
  const grouped = {};
  (allPendentes || []).forEach(m => {
    const key = `${m.aluno_id}_${m.data_vencimento}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(m);
  });

  const duplicateIds = [];
  for (const [key, items] of Object.entries(grouped)) {
    if (items.length > 1) {
      // Manter apenas a primeira, cancelar as demais
      const aluno = alunosAtivos.find(a => a.id === items[0].aluno_id);
      console.log(`  Duplicata: ${aluno?.nome} | ${items[0].data_vencimento} (${items.length}x)`);
      for (let i = 1; i < items.length; i++) {
        duplicateIds.push(items[i].id);
      }
    }
  }

  if (duplicateIds.length > 0) {
    await supabase.from('mensalidades').update({ status: 'cancelado' }).in('id', duplicateIds);
    console.log(`  ✅ ${duplicateIds.length} duplicata(s) cancelada(s)`);
  } else {
    console.log('  Nenhuma duplicata encontrada');
  }

  console.log('\n✅ Concluído!');
}

run().catch(console.error);
