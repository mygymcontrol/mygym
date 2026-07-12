const { createClient } = require('@supabase/supabase-js');
const s = createClient('https://kiifogmalbkcbwalhctc.supabase.co','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpaWZvZ21hbGJrY2J3YWxoY3RjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjEzOTk4NiwiZXhwIjoyMDk3NzE1OTg2fQ.aHqLdThV8jKWRO1dPqk_3qS_rzocVv4ZymXYetaOhHk');

async function run() {
  const PLANO_ID = '1e61f3cc-5214-4235-9983-bae4b48b4f65';
  const ACADEMIA_ID = '3f239e12-6a92-4af1-9d98-c10ad81d6d3a';

  const { data: alunos } = await s.from('alunos').select('id, nome').eq('status', 'ativo');
  const { data: mats } = await s.from('matriculas').select('aluno_id');
  const matIds = new Set(mats.map(m => m.aluno_id));
  const sem = alunos.filter(a => !matIds.has(a.id));

  console.log('Sem matrícula:', sem.length);
  for (const a of sem) {
    const { error } = await s.from('matriculas').insert({
      aluno_id: a.id,
      plano_id: PLANO_ID,
      data_inicio: '2026-06-01',
      data_fim: '2027-06-01',
      valor_final: 0,
      status: 'ativa',
      academia_id: ACADEMIA_ID,
    });
    console.log(a.nome, error ? error.message : 'OK');
  }
}
run();
