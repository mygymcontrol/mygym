const { createClient } = require('@supabase/supabase-js');
const s = createClient('https://kiifogmalbkcbwalhctc.supabase.co','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpaWZvZ21hbGJrY2J3YWxoY3RjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjEzOTk4NiwiZXhwIjoyMDk3NzE1OTg2fQ.aHqLdThV8jKWRO1dPqk_3qS_rzocVv4ZymXYetaOhHk');

async function run() {
  // Buscar todas as mensalidades com seus alunos
  const { data: mensalidades } = await s.from('mensalidades').select('id, aluno_id, status');
  const { data: alunos } = await s.from('alunos').select('id, dia_vencimento');

  const alunoMap = {};
  alunos.forEach(a => { alunoMap[a.id] = a.dia_vencimento || 1; });

  let fixJul = 0, fixAgo = 0;
  for (const m of mensalidades) {
    const diaVenc = alunoMap[m.aluno_id] || 1;
    
    if (m.status === 'pago') {
      // Julho - vencimento no dia do aluno
      await s.from('mensalidades').update({
        data_vencimento: `2026-07-${String(diaVenc).padStart(2, '0')}`
      }).eq('id', m.id);
      fixJul++;
    } else {
      // Agosto - vencimento no dia do aluno
      await s.from('mensalidades').update({
        data_vencimento: `2026-08-${String(diaVenc).padStart(2, '0')}`
      }).eq('id', m.id);
      fixAgo++;
    }
  }

  console.log(`✅ ${fixJul} mensalidades de julho corrigidas (dia do aluno)`);
  console.log(`✅ ${fixAgo} mensalidades de agosto corrigidas (dia do aluno)`);
}
run();
