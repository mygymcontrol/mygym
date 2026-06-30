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

  // Buscar plano mensal (para vincular)
  const { data: planos } = await supabase.from('planos').select('id, nome').order('duracao_meses').limit(1);
  const planoId = planos?.[0]?.id || null;

  // Remover matrículas existentes
  await supabase.from('matriculas').delete().eq('academia_id', ACADEMIA_ID);
  console.log('✅ Matrículas antigas removidas.\n');

  // Buscar todos os alunos
  const { data: alunos } = await supabase
    .from('alunos')
    .select('id, nome, aluno_modalidades(modalidade_id)')
    .eq('academia_id', ACADEMIA_ID)
    .eq('status', 'ativo');

  let count = 0;
  for (const al of alunos) {
    const mods = al.aluno_modalidades || [];
    const valor = mods.reduce((sum, m) => sum + (modValor[m.modalidade_id] || 0), 0);
    if (valor === 0) continue;

    // Criar matrícula: início 01/07/2026, fim 01/07/2027 (1 ano)
    await supabase.from('matriculas').insert({
      aluno_id: al.id,
      plano_id: planoId,
      data_inicio: '2026-07-01',
      data_fim: '2027-07-01',
      valor_final: valor,
      status: 'ativa',
      academia_id: ACADEMIA_ID,
    });

    count++;
  }

  console.log(`🎉 ${count} matrículas criadas com início em 01/07/2026 e valor das modalidades.`);
}

run();
