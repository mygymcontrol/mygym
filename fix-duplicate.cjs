const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://kiifogmalbkcbwalhctc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpaWZvZ21hbGJrY2J3YWxoY3RjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjEzOTk4NiwiZXhwIjoyMDk3NzE1OTg2fQ.aHqLdThV8jKWRO1dPqk_3qS_rzocVv4ZymXYetaOhHk',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function run() {
  const email = 'covalsqui.arrabal1@gmail.com';

  // Remover aluno cadastrado com esse e-mail
  const { data: aluno } = await supabase.from('alunos').select('id').eq('email', email).single();
  if (aluno) {
    // Limpar dados relacionados
    await supabase.from('treinos_executados').delete().eq('aluno_id', aluno.id);
    await supabase.from('checkins').delete().eq('aluno_id', aluno.id);
    await supabase.from('mensalidades').delete().eq('aluno_id', aluno.id);
    await supabase.from('aluno_modalidades').delete().eq('aluno_id', aluno.id);
    await supabase.from('matriculas').delete().eq('aluno_id', aluno.id);
    await supabase.from('avaliacoes_fisicas').delete().eq('aluno_id', aluno.id);
    await supabase.from('log_modalidades_aluno').delete().eq('aluno_id', aluno.id);
    await supabase.from('alunos').delete().eq('id', aluno.id);
    console.log('✅ Aluno removido:', aluno.id);
  } else {
    console.log('Nenhum aluno encontrado com esse e-mail.');
  }

  // Confirmar que o profile continua como admin
  const { data: profile } = await supabase.from('profiles').select('*').eq('email', email).single();
  console.log('Profile mantido:', profile?.role, '- academia_id:', profile?.academia_id);
}

run();
