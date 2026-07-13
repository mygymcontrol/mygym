const { createClient } = require('@supabase/supabase-js');
const s = createClient('https://kiifogmalbkcbwalhctc.supabase.co','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpaWZvZ21hbGJrY2J3YWxoY3RjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjEzOTk4NiwiZXhwIjoyMDk3NzE1OTg2fQ.aHqLdThV8jKWRO1dPqk_3qS_rzocVv4ZymXYetaOhHk');

async function run() {
  // Buscar convênios com desconto percentual
  const { data: convs } = await s.from('convenios').select('id, nome, desconto_percentual').gt('desconto_percentual', 0);
  console.log('Convênios com desconto:', convs?.map(c => `${c.nome} (${c.desconto_percentual}%)`));

  if (!convs || convs.length === 0) { console.log('Nenhum convênio com desconto.'); return; }

  // Buscar modalidades para calcular valor correto
  const { data: modalidades } = await s.from('modalidades').select('id, valor').eq('ativo', true);
  const modValor = {};
  modalidades.forEach(m => { modValor[m.id] = Number(m.valor) || 0; });

  let corrigidos = 0;
  for (const conv of convs) {
    // Buscar alunos com este convênio
    const { data: alunos } = await s.from('alunos').select('id, nome, aluno_modalidades(modalidade_id, status)').eq('convenio_id', conv.id).eq('status', 'ativo');
    
    for (const al of (alunos || [])) {
      const mods = (al.aluno_modalidades || []).filter(m => m.status === 'ativa');
      const valorCheio = mods.reduce((sum, m) => sum + (modValor[m.modalidade_id] || 0), 0);
      const valorComDesconto = valorCheio * (1 - conv.desconto_percentual / 100);
      
      if (valorCheio === 0) continue;

      // Buscar mensalidades pendentes deste aluno que estão com valor errado
      const { data: mens } = await s.from('mensalidades').select('id, valor').eq('aluno_id', al.id).in('status', ['pendente', 'pago']);
      
      for (const m of (mens || [])) {
        // Se o valor está como o cheio (sem desconto), corrigir
        if (Math.abs(Number(m.valor) - valorCheio) < 1) {
          await s.from('mensalidades').update({ valor: Math.round(valorComDesconto * 100) / 100 }).eq('id', m.id);
          corrigidos++;
        }
      }
    }
  }

  console.log(`✅ ${corrigidos} mensalidades corrigidas com desconto de convênio.`);
}
run();
