-- ============================================
-- MyGym - Schema do Banco de Dados
-- Execute este SQL no Supabase SQL Editor
-- ============================================

-- Tabela de perfis (extensão do auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  nome TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'aluno' CHECK (role IN ('admin', 'recepcao', 'professor', 'aluno')),
  telefone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Convênios/Parcerias (Gympass, TotalPass, etc.)
CREATE TABLE IF NOT EXISTS convenios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  desconto_percentual NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (desconto_percentual >= 0 AND desconto_percentual <= 100),
  ativo BOOLEAN DEFAULT TRUE,
  descricao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alunos
CREATE TABLE IF NOT EXISTS alunos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  telefone TEXT NOT NULL,
  cpf TEXT,
  data_nascimento DATE,
  endereco TEXT,
  foto_url TEXT,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'suspenso', 'inadimplente', 'cancelado')),
  convenio_id UUID REFERENCES convenios(id) ON DELETE SET NULL,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Modalidades (musculação, crossfit, yoga, etc.)
CREATE TABLE IF NOT EXISTS modalidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  capacidade_maxima INTEGER NOT NULL DEFAULT 30,
  professor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Planos (mensal, trimestral, anual)
CREATE TABLE IF NOT EXISTS planos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  valor NUMERIC(10,2) NOT NULL,
  duracao_meses INTEGER NOT NULL,
  modalidades UUID[] DEFAULT '{}',
  descricao TEXT,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Matrículas
CREATE TABLE IF NOT EXISTS matriculas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
  plano_id UUID NOT NULL REFERENCES planos(id) ON DELETE RESTRICT,
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  valor_final NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'suspensa', 'cancelada', 'vencida')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mensalidades
CREATE TABLE IF NOT EXISTS mensalidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matricula_id UUID NOT NULL REFERENCES matriculas(id) ON DELETE CASCADE,
  aluno_id UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
  valor NUMERIC(10,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'atrasado', 'cancelado')),
  forma_pagamento TEXT CHECK (forma_pagamento IN ('pix', 'transferencia', 'dinheiro', 'cartao')),
  comprovante_url TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Check-ins (presença)
CREATE TABLE IF NOT EXISTS checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  horario TIME NOT NULL DEFAULT CURRENT_TIME,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Grade de horários
CREATE TABLE IF NOT EXISTS horarios_aulas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modalidade_id UUID NOT NULL REFERENCES modalidades(id) ON DELETE CASCADE,
  dia_semana INTEGER NOT NULL CHECK (dia_semana >= 0 AND dia_semana <= 6),
  horario_inicio TIME NOT NULL,
  horario_fim TIME NOT NULL,
  professor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  capacidade INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notificações WhatsApp (log de envios)
CREATE TABLE IF NOT EXISTS notificacoes_whatsapp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
  mensagem TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'geral' CHECK (tipo IN ('cobranca', 'aviso', 'lembrete', 'geral')),
  status TEXT NOT NULL DEFAULT 'enviada' CHECK (status IN ('enviada', 'pendente')),
  enviada_em TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Configurações da academia
CREATE TABLE IF NOT EXISTS configuracoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_academia TEXT NOT NULL DEFAULT 'Minha Academia',
  endereco TEXT,
  telefone TEXT,
  logo_url TEXT,
  pix_chave TEXT,
  pix_tipo TEXT CHECK (pix_tipo IN ('cpf', 'cnpj', 'email', 'telefone', 'aleatoria')),
  pix_beneficiario TEXT,
  banco_nome TEXT,
  banco_agencia TEXT,
  banco_conta TEXT,
  banco_tipo_conta TEXT CHECK (banco_tipo_conta IN ('corrente', 'poupanca')),
  banco_beneficiario TEXT,
  qrcode_checkin TEXT,
  mensagem_cobranca TEXT DEFAULT 'Olá {nome}! Sua mensalidade no valor de R${valor} venceu em {vencimento}. Por favor, regularize seu pagamento.',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Avaliações físicas
CREATE TABLE IF NOT EXISTS avaliacoes_fisicas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
  data_avaliacao DATE NOT NULL DEFAULT CURRENT_DATE,
  peso NUMERIC(5,2),
  altura NUMERIC(4,2),
  imc NUMERIC(5,2),
  gordura_corporal NUMERIC(5,2),
  massa_muscular NUMERIC(5,2),
  observacoes TEXT,
  avaliador_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE alunos ENABLE ROW LEVEL SECURITY;
ALTER TABLE convenios ENABLE ROW LEVEL SECURITY;
ALTER TABLE modalidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE planos ENABLE ROW LEVEL SECURITY;
ALTER TABLE matriculas ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensalidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE horarios_aulas ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificacoes_whatsapp ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE avaliacoes_fisicas ENABLE ROW LEVEL SECURITY;

-- Policies para admin (acesso total)
CREATE POLICY "Admin full access profiles" ON profiles FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Users can read own profile" ON profiles FOR SELECT USING (id = auth.uid());

CREATE POLICY "Admin full access alunos" ON alunos FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'recepcao'))
);

CREATE POLICY "Alunos can read own data" ON alunos FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admin full access convenios" ON convenios FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Everyone can read convenios" ON convenios FOR SELECT USING (true);

CREATE POLICY "Admin full access modalidades" ON modalidades FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'recepcao'))
);

CREATE POLICY "Everyone can read modalidades" ON modalidades FOR SELECT USING (true);

CREATE POLICY "Admin full access planos" ON planos FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'recepcao'))
);

CREATE POLICY "Everyone can read planos" ON planos FOR SELECT USING (true);

CREATE POLICY "Admin full access matriculas" ON matriculas FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'recepcao'))
);

CREATE POLICY "Alunos can read own matriculas" ON matriculas FOR SELECT USING (
  EXISTS (SELECT 1 FROM alunos WHERE id = matriculas.aluno_id AND user_id = auth.uid())
);

CREATE POLICY "Admin full access mensalidades" ON mensalidades FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'recepcao'))
);

CREATE POLICY "Alunos can read own mensalidades" ON mensalidades FOR SELECT USING (
  EXISTS (SELECT 1 FROM alunos WHERE id = mensalidades.aluno_id AND user_id = auth.uid())
);

CREATE POLICY "Admin full access checkins" ON checkins FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'recepcao', 'professor'))
);

CREATE POLICY "Alunos can insert own checkins" ON checkins FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM alunos WHERE id = checkins.aluno_id AND user_id = auth.uid())
);

CREATE POLICY "Alunos can read own checkins" ON checkins FOR SELECT USING (
  EXISTS (SELECT 1 FROM alunos WHERE id = checkins.aluno_id AND user_id = auth.uid())
);

CREATE POLICY "Admin full access horarios" ON horarios_aulas FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'recepcao'))
);

CREATE POLICY "Everyone can read horarios" ON horarios_aulas FOR SELECT USING (true);

CREATE POLICY "Admin full access notificacoes" ON notificacoes_whatsapp FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'recepcao'))
);

CREATE POLICY "Admin full access configuracoes" ON configuracoes FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Everyone can read configuracoes" ON configuracoes FOR SELECT USING (true);

CREATE POLICY "Admin full access avaliacoes" ON avaliacoes_fisicas FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'professor'))
);

CREATE POLICY "Alunos can read own avaliacoes" ON avaliacoes_fisicas FOR SELECT USING (
  EXISTS (SELECT 1 FROM alunos WHERE id = avaliacoes_fisicas.aluno_id AND user_id = auth.uid())
);

-- ============================================
-- TRIGGER: Criar profile automaticamente no signup
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nome, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'admin')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- INSERIR CONFIGURAÇÃO INICIAL
-- ============================================

INSERT INTO configuracoes (nome_academia, mensagem_cobranca)
VALUES (
  'Minha Academia',
  'Olá {nome}! Sua mensalidade no valor de R${valor} venceu em {vencimento}. Por favor, regularize seu pagamento. Obrigado!'
)
ON CONFLICT DO NOTHING;
