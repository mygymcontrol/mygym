'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatDate, getHoje } from '@/lib/utils';

interface AlunoData { id: string; nome: string; email: string; status: string; }
interface MensalidadeAluno { id: string; valor: number; data_vencimento: string; status: string; data_pagamento?: string; }
interface ConfigPagamento { pix_chave?: string; pix_tipo?: string; pix_beneficiario?: string; banco_nome?: string; banco_agencia?: string; banco_conta?: string; banco_tipo_conta?: string; banco_beneficiario?: string; nome_academia?: string; whatsapp_academia?: string; }
interface MatriculaInfo { id: string; status: string; data_inicio: string; data_fim: string; valor_final: number; planos: { nome: string; duracao_meses: number }; }
interface AvaliacaoFisica { id: string; data_avaliacao: string; peso: number; altura: number; imc: number; gordura_corporal?: number; massa_muscular?: number; braco_esq?: number; braco_dir?: number; peitoral?: number; cintura?: number; quadril?: number; coxa_esq?: number; coxa_dir?: number; panturrilha?: number; }

export default function PortalAlunoPage() {
  const [aluno, setAluno] = useState<AlunoData | null>(null);
  const [mensalidades, setMensalidades] = useState<MensalidadeAluno[]>([]);
  const [config, setConfig] = useState<ConfigPagamento>({});
  const [checkins, setCheckins] = useState<any[]>([]);
  const [avaliacoes, setAvaliacoes] = useState<AvaliacaoFisica[]>([]);
  const [alunoMods, setAlunoMods] = useState<any[]>([]);
  const [horariosMods, setHorariosMods] = useState<any[]>([]);
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [checkinMsg, setCheckinMsg] = useState('');
  const [scannerRef, setScannerRef] = useState<any>(null);
  const [matricula, setMatricula] = useState<MatriculaInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // Treino Hipertrofia (módulo especial)
  const [treinoHipertrofiaAtivo, setTreinoHipertrofiaAtivo] = useState(false);
  const [hipertrofiaMod, setHipertrofiaMod] = useState<any>(null);
  const [hipertrofiaHorarios, setHipertrofiaHorarios] = useState<any[]>([]);

  // Treino tracker
  const [treinoAberto, setTreinoAberto] = useState<string | null>(null); // modalidade_id
  const [treinoDia, setTreinoDia] = useState<number | null>(null); // dia_semana selecionado
  const [exercicioAtual, setExercicioAtual] = useState(0); // índice do exercício atual
  const [exerciciosConcluidos, setExerciciosConcluidos] = useState<string[]>([]); // IDs dos exercícios concluídos hoje
  const [treinoConcluido, setTreinoConcluido] = useState(false);
  const [treinosHoje, setTreinosHoje] = useState<string[]>([]); // IDs dos exercícios já feitos hoje (do banco)

  // Frequência
  const [freqSemana, setFreqSemana] = useState(0);
  const [freqMes, setFreqMes] = useState(0);
  const [mesSelecionado, setMesSelecionado] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [checkinsMes, setCheckinsMes] = useState<any[]>([]);

  useEffect(() => {
    checkAuth();
    const saved = localStorage.getItem('comprovantes_enviados');
    if (saved) setComprovantesEnviados(JSON.parse(saved));
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = '/'; return; }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'aluno') { window.location.href = '/dashboard/'; return; }

      // Buscar aluno
    let alunoData = null;
    const { data: byUserId } = await supabase.from('alunos').select('id, nome, email, status, treino_hipertrofia').eq('user_id', user.id).single();
    if (byUserId) {
      alunoData = byUserId;
    } else {
      const { data: byEmail } = await supabase.from('alunos').select('id, nome, email, status, treino_hipertrofia').eq('email', user.email).single();
      if (byEmail) alunoData = byEmail;
    }

    // Fallback: se a query com treino_hipertrofia falhar (coluna não existe ainda)
    if (!alunoData) {
      const { data: byUserId2 } = await supabase.from('alunos').select('id, nome, email, status').eq('user_id', user.id).single();
      if (byUserId2) {
        alunoData = { ...byUserId2, treino_hipertrofia: false };
      } else {
        const { data: byEmail2 } = await supabase.from('alunos').select('id, nome, email, status').eq('email', user.email).single();
        if (byEmail2) alunoData = { ...byEmail2, treino_hipertrofia: false };
      }
    }

    if (!alunoData) { setLoading(false); return; }
    setAluno(alunoData);
    setTreinoHipertrofiaAtivo((alunoData as any).treino_hipertrofia || false);
    await loadAlunoData(alunoData.id, (alunoData as any).treino_hipertrofia);
  };

  const loadAlunoData = async (alunoId: string, temHipertrofia?: boolean) => {
    const [{ data: mens }, { data: conf }, { data: mat }, { data: avals }, { data: mods }] = await Promise.all([
      supabase.from('mensalidades').select('*').eq('aluno_id', alunoId).order('data_vencimento', { ascending: false }),
      supabase.from('configuracoes').select('*').single(),
      supabase.from('matriculas').select('*, planos(nome, duracao_meses)').eq('aluno_id', alunoId).in('status', ['ativa', 'suspensa']).single(),
      supabase.from('avaliacoes_fisicas').select('*').eq('aluno_id', alunoId).order('data_avaliacao', { ascending: true }),
      supabase.from('aluno_modalidades').select('*, modalidades(id, nome, valor)').eq('aluno_id', alunoId).eq('status', 'ativa'),
    ]);
    if (mens) setMensalidades(mens);
    if (conf) setConfig(conf);
    if (mat) setMatricula(mat as any);
    if (avals) setAvaliacoes(avals as any);
    if (mods) {
      setAlunoMods(mods);
      // Buscar horários das modalidades do aluno
      const modIds = mods.map((m: any) => m.modalidades?.id).filter(Boolean);
      if (modIds.length > 0) {
        const { data: hrs } = await supabase.from('horarios_aulas').select('*, exercicios_horario(id, titulo, descricao, imagem_url, ordem)').in('modalidade_id', modIds).order('dia_semana').order('horario_inicio');
        if (hrs) setHorariosMods(hrs);
      }
    }

    // Carregar módulo Hipertrofia se ativo
    if (temHipertrofia) {
      const { data: hiperMod } = await supabase.from('modalidades').select('id, nome').eq('nome', 'TREINOS HIPERTROFIA').eq('ativo', true).single();
      if (hiperMod) {
        setHipertrofiaMod(hiperMod);
        const { data: hiperHrs } = await supabase.from('horarios_aulas').select('*, exercicios_horario(id, titulo, descricao, imagem_url, ordem)').eq('modalidade_id', hiperMod.id).order('dia_semana').order('horario_inicio');
        if (hiperHrs) setHipertrofiaHorarios(hiperHrs);
      }
    }

    // Frequência da semana
    const hoje = new Date();
    const inicioSemana = new Date(hoje);
    inicioSemana.setDate(hoje.getDate() - hoje.getDay());
    const { count: semana } = await supabase
      .from('checkins')
      .select('*', { count: 'exact', head: true })
      .eq('aluno_id', alunoId)
      .gte('data', inicioSemana.toISOString().split('T')[0]);
    setFreqSemana(semana || 0);

    // Carregar mês atual
    await loadFrequenciaMes(alunoId, mesSelecionado);
    setLoading(false);
  };

  const loadFrequenciaMes = async (alunoId: string, mes: string) => {
    const [ano, mesNum] = mes.split('-').map(Number);
    const inicio = `${ano}-${String(mesNum).padStart(2, '0')}-01`;
    const ultimoDia = new Date(ano, mesNum, 0).getDate();
    const fim = `${ano}-${String(mesNum).padStart(2, '0')}-${ultimoDia}`;

    const { data, count } = await supabase
      .from('checkins')
      .select('*', { count: 'exact' })
      .eq('aluno_id', alunoId)
      .gte('data', inicio)
      .lte('data', fim)
      .order('data', { ascending: false });

    setFreqMes(count || 0);
    setCheckinsMes(data || []);
  };

  const handleMesChange = async (novoMes: string) => {
    setMesSelecionado(novoMes);
    if (aluno) await loadFrequenciaMes(aluno.id, novoMes);
  };

  // === TREINO TRACKER ===
  const abrirTreino = async (modalidadeId: string) => {
    setTreinoAberto(modalidadeId);
    setTreinoDia(null);
    setExercicioAtual(0);
    setExerciciosConcluidos([]);
    setTreinoConcluido(false);

    // Carregar exercícios já feitos hoje
    if (aluno) {
      const hoje = getHoje();
      const { data } = await supabase
        .from('treinos_executados')
        .select('exercicio_id')
        .eq('aluno_id', aluno.id)
        .eq('data', hoje);
      if (data) setTreinosHoje(data.map(t => t.exercicio_id));
    }
  };

  const fecharTreino = () => {
    setTreinoAberto(null);
    setTreinoDia(null);
    setExercicioAtual(0);
    setExerciciosConcluidos([]);
    setTreinoConcluido(false);
  };

  const selecionarDiaTreino = (dia: number) => {
    setTreinoDia(dia);
    setExercicioAtual(0);
    setExerciciosConcluidos([]);
    setTreinoConcluido(false);
  };

  const getExerciciosDoDia = (modalidadeId: string, dia: number) => {
    // Verificar se é a modalidade de hipertrofia
    const isHipertrofia = hipertrofiaMod && modalidadeId === hipertrofiaMod.id;
    const horariosSource = isHipertrofia ? hipertrofiaHorarios : horariosMods;
    const horario = horariosSource.find((h: any) => h.modalidade_id === modalidadeId && h.dia_semana === dia);
    if (!horario || !horario.exercicios_horario) return { horario, exercicios: [] };
    const exercicios = [...horario.exercicios_horario].sort((a: any, b: any) => (a.ordem || 0) - (b.ordem || 0));
    return { horario, exercicios };
  };

  const marcarExercicioConcluido = async (exercicioId: string, horarioId: string) => {
    if (!aluno) return;
    const hoje = getHoje();

    // Salvar no banco
    await supabase.from('treinos_executados').upsert({
      aluno_id: aluno.id,
      exercicio_id: exercicioId,
      horario_id: horarioId,
      data: hoje,
      concluido: true,
    }, { onConflict: 'aluno_id,exercicio_id,data' });

    const novosConcluidos = [...exerciciosConcluidos, exercicioId];
    setExerciciosConcluidos(novosConcluidos);
    setTreinosHoje([...treinosHoje, exercicioId]);

    // Verificar se completou todos os exercícios do dia
    const { exercicios } = getExerciciosDoDia(treinoAberto!, treinoDia!);
    if (novosConcluidos.length >= exercicios.length) {
      setTreinoConcluido(true);
    }
  };

  const isDiaConcluido = (modalidadeId: string, dia: number) => {
    const isHipertrofia = hipertrofiaMod && modalidadeId === hipertrofiaMod.id;
    const horariosSource = isHipertrofia ? hipertrofiaHorarios : horariosMods;
    const horario = horariosSource.find((h: any) => h.modalidade_id === modalidadeId && h.dia_semana === dia);
    if (!horario || !horario.exercicios_horario || horario.exercicios_horario.length === 0) return false;
    return horario.exercicios_horario.every((ex: any) => treinosHoje.includes(ex.id));
  };

  const [comprovantesEnviados, setComprovantesEnviados] = useState<string[]>([]);

  const enviarComprovante = (m: MensalidadeAluno) => {
    // Bloquear envio duplicado
    if (comprovantesEnviados.includes(m.id)) {
      alert('Comprovante já enviado para esta mensalidade. Aguarde a confirmação da academia.');
      return;
    }

    const whatsAcademia = config.whatsapp_academia?.replace(/\D/g, '') || '';
    if (!whatsAcademia) { alert('A academia ainda não configurou o WhatsApp.'); return; }

    // Extrair mês de referência do vencimento
    const [ano, mes] = m.data_vencimento.split('-');
    const meses = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const mesRef = `${meses[parseInt(mes)]}/${ano}`;

    const msg = `Olá! Sou ${aluno?.nome}, segue comprovante de pagamento.\n\nReferência: ${mesRef}\nVencimento: ${formatDate(m.data_vencimento)}\nValor: R$ ${Number(m.valor).toFixed(2)}\n\n(anexar comprovante)`;
    window.open(`https://wa.me/${whatsAcademia}?text=${encodeURIComponent(msg)}`, '_blank');

    // Marcar como enviado (salvar no localStorage)
    setComprovantesEnviados([...comprovantesEnviados, m.id]);
    localStorage.setItem('comprovantes_enviados', JSON.stringify([...comprovantesEnviados, m.id]));
  };

  const startScanner = async () => {
    const { Html5Qrcode } = await import('html5-qrcode');
    const scanner = new Html5Qrcode('qr-reader');
    setScannerRef(scanner);
    scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      async (decodedText) => {
        // Verificar se o QR é válido (deve conter /checkin/)
        if (decodedText.includes('/checkin')) {
          await scanner.stop();
          setShowQrScanner(false);
          await registrarCheckin();
        } else {
          setCheckinMsg('⚠️ QR Code inválido. Use o QR Code da academia.');
          await scanner.stop();
          setShowQrScanner(false);
        }
      },
      () => {} // erro silencioso durante scan
    ).catch(() => {
      setCheckinMsg('⚠️ Não foi possível acessar a câmera.');
      setShowQrScanner(false);
    });
  };

  const stopScanner = async () => {
    if (scannerRef) {
      try { await scannerRef.stop(); } catch (e) {}
    }
  };

  const registrarCheckin = async () => {
    if (!aluno) return;
    const hoje = getHoje();
    const horario = new Date().toTimeString().slice(0, 8);

    // Verificar se já fez check-in hoje
    const { data: existing } = await supabase
      .from('checkins')
      .select('id')
      .eq('aluno_id', aluno.id)
      .eq('data', hoje)
      .single();

    if (existing) {
      setCheckinMsg('✅ Você já fez check-in hoje! Bom treino! 💪');
      return;
    }

    const { error } = await supabase.from('checkins').insert({ aluno_id: aluno.id, data: hoje, horario });
    if (error) {
      setCheckinMsg('⚠️ Erro ao registrar check-in.');
    } else {
      setCheckinMsg('✅ Check-in realizado! Bom treino! 💪');
    }
  };

  // Iniciar scanner quando showQrScanner muda
  useEffect(() => {
    if (showQrScanner) { setTimeout(() => startScanner(), 100); }
  }, [showQrScanner]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  // Gerar opções de meses (últimos 12)
  const mesesOptions = () => {
    const options = [];
    const hoje = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      options.push({ value, label });
    }
    return options;
  };

  const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-dark-400">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!aluno) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="card text-center max-w-sm">
          <span className="text-4xl block mb-4">⚠️</span>
          <p className="text-dark-200">Conta não vinculada a um cadastro de aluno.</p>
          <button onClick={handleLogout} className="btn-secondary mt-4">Sair</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <header className="bg-dark-800 shadow-sm border-b border-dark-700">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/IC.png" alt="MyGym" className="w-8 h-8 rounded" />
            <div>
              <h1 className="font-bold text-dark-100">{config.nome_academia || 'MyGym'}</h1>
              <p className="text-xs text-dark-400">Portal do Aluno</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <a href="/mural/" className="px-3 py-1.5 bg-primary-900/30 text-primary-400 border border-primary-800 rounded-lg text-sm font-medium hover:bg-primary-900/50 transition-colors">📢 Mural</a>
            <div className="text-right">
              <p className="font-medium text-dark-200">{aluno.nome}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full ${aluno.status === 'ativo' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{aluno.status}</span>
            </div>
            <button onClick={handleLogout} className="text-sm text-dark-400 hover:text-red-600">Sair</button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* Plano e Matrícula */}
        {matricula && (
          <div className="card">
            <h2 className="text-lg font-semibold text-dark-100 mb-4">📋 Meu Plano</h2>
            <div className="bg-primary-50 rounded-xl p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-primary-600 font-medium">Plano</p>
                  <p className="font-semibold text-primary-800">{matricula.planos?.nome}</p>
                </div>
                <div>
                  <p className="text-xs text-primary-600 font-medium">Mensalidade</p>
                  <p className="font-semibold text-primary-800">R$ {alunoMods.length > 0 ? alunoMods.reduce((sum: number, am: any) => sum + (Number(am.modalidades?.valor) || 0), 0).toFixed(2) : Number(matricula.valor_final).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-primary-600 font-medium">Início</p>
                  <p className="font-semibold text-primary-800">{new Date(matricula.data_inicio).toLocaleDateString('pt-BR')}</p>
                </div>
                <div>
                  <p className="text-xs text-primary-600 font-medium">Validade</p>
                  <p className="font-semibold text-primary-800">{new Date(matricula.data_fim).toLocaleDateString('pt-BR')}</p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-primary-200">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${matricula.status === 'ativa' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  Matrícula {matricula.status}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Check-in */}
        <div className="card">
          <h2 className="text-lg font-semibold text-dark-100 mb-4">📱 Check-in</h2>
          {!showQrScanner ? (
            <div className="text-center py-4 space-y-4">
              <p className="text-dark-400 text-sm">Registre sua presença na academia.</p>
              
              {/* Botão simples de check-in */}
              <button onClick={registrarCheckin} className="btn-primary w-full py-4 text-lg font-bold">
                ✅ Fazer Check-in
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-dark-600"></div></div>
                <div className="relative flex justify-center"><span className="bg-dark-800 px-3 text-xs text-dark-400">ou</span></div>
              </div>

              {/* Opção QR Code */}
              <button onClick={() => setShowQrScanner(true)} className="btn-secondary w-full py-3">
                📷 Check-in por QR Code
              </button>

              {checkinMsg && (
                <div className={`mt-4 p-3 rounded-lg ${checkinMsg.includes('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {checkinMsg}
                </div>
              )}
            </div>
          ) : (
            <div>
              <div id="qr-reader" className="w-full max-w-sm mx-auto"></div>
              <button onClick={() => { setShowQrScanner(false); stopScanner(); }} className="btn-secondary w-full mt-4">Cancelar</button>
            </div>
          )}
        </div>

        {/* Módulo Especial: Treinos Hipertrofia */}
        {treinoHipertrofiaAtivo && hipertrofiaMod && (
          <div className="card border-2 border-orange-500/50 bg-gradient-to-br from-orange-950/20 to-dark-900">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                <span className="text-xl">🏋️</span>
              </div>
              <div>
                <h2 className="text-lg font-bold text-orange-400">Treinos Hipertrofia</h2>
                <p className="text-xs text-orange-300/70">Módulo exclusivo • Treinos guiados por dia</p>
              </div>
            </div>
            <div className="space-y-4">
              {(() => {
                const modId = hipertrofiaMod.id;
                const modHorarios = hipertrofiaHorarios;
                const isAberto = treinoAberto === modId;

                return (
                  <>
                    <div className="flex justify-end">
                      <button
                        onClick={() => isAberto ? fecharTreino() : abrirTreino(modId)}
                        className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${isAberto ? 'bg-red-900/30 text-red-400 border border-red-800' : 'bg-orange-500 text-white hover:bg-orange-600 shadow-lg shadow-orange-500/30'}`}
                      >
                        {isAberto ? '✕ Fechar' : '💪 Iniciar Treino'}
                      </button>
                    </div>

                    {/* Painel de Treino Interativo */}
                    {isAberto && (
                      <div className="bg-dark-800 rounded-xl p-4">
                        {treinoDia === null ? (
                          <div>
                            <p className="text-sm text-dark-300 mb-3 text-center">Selecione o dia do treino:</p>
                            <div className="grid grid-cols-5 gap-2">
                              {[1, 2, 3, 4, 5].map(dia => {
                                const temExercicios = modHorarios.some((h: any) => h.dia_semana === dia && h.exercicios_horario && h.exercicios_horario.length > 0);
                                const concluido = isDiaConcluido(modId, dia);
                                return (
                                  <button
                                    key={dia}
                                    onClick={() => temExercicios ? selecionarDiaTreino(dia) : null}
                                    disabled={!temExercicios}
                                    className={`p-3 rounded-xl text-center transition-all ${
                                      concluido ? 'bg-orange-900/40 border-2 border-orange-500' :
                                      temExercicios ? 'bg-dark-700 hover:bg-orange-900/30 border border-dark-600 hover:border-orange-500' :
                                      'bg-dark-900 border border-dark-700 opacity-40 cursor-not-allowed'
                                    }`}
                                  >
                                    <p className={`font-bold text-sm ${concluido ? 'text-orange-400' : temExercicios ? 'text-dark-100' : 'text-dark-500'}`}>
                                      {diasSemana[dia]}
                                    </p>
                                    {concluido && <p className="text-orange-400 text-xs mt-1">✅</p>}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ) : !treinoConcluido ? (
                          (() => {
                            const horario = hipertrofiaHorarios.find((h: any) => h.dia_semana === treinoDia);
                            const exercicios = horario?.exercicios_horario ? [...horario.exercicios_horario].sort((a: any, b: any) => (a.ordem || 0) - (b.ordem || 0)) : [];
                            if (exercicios.length === 0) return (
                              <div className="text-center py-6">
                                <p className="text-dark-400">Nenhum exercício cadastrado para este dia.</p>
                                <button onClick={() => setTreinoDia(null)} className="btn-secondary mt-4">← Voltar</button>
                              </div>
                            );
                            const exAtual = exercicios[exercicioAtual];
                            if (!exAtual) return null;
                            const jaFeito = treinosHoje.includes(exAtual.id);

                            return (
                              <div>
                                <div className="flex items-center justify-between mb-4">
                                  <button onClick={() => setTreinoDia(null)} className="text-sm text-dark-400 hover:text-dark-200">← Voltar</button>
                                  <span className="text-xs text-orange-400 font-medium">
                                    {diasSemana[treinoDia]} — Exercício {exercicioAtual + 1} de {exercicios.length}
                                  </span>
                                </div>
                                <div className="w-full bg-dark-700 rounded-full h-2 mb-6">
                                  <div className="bg-orange-500 h-2 rounded-full transition-all duration-500" style={{ width: `${(exerciciosConcluidos.length / exercicios.length) * 100}%` }}></div>
                                </div>
                                <div className="bg-dark-700 rounded-xl p-4 space-y-4">
                                  {exAtual.imagem_url && <img src={exAtual.imagem_url} alt={exAtual.titulo || exAtual.descricao} className="w-full rounded-xl max-h-64 object-cover" />}
                                  <div>
                                    {exAtual.titulo && <h3 className="text-lg font-bold text-dark-100">{exAtual.titulo}</h3>}
                                    {exAtual.descricao && <p className="text-dark-300 mt-1">{exAtual.descricao}</p>}
                                  </div>
                                </div>
                                <div className="mt-6 space-y-3">
                                  <div className="flex gap-3">
                                    <button onClick={() => setExercicioAtual(exercicioAtual - 1)} disabled={exercicioAtual === 0} className={`flex-1 py-3 rounded-xl font-medium text-center transition-all ${exercicioAtual === 0 ? 'bg-dark-800 text-dark-500 cursor-not-allowed' : 'bg-dark-700 text-dark-200 hover:bg-dark-600 active:scale-95'}`}>← Anterior</button>
                                    <button onClick={() => setExercicioAtual(exercicioAtual + 1)} disabled={exercicioAtual >= exercicios.length - 1} className={`flex-1 py-3 rounded-xl font-medium text-center transition-all ${exercicioAtual >= exercicios.length - 1 ? 'bg-dark-800 text-dark-500 cursor-not-allowed' : 'bg-dark-700 text-dark-200 hover:bg-dark-600 active:scale-95'}`}>Próximo →</button>
                                  </div>
                                  <button onClick={() => marcarExercicioConcluido(exAtual.id, horario.id)} disabled={jaFeito} className={`w-full py-3 rounded-xl font-medium text-center transition-all ${jaFeito ? 'bg-orange-900/30 text-orange-400 border border-orange-800' : 'bg-orange-500 text-white hover:bg-orange-600 active:scale-95'}`}>
                                    {jaFeito ? '✅ Já executado' : '✅ Marcar como Concluído'}
                                  </button>
                                </div>
                              </div>
                            );
                          })()
                        ) : (
                          <div className="text-center py-8">
                            <span className="text-6xl block mb-4">🎉</span>
                            <h3 className="text-2xl font-bold text-dark-100 mb-2">Treino Concluído!</h3>
                            <p className="text-dark-400 mb-6">Parabéns! Você completou o treino de {diasSemana[treinoDia]}.</p>
                            <div className="flex gap-3 justify-center">
                              <button onClick={() => setTreinoDia(null)} className="btn-secondary">← Outro dia</button>
                              <button onClick={fecharTreino} className="px-6 py-2 bg-orange-500 text-white rounded-xl font-medium">✓ Finalizar</button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Horários (quando fechado) */}
                    {!isAberto && modHorarios.length > 0 && (
                      <div className="bg-dark-800/50 rounded-lg p-3">
                        <p className="text-xs font-medium text-orange-400/70 uppercase mb-2">Dias de treino</p>
                        <div className="flex flex-wrap gap-2">
                          {modHorarios.map((h: any) => (
                            <span key={h.id} className="px-3 py-1.5 bg-dark-700 rounded-lg text-sm text-dark-200">
                              <strong className="text-orange-400">{diasSemana[h.dia_semana]}</strong> {h.horario_inicio?.slice(0, 5)}-{h.horario_fim?.slice(0, 5)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* Modalidades */}
        {alunoMods.length > 0 && (
          <div className="card">
            <h2 className="text-lg font-semibold text-dark-100 mb-4">🏃 Minhas Modalidades</h2>
            <div className="space-y-4">
              {alunoMods.map((am: any) => {
                const modId = am.modalidades?.id;
                const modHorarios = horariosMods.filter((h: any) => h.modalidade_id === modId);
                const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
                const isAberto = treinoAberto === modId;

                return (
                  <div key={am.id} className="bg-primary-50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary-900/30 rounded-lg flex items-center justify-center">
                          <img src="/IC.png" alt="" className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="font-medium text-primary-800">{am.modalidades?.nome}</p>
                          <p className="text-xs text-primary-600">R$ {am.modalidades?.valor ? Number(am.modalidades.valor).toFixed(2) : '—'}/mês</p>
                        </div>
                      </div>
                      <button
                        onClick={() => isAberto ? fecharTreino() : abrirTreino(modId)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isAberto ? 'bg-red-900/30 text-red-400 border border-red-800' : 'bg-primary-600 text-white'}`}
                      >
                        {isAberto ? '✕ Fechar' : '💪 Iniciar Treino'}
                      </button>
                    </div>

                    {/* Painel de Treino Interativo */}
                    {isAberto && (
                      <div className="mt-4 bg-dark-800 rounded-xl p-4">
                        {/* Seleção de dia */}
                        {treinoDia === null ? (
                          <div>
                            <p className="text-sm text-dark-300 mb-3 text-center">Selecione o dia do treino:</p>
                            <div className="grid grid-cols-5 gap-2">
                              {[1, 2, 3, 4, 5].map(dia => {
                                const temExercicios = modHorarios.some((h: any) => h.dia_semana === dia && h.exercicios_horario && h.exercicios_horario.length > 0);
                                const concluido = isDiaConcluido(modId, dia);
                                return (
                                  <button
                                    key={dia}
                                    onClick={() => temExercicios ? selecionarDiaTreino(dia) : null}
                                    disabled={!temExercicios}
                                    className={`p-3 rounded-xl text-center transition-all ${
                                      concluido ? 'bg-green-900/40 border-2 border-green-600' :
                                      temExercicios ? 'bg-dark-700 hover:bg-primary-900/30 border border-dark-600 hover:border-primary-600' :
                                      'bg-dark-900 border border-dark-700 opacity-40 cursor-not-allowed'
                                    }`}
                                  >
                                    <p className={`font-bold text-sm ${concluido ? 'text-green-400' : temExercicios ? 'text-dark-100' : 'text-dark-500'}`}>
                                      {diasSemana[dia]}
                                    </p>
                                    {concluido && <p className="text-green-400 text-xs mt-1">✅</p>}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ) : !treinoConcluido ? (
                          /* Exibição do exercício atual */
                          (() => {
                            const { horario, exercicios } = getExerciciosDoDia(modId, treinoDia);
                            if (exercicios.length === 0) return (
                              <div className="text-center py-6">
                                <p className="text-dark-400">Nenhum exercício cadastrado para este dia.</p>
                                <button onClick={() => setTreinoDia(null)} className="btn-secondary mt-4">← Voltar</button>
                              </div>
                            );
                            const exAtual = exercicios[exercicioAtual];
                            if (!exAtual) return null;
                            const jaFeito = treinosHoje.includes(exAtual.id);

                            return (
                              <div>
                                {/* Header com progresso */}
                                <div className="flex items-center justify-between mb-4">
                                  <button onClick={() => setTreinoDia(null)} className="text-sm text-dark-400 hover:text-dark-200">← Voltar</button>
                                  <span className="text-xs text-dark-400 font-medium">
                                    {diasSemana[treinoDia]} — Exercício {exercicioAtual + 1} de {exercicios.length}
                                  </span>
                                </div>

                                {/* Barra de progresso */}
                                <div className="w-full bg-dark-700 rounded-full h-2 mb-6">
                                  <div
                                    className="bg-primary-600 h-2 rounded-full transition-all duration-500"
                                    style={{ width: `${(exerciciosConcluidos.length / exercicios.length) * 100}%` }}
                                  ></div>
                                </div>

                                {/* Card do exercício */}
                                <div className="bg-dark-700 rounded-xl p-4 space-y-4">
                                  {exAtual.imagem_url && (
                                    <img
                                      src={exAtual.imagem_url}
                                      alt={exAtual.titulo || exAtual.descricao}
                                      className="w-full rounded-xl max-h-64 object-cover"
                                    />
                                  )}
                                  <div>
                                    {exAtual.titulo && <h3 className="text-lg font-bold text-dark-100">{exAtual.titulo}</h3>}
                                    {exAtual.descricao && <p className="text-dark-300 mt-1">{exAtual.descricao}</p>}
                                  </div>
                                </div>

                                {/* Navegação e botão de concluir */}
                                <div className="mt-6 space-y-3">
                                  {/* Botões de navegação */}
                                  <div className="flex gap-3">
                                    <button
                                      onClick={() => setExercicioAtual(exercicioAtual - 1)}
                                      disabled={exercicioAtual === 0}
                                      className={`flex-1 py-3 rounded-xl font-medium text-center transition-all ${
                                        exercicioAtual === 0
                                          ? 'bg-dark-800 text-dark-500 cursor-not-allowed'
                                          : 'bg-dark-700 text-dark-200 hover:bg-dark-600 active:scale-95'
                                      }`}
                                    >
                                      ← Anterior
                                    </button>
                                    <button
                                      onClick={() => setExercicioAtual(exercicioAtual + 1)}
                                      disabled={exercicioAtual >= exercicios.length - 1}
                                      className={`flex-1 py-3 rounded-xl font-medium text-center transition-all ${
                                        exercicioAtual >= exercicios.length - 1
                                          ? 'bg-dark-800 text-dark-500 cursor-not-allowed'
                                          : 'bg-dark-700 text-dark-200 hover:bg-dark-600 active:scale-95'
                                      }`}
                                    >
                                      Próximo →
                                    </button>
                                  </div>

                                  {/* Botão de marcar como concluído */}
                                  <button
                                    onClick={() => marcarExercicioConcluido(exAtual.id, horario.id)}
                                    disabled={jaFeito}
                                    className={`w-full py-3 rounded-xl font-medium text-center transition-all ${
                                      jaFeito
                                        ? 'bg-green-900/30 text-green-400 border border-green-800'
                                        : 'bg-primary-600 text-white hover:bg-primary-700 active:scale-95'
                                    }`}
                                  >
                                    {jaFeito ? '✅ Já executado' : '✅ Marcar como Concluído'}
                                  </button>
                                </div>
                              </div>
                            );
                          })()
                        ) : (
                          /* Treino concluído */
                          <div className="text-center py-8">
                            <span className="text-6xl block mb-4">🎉</span>
                            <h3 className="text-2xl font-bold text-dark-100 mb-2">Treino Concluído!</h3>
                            <p className="text-dark-400 mb-6">Parabéns! Você completou o treino de {diasSemana[treinoDia]}.</p>
                            <div className="flex gap-3 justify-center">
                              <button onClick={() => setTreinoDia(null)} className="btn-secondary">← Escolher outro dia</button>
                              <button onClick={fecharTreino} className="btn-primary">✓ Finalizar</button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Horários (quando treino fechado) */}
                    {!isAberto && modHorarios.length > 0 && (
                      <div className="bg-dark-800 rounded-lg p-3">
                        <p className="text-xs font-medium text-dark-400 uppercase mb-2">Horários & Treinos</p>
                        <div className="space-y-2">
                          {modHorarios.map((h: any) => (
                            <div key={h.id} className="flex items-center gap-2 p-2 bg-dark-700 rounded-lg">
                              <span className="px-2 py-0.5 bg-primary-900/30 text-primary-400 rounded text-xs font-medium">{diasSemana[h.dia_semana]}</span>
                              <span className="text-sm text-dark-200">{h.horario_inicio?.slice(0, 5)}-{h.horario_fim?.slice(0, 5)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Frequência */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-dark-100">📱 Minha Frequência</h2>
          </div>

          {/* Resumo semanal e mensal */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-purple-50 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-purple-700">{freqSemana}</p>
              <p className="text-xs text-purple-600 mt-1">check-ins esta semana</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-blue-700">{freqMes}</p>
              <p className="text-xs text-blue-600 mt-1">check-ins no mês</p>
            </div>
          </div>

          {/* Seletor de mês */}
          <div className="flex items-center gap-3 mb-4">
            <label className="text-sm font-medium text-dark-200">Mês:</label>
            <select
              value={mesSelecionado}
              onChange={(e) => handleMesChange(e.target.value)}
              className="input-field w-48"
            >
              {mesesOptions().map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* Lista de check-ins do mês */}
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {checkinsMes.length === 0 ? (
              <p className="text-dark-400 text-center py-4 text-sm">Nenhum check-in neste mês.</p>
            ) : (
              checkinsMes.map((c) => {
                const data = new Date(c.data + 'T00:00:00');
                const diaSemana = diasSemana[data.getDay()];
                return (
                  <div key={c.id} className="flex items-center justify-between p-2 bg-dark-800 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium bg-primary-100 text-primary-700 px-2 py-0.5 rounded">{diaSemana}</span>
                      <span className="text-sm text-dark-200">{data.toLocaleDateString('pt-BR')}</span>
                    </div>
                    <span className="text-sm text-dark-400">{c.horario?.slice(0, 5)}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Evolução Física */}
        {avaliacoes.length > 0 && (
          <div className="card">
            <h2 className="text-lg font-semibold text-dark-100 mb-4">📈 Minha Evolução Física</h2>

            {/* Resumo: primeira vs última */}
            {avaliacoes.length >= 2 && (() => {
              const first = avaliacoes[0];
              const last = avaliacoes[avaliacoes.length - 1];
              return (
                <div className="bg-primary-50 rounded-xl p-4 mb-4">
                  <p className="text-xs text-primary-600 font-medium mb-2">Evolução desde {new Date(first.data_avaliacao).toLocaleDateString('pt-BR')}</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {first.peso && last.peso && (() => {
                      const diff = last.peso - first.peso;
                      return (
                        <div className={`p-2 rounded-lg ${diff <= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                          <p className="text-xs text-dark-400">Peso</p>
                          <p className={`font-bold ${diff <= 0 ? 'text-green-700' : 'text-red-700'}`}>{diff > 0 ? '+' : ''}{diff.toFixed(1)} kg</p>
                        </div>
                      );
                    })()}
                    {first.gordura_corporal && last.gordura_corporal && (() => {
                      const diff = last.gordura_corporal - first.gordura_corporal;
                      return (
                        <div className={`p-2 rounded-lg ${diff <= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                          <p className="text-xs text-dark-400">% Gordura</p>
                          <p className={`font-bold ${diff <= 0 ? 'text-green-700' : 'text-red-700'}`}>{diff > 0 ? '+' : ''}{diff.toFixed(1)}%</p>
                        </div>
                      );
                    })()}
                    {first.massa_muscular && last.massa_muscular && (() => {
                      const diff = last.massa_muscular - first.massa_muscular;
                      return (
                        <div className={`p-2 rounded-lg ${diff >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                          <p className="text-xs text-dark-400">Massa Musc.</p>
                          <p className={`font-bold ${diff >= 0 ? 'text-green-700' : 'text-red-700'}`}>{diff > 0 ? '+' : ''}{diff.toFixed(1)} kg</p>
                        </div>
                      );
                    })()}
                    {last.imc && (
                      <div className="p-2 rounded-lg bg-blue-100">
                        <p className="text-xs text-dark-400">IMC Atual</p>
                        <p className="font-bold text-blue-700">{last.imc}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Últimas avaliações */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-dark-800">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs text-dark-400">Data</th>
                    <th className="px-3 py-2 text-left text-xs text-dark-400">Peso</th>
                    <th className="px-3 py-2 text-left text-xs text-dark-400">IMC</th>
                    <th className="px-3 py-2 text-left text-xs text-dark-400">% Gord.</th>
                    <th className="px-3 py-2 text-left text-xs text-dark-400">Musc.</th>
                    <th className="px-3 py-2 text-left text-xs text-dark-400">Cintura</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-100">
                  {avaliacoes.slice().reverse().map((av, i) => (
                    <tr key={av.id}>
                      <td className="px-3 py-2 font-medium">{new Date(av.data_avaliacao).toLocaleDateString('pt-BR')}</td>
                      <td className="px-3 py-2">{av.peso ? `${av.peso} kg` : '—'}</td>
                      <td className="px-3 py-2">{av.imc || '—'}</td>
                      <td className="px-3 py-2">{av.gordura_corporal ? `${av.gordura_corporal}%` : '—'}</td>
                      <td className="px-3 py-2">{av.massa_muscular ? `${av.massa_muscular} kg` : '—'}</td>
                      <td className="px-3 py-2">{av.cintura ? `${av.cintura} cm` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Dados de Pagamento */}
        <div className="card">
          <h2 className="text-lg font-semibold text-dark-100 mb-4">💲 Dados para Pagamento</h2>
          {!config.pix_chave && !config.banco_nome ? (
            <p className="text-dark-400 text-sm">A academia ainda não configurou os dados de pagamento.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {config.pix_chave && (
                <div className="bg-green-50 rounded-xl p-4">
                  <h3 className="font-medium text-green-800 mb-2">PIX</h3>
                  <p className="text-sm text-green-700"><strong>Chave ({config.pix_tipo}):</strong> {config.pix_chave}</p>
                  {config.pix_beneficiario && <p className="text-sm text-green-700"><strong>Beneficiário:</strong> {config.pix_beneficiario}</p>}
                </div>
              )}
              {config.banco_nome && (
                <div className="bg-blue-50 rounded-xl p-4">
                  <h3 className="font-medium text-blue-800 mb-2">Conta Bancária</h3>
                  <p className="text-sm text-blue-700"><strong>Banco:</strong> {config.banco_nome}</p>
                  <p className="text-sm text-blue-700"><strong>Agência:</strong> {config.banco_agencia}</p>
                  <p className="text-sm text-blue-700"><strong>Conta ({config.banco_tipo_conta}):</strong> {config.banco_conta}</p>
                  {config.banco_beneficiario && <p className="text-sm text-blue-700"><strong>Beneficiário:</strong> {config.banco_beneficiario}</p>}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mensalidades */}
        <div className="card">
          <h2 className="text-lg font-semibold text-dark-100 mb-4">📄 Minhas Mensalidades</h2>
          <div className="space-y-3">
            {mensalidades.length === 0 ? (
              <p className="text-dark-400 text-center py-4">Nenhuma mensalidade.</p>
            ) : (
              mensalidades.map((m) => (
                <div key={m.id} className="flex items-center justify-between p-4 bg-dark-800 rounded-lg">
                  <div>
                    <p className="font-medium text-dark-200">R$ {Number(m.valor).toFixed(2)}</p>
                    <p className="text-xs text-dark-400">Vencimento: {formatDate(m.data_vencimento)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`badge-${m.status === 'pago' ? 'pago' : m.status === 'atrasado' ? 'inadimplente' : 'pendente'}`}>
                      {m.status === 'pago' ? '✓ Pago' : m.status === 'atrasado' ? 'Atrasado' : 'A vencer'}
                    </span>
                    {m.status !== 'pago' && (
                      comprovantesEnviados.includes(m.id) ? (
                        <span className="px-3 py-1.5 bg-dark-700 text-dark-400 text-xs font-medium rounded-lg">✓ Comprovante enviado</span>
                      ) : (
                        <button onClick={() => enviarComprovante(m)} className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors">
                          📲 Enviar Comprovante
                        </button>
                      )
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
