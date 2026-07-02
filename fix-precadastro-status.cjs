const { createClient } = require('@supabase/supabase-js');
const s = createClient('https://kiifogmalbkcbwalhctc.supabase.co','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpaWZvZ21hbGJrY2J3YWxoY3RjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjEzOTk4NiwiZXhwIjoyMDk3NzE1OTg2fQ.aHqLdThV8jKWRO1dPqk_3qS_rzocVv4ZymXYetaOhHk');

async function run() {
  // Buscar todos os e-mails de alunos já cadastrados
  const { data: alunos } = await s.from('alunos').select('email');
  const emailsCadastrados = new Set(alunos.map(a => a.email.toLowerCase()));

  // Buscar pré-cadastros pendentes
  const { data: pres } = await s.from('pre_cadastros').select('id, email').eq('status', 'pendente');
  
  let count = 0;
  for (const p of pres) {
    if (emailsCadastrados.has(p.email.toLowerCase())) {
      await s.from('pre_cadastros').update({ status: 'importado' }).eq('id', p.id);
      count++;
    }
  }

  console.log(`✅ ${count} pré-cadastros atualizados para "importado"`);
  
  // Verificar restantes
  const { data: restantes } = await s.from('pre_cadastros').select('nome, email').eq('status', 'pendente');
  console.log(`Ainda pendentes: ${restantes.length}`);
  restantes.forEach(r => console.log(`  - ${r.nome} | ${r.email}`));
}
run();
