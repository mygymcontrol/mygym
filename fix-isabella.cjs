const { createClient } = require('@supabase/supabase-js');
const s = createClient('https://kiifogmalbkcbwalhctc.supabase.co','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpaWZvZ21hbGJrY2J3YWxoY3RjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjEzOTk4NiwiZXhwIjoyMDk3NzE1OTg2fQ.aHqLdThV8jKWRO1dPqk_3qS_rzocVv4ZymXYetaOhHk');

async function run() {
  const alunoId = '0c8a2d1a-ab05-43b4-960a-630238a52c9b';
  const planoId = '1e61f3cc-5214-4235-9983-bae4b48b4f65';

  // Criar matrícula
  const { data: mat, error: matErr } = await s.from('matriculas').insert({
    aluno_id: alunoId, plano_id: planoId,
    data_inicio: '2026-08-01', data_fim: '2027-08-01',
    valor_final: 100, status: 'ativa',
  }).select().single();

  if (matErr) { console.log('Erro matrícula:', matErr.message); return; }
  console.log('✅ Matrícula criada:', mat.id);

  // Criar mensalidade agosto
  const { error: mensErr } = await s.from('mensalidades').insert({
    matricula_id: mat.id, aluno_id: alunoId,
    valor: 100, data_vencimento: '2026-08-10', status: 'pendente',
  });

  if (mensErr) { console.log('Erro mensalidade:', mensErr.message); return; }
  console.log('✅ Mensalidade criada: 2026-08-10 R$ 100');
}

run().catch(console.error);
