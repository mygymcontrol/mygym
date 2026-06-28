import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY!;

/**
 * Verifica alunos ativos e gera mensalidades futuras se não existem.
 * Também marca pendentes vencidas como "atrasado".
 */
export async function renovarMensalidades() {
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const hoje = new Date().toISOString().split('T')[0];

  // 1. Marcar pendentes vencidas como atrasado
  await supabase
    .from('mensalidades')
    .update({ status: 'atrasado' })
    .eq('status', 'pendente')
    .lt('data_vencimento', hoje);

  // 2. Buscar alunos ativos com suas matrículas e mensalidades
  const { data: alunos } = await supabase
    .from('alunos')
    .select('id, dia_vencimento, convenio_id, status')
    .eq('status', 'ativo');

  if (!alunos || alunos.length === 0) return;

  for (const aluno of alunos) {
    // Buscar matrícula ativa
    const { data: matricula } = await supabase
      .from('matriculas')
      .select('id, valor_final')
      .eq('aluno_id', aluno.id)
      .eq('status', 'ativa')
      .single();

    if (!matricula) continue;

    // Verificar se já existe mensalidade pendente com vencimento >= hoje
    const { data: mensalidadeFutura } = await supabase
      .from('mensalidades')
      .select('id')
      .eq('aluno_id', aluno.id)
      .in('status', ['pendente'])
      .gte('data_vencimento', hoje)
      .limit(1);

    // Se já tem mensalidade futura pendente, não gerar nova
    if (mensalidadeFutura && mensalidadeFutura.length > 0) continue;

    // Buscar última mensalidade para saber o próximo mês
    const { data: ultimaMensalidade } = await supabase
      .from('mensalidades')
      .select('data_vencimento')
      .eq('aluno_id', aluno.id)
      .order('data_vencimento', { ascending: false })
      .limit(1)
      .single();

    // Calcular próximo vencimento
    const diaVenc = aluno.dia_vencimento || 10;
    let proximoAno: number;
    let proximoMes: number;

    if (ultimaMensalidade) {
      const [ano, mes] = ultimaMensalidade.data_vencimento.split('-').map(Number);
      proximoMes = mes + 1;
      proximoAno = ano;
      if (proximoMes > 12) { proximoMes = 1; proximoAno++; }
    } else {
      // Sem mensalidade anterior, gerar para o mês atual
      const now = new Date();
      proximoMes = now.getMonth() + 1;
      proximoAno = now.getFullYear();
    }

    // Verificar último dia do mês (regra: dia 31 → 30 se mês não tem 31)
    const ultimoDiaMes = new Date(proximoAno, proximoMes, 0).getDate();
    const diaFinal = Math.min(diaVenc, ultimoDiaMes);

    const dataVencimento = `${proximoAno}-${String(proximoMes).padStart(2, '0')}-${String(diaFinal).padStart(2, '0')}`;

    // Determinar valor (usar valor da matrícula)
    // Buscar modalidades ativas para calcular valor mensal
    const { data: modalidadesAtivas } = await supabase
      .from('aluno_modalidades')
      .select('modalidades(valor)')
      .eq('aluno_id', aluno.id)
      .eq('status', 'ativa');

    let valorMensal = 0;
    if (modalidadesAtivas && modalidadesAtivas.length > 0) {
      valorMensal = modalidadesAtivas.reduce((sum: number, am: any) => sum + (Number(am.modalidades?.valor) || 0), 0);
    } else {
      valorMensal = Number(matricula.valor_final) || 0;
    }

    // Aplicar desconto de convênio se houver
    if (aluno.convenio_id) {
      const { data: convenio } = await supabase
        .from('convenios')
        .select('desconto_percentual')
        .eq('id', aluno.convenio_id)
        .single();
      if (convenio) {
        valorMensal -= valorMensal * Number(convenio.desconto_percentual) / 100;
      }
    }

    if (valorMensal <= 0) continue;

    // Determinar status: se vencimento já passou, já nasce como atrasado
    const status = dataVencimento < hoje ? 'atrasado' : 'pendente';

    // Inserir nova mensalidade
    await supabase.from('mensalidades').insert({
      matricula_id: matricula.id,
      aluno_id: aluno.id,
      valor: valorMensal,
      data_vencimento: dataVencimento,
      status,
    });
  }
}
