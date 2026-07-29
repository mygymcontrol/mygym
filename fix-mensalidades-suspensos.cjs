const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kiifogmalbkcbwalhctc.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpaWZvZ21hbGJrY2J3YWxoY3RjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjEzOTk4NiwiZXhwIjoyMDk3NzE1OTg2fQ.aHqLdThV8jKWRO1dPqk_3qS_rzocVv4ZymXYetaOhHk';

const supabase = createClient(supabaseUrl, serviceKey);

async function run() {
  console.log('🔧 Corrigindo mensalidades de alunos suspensos...\n');

  // Buscar todos os alunos com status suspenso
  const { data: alunosSuspensos, error } = await supabase
    .from('alunos')
    .select('id, nome, email, status')
    .eq('status', 'suspenso');

  if (error) {
    console.log('❌ Erro:', error.message);
    return;
  }

  console.log(`📋 Alunos suspensos: ${alunosSuspensos.length}`);

  for (const aluno of alunosSuspensos) {
    // Buscar mensalidades pendentes ou atrasadas desse aluno
    const { data: mensalidades } = await supabase
      .from('mensalidades')
      .select('id, status, data_vencimento')
      .eq('aluno_id', aluno.id)
      .in('status', ['pendente', 'atrasado']);

    if (mensalidades && mensalidades.length > 0) {
      // Atualizar para suspenso
      const { error: upErr } = await supabase
        .from('mensalidades')
        .update({ status: 'suspenso' })
        .eq('aluno_id', aluno.id)
        .in('status', ['pendente', 'atrasado']);

      if (upErr) {
        console.log(`  ❌ ${aluno.nome}: erro ao atualizar - ${upErr.message}`);
      } else {
        console.log(`  ✅ ${aluno.nome} (${aluno.email}): ${mensalidades.length} mensalidade(s) → suspenso`);
      }
    } else {
      console.log(`  ⏭️  ${aluno.nome}: sem mensalidades pendentes/atrasadas`);
    }
  }

  console.log('\n✅ Concluído!');
}

run().catch(console.error);
