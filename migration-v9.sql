-- Migration v9: Tracker de treinos para alunos
-- Registra quando o aluno executa cada exercício do dia

CREATE TABLE IF NOT EXISTS treinos_executados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
  exercicio_id UUID NOT NULL REFERENCES exercicios_horario(id) ON DELETE CASCADE,
  horario_id UUID NOT NULL REFERENCES horarios_aulas(id) ON DELETE CASCADE,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  concluido BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para busca rápida por aluno + data
CREATE INDEX IF NOT EXISTS idx_treinos_exec_aluno_data ON treinos_executados(aluno_id, data);

-- Índice único para evitar duplicatas (mesmo exercício no mesmo dia)
CREATE UNIQUE INDEX IF NOT EXISTS idx_treinos_exec_unique ON treinos_executados(aluno_id, exercicio_id, data);

ALTER TABLE treinos_executados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "treinos_exec_open" ON treinos_executados FOR ALL USING (true) WITH CHECK (true);
