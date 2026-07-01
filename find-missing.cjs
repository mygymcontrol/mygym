const { createClient } = require('@supabase/supabase-js');
const s = createClient('https://kiifogmalbkcbwalhctc.supabase.co','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpaWZvZ21hbGJrY2J3YWxoY3RjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjEzOTk4NiwiZXhwIjoyMDk3NzE1OTg2fQ.aHqLdThV8jKWRO1dPqk_3qS_rzocVv4ZymXYetaOhHk');

async function run() {
  // Buscar todos alunos ativos
  const { data: alunos } = await s.from('alunos').select('id, nome, email').eq('status', 'ativo');
  
  // Buscar alunos que têm mensalidade paga
  const { data: mensalidades } = await s.from('mensalidades').select('aluno_id').eq('status', 'pago');
  const alunosComPagamento = new Set(mensalidades.map(m => m.aluno_id));

  // Encontrar quem não tem
  const semPagamento = alunos.filter(a => !alunosComPagamento.has(a.id));
  
  console.log(`Total alunos ativos: ${alunos.length}`);
  console.log(`Com pagamento: ${alunosComPagamento.size}`);
  console.log(`Sem pagamento: ${semPagamento.length}\n`);
  
  semPagamento.forEach(a => {
    console.log(`  - ${a.nome} | ${a.email}`);
  });
}
run();
