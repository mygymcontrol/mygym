const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kiifogmalbkcbwalhctc.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpaWZvZ21hbGJrY2J3YWxoY3RjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjEzOTk4NiwiZXhwIjoyMDk3NzE1OTg2fQ.aHqLdThV8jKWRO1dPqk_3qS_rzocVv4ZymXYetaOhHk';

const supabase = createClient(supabaseUrl, serviceKey);

async function run() {
  const email = 'geisa.tiburcio@gmail.com';
  
  // Buscar aluna
  const { data: aluno } = await supabase.from('alunos').select('id, nome, status').ilike('email', `%geisa%`).single();
  if (!aluno) { console.log('Aluno não encontrado'); return; }
  
  console.log(`Aluna: ${aluno.nome} | Status: ${aluno.status}`);
  
  // Buscar mensalidades
  const { data: mensalidades } = await supabase
    .from('mensalidades')
    .select('id, status, data_vencimento, valor')
    .eq('aluno_id', aluno.id)
    .order('data_vencimento', { ascending: false });

  console.log('\nMensalidades:');
  (mensalidades || []).forEach(m => {
    console.log(`  ${m.data_vencimento} | ${m.status} | R$ ${m.valor}`);
  });

  // Se a aluna está ativa, mensalidades canceladas com vencimento futuro devem virar pendente
  if (aluno.status === 'ativo') {
    const hoje = new Date().toISOString().split('T')[0];
    const { data: updated, error } = await supabase
      .from('mensalidades')
      .update({ status: 'pendente' })
      .eq('aluno_id', aluno.id)
      .eq('status', 'cancelado')
      .gte('data_vencimento', hoje)
      .select();

    if (error) {
      console.log('\n❌ Erro:', error.message);
    } else if (updated && updated.length > 0) {
      console.log(`\n✅ ${updated.length} mensalidade(s) corrigida(s) para pendente`);
    } else {
      console.log('\nNenhuma mensalidade para corrigir');
    }
  }
}

run().catch(console.error);
