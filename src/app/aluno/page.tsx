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
    const { data: byUserId } = await supabase.from('alunos').select('id, nome, email, status').eq('user_id', user.id).single();
    if (byUserId) {
      alunoData = byUserId;
    } else {
      const { data: byEmail } = await supabase.from('alunos').select('id, nome, email, status').eq('email', user.email).single();
      if (byEmail) alunoData = byEmail;
    }

    if (!alunoData) { setLoading(false); return; }
    setAluno(alunoData);
    await loadAlunoData(alunoData.id);
  };

  const loadAlunoData = async (alunoId: string) => {
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
        const { data: hrs } = await supabase.from('horarios_aulas').select('*, exercicios_horario(id, descricao, imagem_url, ordem)').in('modalidade_id', modIds).order('dia_semana').order('horario_inicio');
        if (hrs) setHorariosMods(hrs);
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
                  <p className="text-xs text-primary-600 font-medium">Valor</p>
                  <p className="font-semibold text-primary-800">R$ {Number(matricula.valor_final).toFixed(2)}</p>
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

        {/* Check-in via QR */}
        <div className="card">
          <h2 className="text-lg font-semibold text-dark-100 mb-4">📱 Check-in</h2>
          {!showQrScanner ? (
            <div className="text-center py-4">
              <p className="text-dark-400 text-sm mb-4">Aponte a câmera para o QR Code da academia para registrar presença.</p>
              <button onClick={() => setShowQrScanner(true)} className="btn-primary px-8 py-3">
                📷 Fazer Check-in
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

        {/* Modalidades */}
        {alunoMods.length > 0 && (
          <div className="card">
            <h2 className="text-lg font-semibold text-dark-100 mb-4">🏃 Minhas Modalidades</h2>
            <div className="space-y-4">
              {alunoMods.map((am: any) => {
                const modHorarios = horariosMods.filter((h: any) => h.modalidade_id === am.modalidades?.id);
                const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
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
                    </div>
                    {modHorarios.length > 0 && (
                      <div className="bg-dark-800 rounded-lg p-3">
                        <p className="text-xs font-medium text-dark-400 uppercase mb-2">Horários & Treinos</p>
                        <div className="space-y-2">
                          {modHorarios.map((h: any) => (
                            <details key={h.id} className="bg-dark-700 rounded-lg">
                              <summary className="flex items-center gap-2 p-3 cursor-pointer">
                                <span className="px-2 py-0.5 bg-primary-900/30 text-primary-400 rounded text-xs font-medium">{diasSemana[h.dia_semana]}</span>
                                <span className="text-sm text-dark-200">{h.horario_inicio?.slice(0, 5)}-{h.horario_fim?.slice(0, 5)}</span>
                                {h.descricao_treino && <span className="text-xs text-dark-400 ml-2">{h.descricao_treino.slice(0, 30)}...</span>}
                              </summary>
                              <div className="px-3 pb-3 space-y-2">
                                {h.descricao_treino && <p className="text-sm text-dark-300 whitespace-pre-line">{h.descricao_treino}</p>}
                                {h.imagem_url && <img src={h.imagem_url} alt="Treino" className="rounded-lg max-h-48 w-full object-cover" />}
                                {h.exercicios_horario && h.exercicios_horario.length > 0 && h.exercicios_horario.map((ex: any) => (
                                  <div key={ex.id} className="bg-dark-800 rounded-lg p-2">
                                    <p className="text-sm text-dark-200">{ex.descricao}</p>
                                    {ex.imagem_url && <img src={ex.imagem_url} alt="" className="mt-2 rounded-lg max-h-40 w-full object-cover" />}
                                  </div>
                                ))}
                              </div>
                            </details>
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
