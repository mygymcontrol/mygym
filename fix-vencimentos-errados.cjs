const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kiifogmalbkcbwalhctc.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpaWZvZ21hbGJrY2J3YWxoY3RjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjEzOTk4NiwiZXhwIjoyMDk3NzE1OTg2fQ.aHqLdThV8jKWRO1dPqk_3qS_rzocVv4ZymXYetaOhHk';

const supabase = createClient(supabaseUrl, serviceKey);

async function run() {
  const hoje = '2026-08-04';
  console.log('🔧 Correção geral: mensalidades "atrasado" que ainda não venceram...\n');

  // 1. Buscar TODAS as mensalidades marcadas como "atrasado" com vencimento >= hoje
  // (Ou seja, mensalidades que NÃO deveriam estar como atrasado porque ainda não venceram)
  const { data: erradas } = await supabase
    .from('mensalidades')
    .select('id, aluno_id, data_vencimento, status, alunos(nome, dia_vencimento, status)')
    .eq('status', 'atrasado')
    .gte('data_vencimento', hoje);

  if (!erradas || erradas.length === 0) {
    console.log('✅ Nenhuma mensalidade atrasada com vencimento futuro encontrada');
  } else {
    console.log(`❌ ${erradas.length} mensalidades marcadas como "atrasado" mas com vencimento FUTURO:`);
    for (const m of erradas) {
      console.log(`  ${m.alunos?.nome} | venc: ${m.data_vencimento} | dia_venc: ${m.alunos?.dia_vencimento} | aluno status: ${m.alunos?.status}`);
    }
    
    // Corrigir: se vencimento >= hoje, deveria ser "pendente"
    const ids = erradas.map(m => m.id);
    await supabase.from('mensalidades').update({ status: 'pendente' }).in('id', ids);
    console.log(`\n✅ ${ids.length} mensalidade(s) corrigida(s) para "pendente"`);
  }

  // 2. Verificar mensalidades com dia errado (dia do vencimento diferente do dia_vencimento do aluno)
  console.log('\n\n🔍 Verificando mensalidades com dia de vencimento diferente do configurado...\n');
  
  const { data: mensalidadesPendentes } = await supabase
    .from('mensalidades')
    .select('id, aluno_id, data_vencimento, status, alunos(nome, dia_vencimento)')
    .in('status', ['pendente', 'atrasado'])
    .gte('data_vencimento', '2026-08-01');

  let corrigidas = 0;
  if (mensalidadesPendentes) {
    for (const m of mensalidadesPendentes) {
      const diaVenc = m.alunos?.dia_vencimento || 10;
      const [ano, mes, dia] = m.data_vencimento.split('-').map(Number);
      
      if (dia !== diaVenc) {
        // Corrigir a data de vencimento
        const ultimoDiaMes = new Date(ano, mes, 0).getDate();
        const diaCorreto = Math.min(diaVenc, ultimoDiaMes);
        const novaData = `${ano}-${String(mes).padStart(2, '0')}-${String(diaCorreto).padStart(2, '0')}`;
        
        // Determinar status correto
        const novoStatus = novaData < hoje ? 'atrasado' : 'pendente';
        
        await supabase.from('mensalidades').update({ data_vencimento: novaData, status: novoStatus }).eq('id', m.id);
        console.log(`  ✅ ${m.alunos?.nome}: ${m.data_vencimento} → ${novaData} (${novoStatus})`);
        corrigidas++;
      }
    }
  }

  if (corrigidas === 0) {
    console.log('  Nenhuma data incorreta encontrada');
  } else {
    console.log(`\n✅ ${corrigidas} data(s) de vencimento corrigida(s)`);
  }
}

run().catch(console.error);
