const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kiifogmalbkcbwalhctc.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpaWZvZ21hbGJrY2J3YWxoY3RjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjEzOTk4NiwiZXhwIjoyMDk3NzE1OTg2fQ.aHqLdThV8jKWRO1dPqk_3qS_rzocVv4ZymXYetaOhHk';

const supabase = createClient(supabaseUrl, serviceKey);

async function run() {
  console.log('🔍 Buscando mensalidades duplicadas (mesmo aluno + mesma data_vencimento)...\n');

  // Buscar todas mensalidades ativas (não canceladas)
  const { data: todas } = await supabase
    .from('mensalidades')
    .select('id, aluno_id, data_vencimento, status, created_at, alunos(nome)')
    .not('status', 'eq', 'cancelado')
    .order('created_at', { ascending: true });

  if (!todas || todas.length === 0) {
    console.log('Nenhuma mensalidade encontrada');
    return;
  }

  // Agrupar por aluno_id + data_vencimento
  const grouped = {};
  for (const m of todas) {
    const key = `${m.aluno_id}_${m.data_vencimento}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(m);
  }

  // Encontrar duplicatas
  const duplicateIds = [];
  let totalDuplicatas = 0;

  for (const [key, items] of Object.entries(grouped)) {
    if (items.length > 1) {
      const nome = items[0].alunos?.nome || 'Desconhecido';
      const dataVenc = items[0].data_vencimento;
      
      // Manter a primeira (mais antiga) ou a que estiver paga
      const paga = items.find(m => m.status === 'pago');
      const manter = paga || items[0]; // priorizar paga, senão a mais antiga
      
      const remover = items.filter(m => m.id !== manter.id);
      console.log(`  ${nome} | ${dataVenc} → ${items.length}x (mantendo ${manter.status}, removendo ${remover.length})`);
      
      remover.forEach(m => duplicateIds.push(m.id));
      totalDuplicatas += remover.length;
    }
  }

  if (duplicateIds.length === 0) {
    console.log('✅ Nenhuma duplicata encontrada!');
    return;
  }

  console.log(`\n🔧 Cancelando ${totalDuplicatas} mensalidade(s) duplicada(s)...`);
  
  // Cancelar em lotes de 50 (limite do .in())
  for (let i = 0; i < duplicateIds.length; i += 50) {
    const batch = duplicateIds.slice(i, i + 50);
    const { error } = await supabase
      .from('mensalidades')
      .update({ status: 'cancelado' })
      .in('id', batch);
    if (error) console.log('  Erro no lote:', error.message);
  }

  console.log(`\n✅ ${totalDuplicatas} duplicata(s) cancelada(s)!`);
}

run().catch(console.error);
