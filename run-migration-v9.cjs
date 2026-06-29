const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://kiifogmalbkcbwalhctc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpaWZvZ21hbGJrY2J3YWxoY3RjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjEzOTk4NiwiZXhwIjoyMDk3NzE1OTg2fQ.aHqLdThV8jKWRO1dPqk_3qS_rzocVv4ZymXYetaOhHk',
  { 
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: 'public' }
  }
);

async function run() {
  console.log('Verificando se tabela treinos_executados já existe...');
  
  // Tentar fazer select na tabela - se der 404/error, precisa criar
  const { data, error } = await supabase.from('treinos_executados').select('id').limit(1);
  
  if (!error) {
    console.log('✅ Tabela treinos_executados já existe! Nada a fazer.');
    return;
  }

  if (error.code === '42P01' || error.message.includes('does not exist') || error.message.includes('relation')) {
    console.log('⚠️ Tabela não existe. Tentando criar via SQL...');
    
    // Tentar via rpc se existir uma função exec_sql
    const { error: rpcError } = await supabase.rpc('exec_sql', {
      sql: `CREATE TABLE IF NOT EXISTS treinos_executados (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        aluno_id UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
        exercicio_id UUID NOT NULL REFERENCES exercicios_horario(id) ON DELETE CASCADE,
        horario_id UUID NOT NULL REFERENCES horarios_aulas(id) ON DELETE CASCADE,
        data DATE NOT NULL DEFAULT CURRENT_DATE,
        concluido BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_treinos_exec_aluno_data ON treinos_executados(aluno_id, data);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_treinos_exec_unique ON treinos_executados(aluno_id, exercicio_id, data);
      ALTER TABLE treinos_executados ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "treinos_exec_open" ON treinos_executados FOR ALL USING (true) WITH CHECK (true);`
    });

    if (rpcError) {
      console.log('❌ RPC exec_sql não disponível:', rpcError.message);
      console.log('\n📋 Por favor, execute este SQL no Supabase SQL Editor:');
      console.log('   https://supabase.com/dashboard/project/kiifogmalbkcbwalhctc/sql\n');
    } else {
      console.log('✅ Migration executada com sucesso!');
    }
  } else {
    console.log('Erro inesperado:', error.message);
  }
}

run().catch(console.error);
