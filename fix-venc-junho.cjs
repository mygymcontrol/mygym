const { createClient } = require('@supabase/supabase-js');
const s = createClient('https://kiifogmalbkcbwalhctc.supabase.co','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpaWZvZ21hbGJrY2J3YWxoY3RjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjEzOTk4NiwiZXhwIjoyMDk3NzE1OTg2fQ.aHqLdThV8jKWRO1dPqk_3qS_rzocVv4ZymXYetaOhHk');

async function run() {
  // Pegar mensalidades pagas (vencimento em julho) e mudar para junho
  const { data } = await s.from('mensalidades').select('id, data_vencimento').eq('status', 'pago');
  
  let count = 0;
  for (const m of data) {
    // Trocar mês 07 por 06 mantendo o dia
    const dia = m.data_vencimento.split('-')[2];
    await s.from('mensalidades').update({ data_vencimento: `2026-06-${dia}` }).eq('id', m.id);
    count++;
  }

  // Pendentes: mudar de agosto para julho
  const { data: pendentes } = await s.from('mensalidades').select('id, data_vencimento').eq('status', 'pendente');
  let count2 = 0;
  for (const m of pendentes) {
    const dia = m.data_vencimento.split('-')[2];
    await s.from('mensalidades').update({ data_vencimento: `2026-07-${dia}` }).eq('id', m.id);
    count2++;
  }

  console.log(`✅ ${count} pagas → vencimento junho`);
  console.log(`✅ ${count2} pendentes → vencimento julho`);
}
run();
