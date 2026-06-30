const { createClient } = require('@supabase/supabase-js');
const s = createClient('https://kiifogmalbkcbwalhctc.supabase.co','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpaWZvZ21hbGJrY2J3YWxoY3RjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxMzk5ODYsImV4cCI6MjA5NzcxNTk4Nn0.UVMyUg_xiZ6FEZ6b7_jDb3YpyR5_rNy2qXZOIrol5LU');

async function run() {
  // Simular a mesma query que o relatório faz (usando anon key, como o browser)
  const { data, error } = await s
    .from('mensalidades')
    .select('valor, data_vencimento, data_pagamento, status, forma_pagamento, alunos(nome)')
    .gte('data_vencimento', '2026-07-01')
    .lte('data_vencimento', '2026-07-31')
    .order('data_vencimento', { ascending: false })
    .limit(5);

  console.log('Error:', error?.message || 'none');
  console.log('Data count:', data?.length);
  if (data && data.length > 0) console.log('Sample:', JSON.stringify(data[0], null, 2));
  
  // Testar sem o JOIN
  const { data: d2, error: e2 } = await s
    .from('mensalidades')
    .select('valor, data_vencimento, status')
    .gte('data_vencimento', '2026-07-01')
    .lte('data_vencimento', '2026-07-31')
    .limit(3);
  console.log('\nSem JOIN - Error:', e2?.message || 'none');
  console.log('Sem JOIN - Count:', d2?.length);
  if (d2) console.log(JSON.stringify(d2, null, 2));
}
run();
