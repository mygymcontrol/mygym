const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://kiifogmalbkcbwalhctc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpaWZvZ21hbGJrY2J3YWxoY3RjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjEzOTk4NiwiZXhwIjoyMDk3NzE1OTg2fQ.aHqLdThV8jKWRO1dPqk_3qS_rzocVv4ZymXYetaOhHk',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const ACADEMIA_ID = '3f239e12-6a92-4af1-9d98-c10ad81d6d3a';

async function run() {
  // Buscar valores das modalidades
  const { data: modalidades } = await supabase.from('modalidades').select('id, valor').eq('ativo', true);
  const modValor = {};
  modalidades.forEach(m => { modValor[m.id] = Number(m.valor) || 0; });

  // Buscar todos os alunos ativos da academia
  const { data: alunos } = await supabase
    .from('alunos')
    .select('id, nome, dia_vencimento, aluno_modalidades(modalidade_id)')
    .eq('academia_id', ACADEMIA_ID)
    .eq('status', 'ativo');

  console.log(`Processando ${alunos.length} alunos...\n`);

  // 1. Deletar todas as mensalidades existentes (começar limpo)
  await supabase.from('mensalidades').delete().eq('academia_id', ACADEMIA_ID);
  console.log('✅ Mensalidades antigas removidas.\n');

  let count = 0;
  for (const al of alunos) {
    const mods = al.aluno_modalidades || [];
    const valor = mods.reduce((sum, m) => sum + (modValor[m.modalidade_id] || 0), 0);
    if (valor === 0) continue;

    const diaVenc = al.dia_vencimento || 1;

    // Mensalidade de Julho/2026 — PAGA (início)
    const dataVencJulho = `2026-07-${String(diaVenc).padStart(2, '0')}`;
    await supabase.from('mensalidades').insert({
      aluno_id: al.id,
      valor,
      data_vencimento: dataVencJulho,
      status: 'pago',
      data_pagamento: '2026-07-01',
      forma_pagamento: 'pix',
      academia_id: ACADEMIA_ID,
    });

    // Mensalidade de Agosto/2026 — PENDENTE (próxima)
    const dataVencAgosto = `2026-08-${String(diaVenc).padStart(2, '0')}`;
    await supabase.from('mensalidades').insert({
      aluno_id: al.id,
      valor,
      data_vencimento: dataVencAgosto,
      status: 'pendente',
      academia_id: ACADEMIA_ID,
    });

    console.log(`  ✅ ${al.nome} | R$ ${valor.toFixed(2)} | Venc: dia ${diaVenc}`);
    count++;
  }

  console.log(`\n🎉 Concluído! ${count} alunos com mensalidades configuradas.`);
  console.log(`   Julho/2026: PAGO (início em 01/07/2026)`);
  console.log(`   Agosto/2026: PENDENTE (vencimento conforme cadastro)`);
}

run();
