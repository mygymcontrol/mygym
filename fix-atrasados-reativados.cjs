const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kiifogmalbkcbwalhctc.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpaWZvZ21hbGJrY2J3YWxoY3RjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjEzOTk4NiwiZXhwIjoyMDk3NzE1OTg2fQ.aHqLdThV8jKWRO1dPqk_3qS_rzocVv4ZymXYetaOhHk';

const supabase = createClient(supabaseUrl, serviceKey);

async function run() {
  console.log('🔧 Corrigindo mensalidades atrasadas de alunas que foram suspensas e reativadas...\n');

  // Buscar no log de matrículas quem foi pausado e depois reativado
  const { data: logs } = await supabase
    .from('log_matriculas')
    .select('aluno_id, acao, created_at')
    .in('acao', ['pausada', 'ativada'])
    .order('created_at', { ascending: true });

  if (!logs || logs.length === 0) {
    console.log('Nenhum log de pausa/ativação encontrado');
    return;
  }

  // Agrupar por aluno - encontrar periodos de suspensão
  const suspensoes = {}; // aluno_id -> [{inicio, fim}]
  const alunoStatus = {}; // aluno_id -> ultimo status
  
  for (const log of logs) {
    if (!suspensoes[log.aluno_id]) suspensoes[log.aluno_id] = [];
    
    if (log.acao === 'pausada') {
      suspensoes[log.aluno_id].push({ inicio: log.created_at, fim: null });
      alunoStatus[log.aluno_id] = 'suspenso';
    } else if (log.acao === 'ativada') {
      const last = suspensoes[log.aluno_id].find(s => !s.fim);
      if (last) last.fim = log.created_at;
      alunoStatus[log.aluno_id] = 'ativo';
    }
  }

  // Para alunos que foram reativados, cancelar mensalidades atrasadas do período de suspensão
  let totalCorrigidas = 0;
  
  for (const [alunoId, periodos] of Object.entries(suspensoes)) {
    // Só corrigir alunos que estão ativos agora
    const { data: aluno } = await supabase.from('alunos').select('id, nome, status').eq('id', alunoId).single();
    if (!aluno || aluno.status !== 'ativo') continue;

    for (const periodo of periodos) {
      if (!periodo.fim) continue; // Ainda suspenso

      const inicioMes = periodo.inicio.slice(0, 7); // YYYY-MM
      const fimMes = periodo.fim.slice(0, 7);

      // Buscar mensalidades atrasadas com vencimento no período de suspensão
      const { data: mensAtrasadas } = await supabase
        .from('mensalidades')
        .select('id, data_vencimento, status')
        .eq('aluno_id', alunoId)
        .eq('status', 'atrasado')
        .gte('data_vencimento', periodo.inicio.split('T')[0].slice(0, 8) + '01')
        .lte('data_vencimento', periodo.fim.split('T')[0]);

      if (mensAtrasadas && mensAtrasadas.length > 0) {
        const ids = mensAtrasadas.map(m => m.id);
        await supabase.from('mensalidades').update({ status: 'cancelado' }).in('id', ids);
        console.log(`  ✅ ${aluno.nome}: ${mensAtrasadas.length} mensalidade(s) do período de suspensão → cancelado`);
        mensAtrasadas.forEach(m => console.log(`     ${m.data_vencimento}`));
        totalCorrigidas += mensAtrasadas.length;
      }
    }
  }

  // Abordagem complementar: buscar alunas ativas com mensalidades atrasadas de julho
  // que foram reativadas recentemente (caso o log não cubra todos)
  console.log('\n🔍 Verificação adicional: alunas ativas com atrasados de julho...');
  
  const { data: atrasadosJulho } = await supabase
    .from('mensalidades')
    .select('id, aluno_id, data_vencimento, alunos(nome, status)')
    .eq('status', 'atrasado')
    .gte('data_vencimento', '2026-07-01')
    .lte('data_vencimento', '2026-07-31');

  if (atrasadosJulho) {
    // Verificar quais desses alunos foram suspensos em algum momento
    for (const m of atrasadosJulho) {
      if (m.alunos?.status !== 'ativo') continue;
      
      // Checar se tem log de pausa que cobre julho
      const { data: pausaLog } = await supabase
        .from('log_matriculas')
        .select('id')
        .eq('aluno_id', m.aluno_id)
        .eq('acao', 'pausada')
        .lte('created_at', m.data_vencimento + 'T23:59:59')
        .limit(1);

      if (pausaLog && pausaLog.length > 0) {
        await supabase.from('mensalidades').update({ status: 'cancelado' }).eq('id', m.id);
        console.log(`  ✅ ${m.alunos?.nome}: ${m.data_vencimento} → cancelado`);
        totalCorrigidas++;
      }
    }
  }

  console.log(`\n✅ Total corrigidas: ${totalCorrigidas}`);
}

run().catch(console.error);
