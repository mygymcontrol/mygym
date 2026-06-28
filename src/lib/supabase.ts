import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Tipos do banco de dados
export type UserRole = 'admin' | 'recepcao' | 'professor' | 'aluno';

export interface Profile {
  id: string;
  email: string;
  nome: string;
  role: UserRole;
  telefone?: string;
  avatar_url?: string;
  created_at: string;
}

export interface Aluno {
  id: string;
  user_id?: string;
  nome: string;
  email: string;
  telefone: string;
  cpf?: string;
  data_nascimento?: string;
  endereco?: string;
  foto_url?: string;
  status: 'ativo' | 'suspenso' | 'inadimplente' | 'cancelado';
  convenio_id?: string;
  observacoes?: string;
  created_at: string;
}

export interface Convenio {
  id: string;
  nome: string;
  desconto_percentual: number;
  ativo: boolean;
  descricao?: string;
  created_at: string;
}

export interface Modalidade {
  id: string;
  nome: string;
  descricao?: string;
  capacidade_maxima: number;
  professor_id?: string;
  ativo: boolean;
  created_at: string;
}

export interface Plano {
  id: string;
  nome: string;
  valor: number;
  duracao_meses: number;
  modalidades: string[];
  descricao?: string;
  ativo: boolean;
  created_at: string;
}

export interface Matricula {
  id: string;
  aluno_id: string;
  plano_id: string;
  data_inicio: string;
  data_fim: string;
  valor_final: number;
  status: 'ativa' | 'suspensa' | 'cancelada' | 'vencida';
  created_at: string;
}

export interface Mensalidade {
  id: string;
  matricula_id: string;
  aluno_id: string;
  valor: number;
  data_vencimento: string;
  data_pagamento?: string;
  status: 'pendente' | 'pago' | 'atrasado' | 'cancelado';
  forma_pagamento?: 'pix' | 'transferencia' | 'dinheiro' | 'cartao';
  comprovante_url?: string;
  observacoes?: string;
  created_at: string;
}

export interface Checkin {
  id: string;
  aluno_id: string;
  data: string;
  horario: string;
  created_at: string;
}

export interface HorarioAula {
  id: string;
  modalidade_id: string;
  dia_semana: number;
  horario_inicio: string;
  horario_fim: string;
  professor_id?: string;
  capacidade?: number;
  created_at: string;
}

export interface NotificacaoWhatsapp {
  id: string;
  aluno_id: string;
  mensagem: string;
  tipo: 'cobranca' | 'aviso' | 'lembrete' | 'geral';
  status: 'enviada' | 'pendente';
  enviada_em?: string;
  created_at: string;
}

export interface ConfiguracaoAcademia {
  id: string;
  nome_academia: string;
  endereco?: string;
  telefone?: string;
  logo_url?: string;
  pix_chave?: string;
  pix_tipo?: 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria';
  pix_beneficiario?: string;
  banco_nome?: string;
  banco_agencia?: string;
  banco_conta?: string;
  banco_tipo_conta?: 'corrente' | 'poupanca';
  banco_beneficiario?: string;
  qrcode_checkin?: string;
  mensagem_cobranca?: string;
  created_at: string;
}
