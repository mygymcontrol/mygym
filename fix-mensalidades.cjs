const { createClient } = require('@supabase/supabase-js');
const s = createClient('https://kiifogmalbkcbwalhctc.supabase.co','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpaWZvZ21hbGJrY2J3YWxoY3RjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjEzOTk4NiwiZXhwIjoyMDk3NzE1OTg2fQ.aHqLdThV8jKWRO1dPqk_3qS_rzocVv4ZymXYetaOhHk');

const ACADEMIA_ID = '3f239e12-6a92-4af1-9d98-c10ad81d6d3a';

async function run() {
  // 1. Deletar TODAS as mensalidades (com e sem academia_id)
  const { error: delErr } = await s.from('mensalidades').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('Delete:', delErr?.message || 'OK');

  const { count: afterDel } = await s.from('mensalidades').select('*', { count: 'exact', head: true });
  console.log('Restantes após delete:', afterDel);

  // 2. Buscar modalidades e valores
  const { data: modalidades } = await s.from('modalidades').select('id, valor').eq('ativo', true);
  const modValor = {};
  modalidades.forEach(m => { modValor[m.id] = Number(m.valor) || 0; });

  // 3. Buscar alunos
  const { data: alunos } = await s.from('alunos').select('id, nome, dia_vencimento, aluno_modalidades(modalidade_id)').eq('academia_id', ACADEMIA_ID).eq('status', 'ativo');

  // 4. Criar mensalidades
  let count = 0;
  for (const al of alunos) {
    const mods = al.aluno_modalidades || [];
    const valor = mods.reduce((sum, m) => sum + (modValor[m.modalidade_id] || 0), 0);
    if (valor === 0) continue;

    const diaVenc = al.dia_vencimento || 1;

    // Julho PAGO
    await s.from('mensalidades').insert({
      aluno_id: al.id, valor,
      data_vencimento: `2026-07-${String(diaVenc).padStart(2, '0')}`,
      status: 'pago', data_pagamento: '2026-07-01', forma_pagamento: 'pix',
      academia_id: ACADEMIA_ID,
    });

    // Agosto PENDENTE
    await s.from('mensalidades').insert({
      aluno_id: al.id, valor,
      data_vencimento: `2026-08-${String(diaVenc).padStart(2, '0')}`,
      status: 'pendente',
      academia_id: ACADEMIA_ID,
    });

    count++;
  }

  const { count: final } = await s.from('mensalidades').select('*', { count: 'exact', head: true });
  console.log(`\n✅ ${count} alunos processados. Total mensalidades: ${final}`);

  // Verificar
  const { data: sample } = await s.from('mensalidades').select('data_vencimento, status, valor').limit(3);
  console.log('Amostra:', JSON.stringify(sample));
}
run();
