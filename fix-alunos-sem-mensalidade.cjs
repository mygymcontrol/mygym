const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kiifogmalbkcbwalhctc.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpaWZvZ21hbGJrY2J3YWxoY3RjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjEzOTk4NiwiZXhwIjoyMDk3NzE1OTg2fQ.aHqLdThV8jKWRO1dPqk_3qS_rzocVv4ZymXYetaOhHk';

const supabase = createClient(supabaseUrl, serviceKey);

async function run() {
  console.log('🔍 Verificando alunos ativos sem mensalidade no mês atual...\n');

  // Buscar todos os alunos ativos
  const { data: alunosAtivos } = await supabase
    .from('alunos')
    .select('id, nome, email, dia_vencimento, convenio_id, status, created_at')
    .eq('status', 'ativo');

  if (!alunosAtivos || alunosAtivos.length === 0) {
    console.log('Nenhum aluno ativo');
    return;
  }

  console.log(`Total de alunos ativos: ${alunosAtivos.length}\n`);

  // Buscar mensalidades do mês atual (agosto 2026)
  const { data: mensalidadesAgosto } = await supabase
    .from('mensalidades')
    .select('aluno_id, status, data_vencimento')
    .gte('data_vencimento', '2026-08-01')
    .lte('data_vencimento', '2026-08-31')
    .not('status', 'eq', 'cancelado');

  const alunosComMensalidade = new Set((mensalidadesAgosto || []).map(m => m.aluno_id));

  // Encontrar alunos sem mensalidade
  const alunosSem = alunosAtivos.filter(a => !alunosComMensalidade.has(a.id));

  if (alunosSem.length === 0) {
    console.log('✅ Todos os alunos ativos têm mensalidade em agosto!');
    return;
  }

  console.log(`❌ ${alunosSem.length} aluno(s) ativo(s) SEM mensalidade em agosto:\n`);

  for (const aluno of alunosSem) {
    // Verificar se tem matrícula
    const { data: mat } = await supabase
      .from('matriculas')
      .select('id, data_inicio, valor_final, status')
      .eq('aluno_id', aluno.id)
      .in('status', ['ativa', 'suspensa']);

    // Verificar se tem modalidades
    const { data: mods } = await supabase
      .from('aluno_modalidades')
      .select('modalidade_id, modalidades(nome, valor)')
      .eq('aluno_id', aluno.id)
      .eq('status', 'ativa');

    const temMat = mat && mat.length > 0;
    const temMods = mods && mods.length > 0;

    console.log(`  ${aluno.nome}`);
    console.log(`    Email: ${aluno.email} | Dia venc: ${aluno.dia_vencimento || '?'}`);
    console.log(`    Matrícula: ${temMat ? '✅ ' + mat[0].status + ' (início: ' + mat[0].data_inicio + ')' : '❌ NENHUMA'}`);
    console.log(`    Modalidades: ${temMods ? mods.map(m => m.modalidades?.nome).join(', ') : '❌ NENHUMA'}`);
    console.log('');

    // CORRIGIR: criar matrícula e mensalidade se não tem
    if (!temMat && temMods) {
      // Calcular valor
      const valorTotal = mods.reduce((sum, m) => sum + (Number(m.modalidades?.valor) || 0), 0);
      
      // Aplicar desconto de convênio se tiver
      let valorFinal = valorTotal;
      if (aluno.convenio_id) {
        const { data: conv } = await supabase.from('convenios').select('desconto_percentual').eq('id', aluno.convenio_id).single();
        if (conv) valorFinal -= valorFinal * Number(conv.desconto_percentual) / 100;
      }

      const dataInicio = '2026-08-01'; // Usar início de agosto como padrão
      const dataFim = '2027-08-01';
      
      const { data: novaMatricula } = await supabase.from('matriculas').insert({
        aluno_id: aluno.id, data_inicio: dataInicio, data_fim: dataFim,
        valor_final: valorFinal, status: 'ativa',
      }).select().single();

      if (novaMatricula) {
        const diaVenc = aluno.dia_vencimento || 10;
        const dataVenc = `2026-08-${String(diaVenc).padStart(2, '0')}`;
        const hoje = new Date().toISOString().split('T')[0];
        const status = dataVenc < hoje ? 'atrasado' : 'pendente';

        await supabase.from('mensalidades').insert({
          matricula_id: novaMatricula.id, aluno_id: aluno.id,
          valor: valorFinal, data_vencimento: dataVenc, status,
        });
        console.log(`    🔧 CORRIGIDO: matrícula + mensalidade R$ ${valorFinal.toFixed(2)} (${dataVenc}) → ${status}`);
      }
    } else if (temMat && temMods) {
      // Tem matrícula mas não tem mensalidade — criar mensalidade
      const diaVenc = aluno.dia_vencimento || 10;
      const dataVenc = `2026-08-${String(diaVenc).padStart(2, '0')}`;
      const hoje = new Date().toISOString().split('T')[0];
      const status = dataVenc < hoje ? 'atrasado' : 'pendente';

      const valorTotal = mods.reduce((sum, m) => sum + (Number(m.modalidades?.valor) || 0), 0);
      let valorFinal = valorTotal;
      if (aluno.convenio_id) {
        const { data: conv } = await supabase.from('convenios').select('desconto_percentual').eq('id', aluno.convenio_id).single();
        if (conv) valorFinal -= valorFinal * Number(conv.desconto_percentual) / 100;
      }

      await supabase.from('mensalidades').insert({
        matricula_id: mat[0].id, aluno_id: aluno.id,
        valor: valorFinal, data_vencimento: dataVenc, status,
      });
      console.log(`    🔧 CORRIGIDO: mensalidade R$ ${valorFinal.toFixed(2)} (${dataVenc}) → ${status}`);
    } else if (!temMods) {
      console.log(`    ⚠️  SEM MODALIDADE - não é possível gerar mensalidade (precisa vincular modalidade primeiro)`);
    }
  }

  console.log('\n✅ Verificação completa!');
}

run().catch(console.error);
