const { createClient } = require('@supabase/supabase-js');
const s = createClient('https://kiifogmalbkcbwalhctc.supabase.co','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpaWZvZ21hbGJrY2J3YWxoY3RjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjEzOTk4NiwiZXhwIjoyMDk3NzE1OTg2fQ.aHqLdThV8jKWRO1dPqk_3qS_rzocVv4ZymXYetaOhHk');

async function run() {
  // Buscar modalidade TREINOS HIPERTROFIA
  const { data: mod } = await s.from('modalidades').select('id, nome, ativo').ilike('nome', '%hipertrofia%').eq('ativo', true);
  console.log('Modalidades com hipertrofia:', JSON.stringify(mod, null, 2));

  // Buscar horarios da modalidade TREINOS HIPERTROFIA (c1497472...)
  const { data: hrs } = await s.from('horarios_aulas').select('id, dia_semana, horario_inicio, horario_fim, modalidade_id').eq('modalidade_id', 'c1497472-a78f-4afc-b126-a1a08d80990e');
  console.log('\nHorários da TREINOS HIPERTROFIA:', JSON.stringify(hrs, null, 2));

  // Buscar exercícios desses horários
  if (hrs && hrs.length > 0) {
    const { data: exs } = await s.from('exercicios_horario').select('id, titulo, descricao, horario_id').in('horario_id', hrs.map(h => h.id));
    console.log('\nExercícios:', exs?.length || 0);
  }
}
run();
