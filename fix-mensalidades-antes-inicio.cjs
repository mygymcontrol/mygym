const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kiifogmalbkcbwalhctc.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpaWZvZ21hbGJrY2J3YWxoY3RjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjEzOTk4NiwiZXhwIjoyMDk3NzE1OTg2fQ.aHqLdThV8jKWRO1dPqk_3qS_rzocVv4ZymXYetaOhHk';

const supabase = createClient(supabaseUrl, serviceKey);

async function run() {
  console.log('🔧 Correção geral: cancelar mensalidades geradas ANTES da data_inicio da matrícula\n');

  // Buscar todas as matrículas com data_inicio
  const { data: matriculas } = await supabase
    .from('matriculas')
    .select('id, aluno_id, data_inicio, alunos(nome, status)')
    .not('data_inicio', 'is', null);

  if (!matriculas || matriculas.length === 0) {
    console.log('Nenhuma matrícula encontrada');
    return;
  }

  let totalCorrigidas = 0;

  for (const mat of matriculas) {
    if (!mat.data_inicio) continue;

    // Buscar mensalidades desse aluno com vencimento ANTES da data_inicio que não estão pagas
    const { data: mensErradas } = await supabase
      .from('mensalidades')
      .select('id, data_vencimento, status')
      .eq('aluno_id', mat.aluno_id)
      .lt('data_vencimento', mat.data_inicio)
      .in('status', ['pendente', 'atrasado']);

    if (mensErradas && mensErradas.length > 0) {
      const ids = mensErradas.map(m => m.id);
      await supabase.from('mensalidades').update({ status: 'cancelado' }).in('id', ids);
      console.log(`  ✅ ${mat.alunos?.nome}: ${mensErradas.length} mensalidade(s) antes de ${mat.data_inicio} → cancelado`);
      mensErradas.forEach(m => console.log(`     ${m.data_vencimento} (${m.status})`));
      totalCorrigidas += mensErradas.length;
    }
  }

  if (totalCorrigidas === 0) {
    console.log('✅ Nenhuma mensalidade anterior à data de início encontrada');
  } else {
    console.log(`\n✅ Total: ${totalCorrigidas} mensalidade(s) corrigida(s)`);
  }
}

run().catch(console.error);
