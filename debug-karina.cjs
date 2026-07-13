const { createClient } = require('@supabase/supabase-js');
const s = createClient('https://kiifogmalbkcbwalhctc.supabase.co','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpaWZvZ21hbGJrY2J3YWxoY3RjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjEzOTk4NiwiZXhwIjoyMDk3NzE1OTg2fQ.aHqLdThV8jKWRO1dPqk_3qS_rzocVv4ZymXYetaOhHk');

async function run() {
  // Karina Freitas
  const { data: al } = await s.from('alunos').select('id, nome, convenio_id').ilike('nome', '%karina%freitas%').single();
  console.log('Aluna:', al.nome, 'convenio_id:', al.convenio_id);

  // Suas modalidades
  const { data: mods } = await s.from('aluno_modalidades').select('modalidade_id, modalidades(nome)').eq('aluno_id', al.id).eq('status', 'ativa');
  console.log('Modalidades:', mods?.map(m => `${m.modalidades?.nome} (${m.modalidade_id})`));

  // Modalidades do convênio
  const { data: convMods } = await s.from('convenio_modalidades').select('modalidade_id, modalidades(nome)').eq('convenio_id', al.convenio_id);
  console.log('Gympass cobre:', convMods?.map(m => `${m.modalidades?.nome} (${m.modalidade_id})`));

  // Check: a modalidade da Karina está na lista do Gympass?
  const convModIds = convMods?.map(m => m.modalidade_id) || [];
  mods?.forEach(m => {
    console.log(`  ${m.modalidades?.nome} → ${convModIds.includes(m.modalidade_id) ? 'NO GYMPASS ✅' : 'FORA DO GYMPASS ❌'}`);
  });
}
run();
