const { createClient } = require('@supabase/supabase-js');
const s = createClient('https://kiifogmalbkcbwalhctc.supabase.co','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpaWZvZ21hbGJrY2J3YWxoY3RjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjEzOTk4NiwiZXhwIjoyMDk3NzE1OTg2fQ.aHqLdThV8jKWRO1dPqk_3qS_rzocVv4ZymXYetaOhHk');

async function run() {
  // Buscar valores das modalidades
  const { data: modalidades } = await s.from('modalidades').select('id, nome, valor').eq('ativo', true);
  const modValor = {};
  modalidades.forEach(m => { modValor[m.id] = Number(m.valor) || 0; });

  // Buscar todos os alunos com suas modalidades
  const { data: alunos } = await s.from('alunos').select('id, nome, aluno_modalidades(modalidade_id)').eq('status', 'ativo');

  let corrigidos = 0;
  for (const al of alunos) {
    const mods = al.aluno_modalidades || [];
    const valorCorreto = mods.reduce((sum, m) => sum + (modValor[m.modalidade_id] || 0), 0);
    if (valorCorreto === 0) continue;

    // Atualizar todas as mensalidades deste aluno que têm valor diferente
    const { data: mens } = await s.from('mensalidades').select('id, valor').eq('aluno_id', al.id);
    for (const m of (mens || [])) {
      if (Number(m.valor) !== valorCorreto) {
        await s.from('mensalidades').update({ valor: valorCorreto }).eq('id', m.id);
        corrigidos++;
      }
    }
  }

  console.log(`✅ ${corrigidos} mensalidades corrigidas para o valor atual das modalidades.`);
}
run();
