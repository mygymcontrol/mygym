const { createClient } = require('@supabase/supabase-js');
const s = createClient('https://kiifogmalbkcbwalhctc.supabase.co','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpaWZvZ21hbGJrY2J3YWxoY3RjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjEzOTk4NiwiZXhwIjoyMDk3NzE1OTg2fQ.aHqLdThV8jKWRO1dPqk_3qS_rzocVv4ZymXYetaOhHk');

const ACADEMIA_ID = '3f239e12-6a92-4af1-9d98-c10ad81d6d3a';

async function run() {
  console.log('🔍 Buscando alunos com academia_id NULL...\n');

  const { data: alunos, error } = await s.from('alunos').select('id, nome, email, academia_id').is('academia_id', null);

  if (error) { console.log('Erro:', error.message); return; }

  console.log(`📋 Alunos com academia_id NULL: ${alunos.length}\n`);

  if (alunos.length === 0) {
    console.log('✅ Nenhum aluno com academia_id NULL. Tudo certo!');
    return;
  }

  for (const al of alunos) {
    console.log(`  - ${al.nome} (${al.email})`);
  }

  // Corrigir todos
  const ids = alunos.map(a => a.id);
  const { error: updateErr, count } = await s
    .from('alunos')
    .update({ academia_id: ACADEMIA_ID })
    .in('id', ids);

  if (updateErr) {
    console.log(`\n❌ Erro ao atualizar: ${updateErr.message}`);
    return;
  }

  console.log(`\n✅ ${alunos.length} aluno(s) corrigido(s) com academia_id = ${ACADEMIA_ID}`);
}

run().catch(console.error);
