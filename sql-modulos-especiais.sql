-- Adicionar coluna para armazenar IDs dos módulos especiais ativados por aluno
ALTER TABLE alunos ADD COLUMN IF NOT EXISTS modulos_especiais_ids jsonb DEFAULT '[]'::jsonb;

-- Migrar dados existentes: alunos com treino_hipertrofia=true terão o ID do módulo original
UPDATE alunos 
SET modulos_especiais_ids = (
  SELECT jsonb_agg(m.id::text)
  FROM modalidades m 
  WHERE m.nome = 'TREINOS HIPERTROFIA' AND m.ativo = true
)
WHERE treino_hipertrofia = true 
  AND (modulos_especiais_ids IS NULL OR modulos_especiais_ids = '[]'::jsonb);
