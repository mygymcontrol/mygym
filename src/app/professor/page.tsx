'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getHoje } from '@/lib/utils';

const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function PortalProfessorPage() {
  const [professor, setProfessor] = useState<any>(null);
  const [modalidades, setModalidades] = useState<any[]>([]);
  const [horarios, setHorarios] = useState<any[]>([]);
  const [horasSemanais, setHorasSemanais] = useState(0);
  const [horasConfirmadas, setHorasConfirmadas] = useState(0);
  const [ganhoMes, setGanhoMes] = useState(0);
  const [ganhoStatus, setGanhoStatus] = useState('pendente');
  const [aulasNoMes, setAulasNoMes] = useState(0);
  const [valorAula, setValorAula] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [checkinMsg, setCheckinMsg] = useState('');
  const [scannerRef, setScannerRef] = useState<any>(null);

  useEffect(() => { checkAuth(); }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = '/'; return; }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'professor') { window.location.href = '/'; return; }

    const { data: prof } = await supabase.from('professores').select('*').eq('user_id', user.id).single();
    if (!prof) {
      const { data: profByEmail } = await supabase.from('professores').select('*').eq('email', user.email).single();
      if (profByEmail) { setProfessor(profByEmail); await loadProfData(profByEmail.id); }
      else setLoading(false);
      return;
    }
    setProfessor(prof);
    await loadProfData(prof.id);
  };

  const loadProfData = async (profId: string) => {
    const { data: mods } = await supabase.from('modalidades').select('id, nome, valor').eq('professor_id_ref', profId).eq('ativo', true);
    if (mods) {
      setModalidades(mods);
      const modIds = mods.map(m => m.id);
      if (modIds.length > 0) {
        const { data: hrs } = await supabase.from('horarios_aulas').select('*').in('modalidade_id', modIds).order('dia_semana').order('horario_inicio');
        if (hrs) {
          setHorarios(hrs);
          // Calcular horas semanais totais
          let totalMin = 0;
          hrs.forEach(h => {
            const [hi, mi] = h.horario_inicio.split(':').map(Number);
            const [hf, mf] = h.horario_fim.split(':').map(Number);
            totalMin += (hf * 60 + mf) - (hi * 60 + mi);
          });
          setHorasSemanais(totalMin / 60);
        }
      }
    }

    // Calcular horas confirmadas na semana (check-ins desta semana)
    const hoje = new Date();
    const inicioSemana = new Date(hoje);
    inicioSemana.setDate(hoje.getDate() - hoje.getDay());
    const { data: checkins } = await supabase
      .from('checkins_professores')
      .select('horas_confirmadas')
      .eq('professor_id', profId)
      .gte('data', inicioSemana.toISOString().split('T')[0]);

    if (checkins) {
      const total = checkins.reduce((sum: number, c: any) => sum + Number(c.horas_confirmadas), 0);
      setHorasConfirmadas(total);
    }

    // Calcular ganhos do mês
    const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    const inicioMes = `${mesAtual}-01`;
    const fimMes = `${mesAtual}-31`;

    const { data: checkinsMes } = await supabase
      .from('checkins_professores')
      .select('id')
      .eq('professor_id', profId)
      .gte('data', inicioMes)
      .lte('data', fimMes);

    const aulasM = checkinsMes?.length || 0;
    setAulasNoMes(aulasM);

    // Buscar valor da aula
    const { data: valoresAula } = await supabase.from('professor_modalidade_valor').select('valor_aula').eq('professor_id', profId);
    const vlAula = valoresAula && valoresAula.length > 0 ? valoresAula.reduce((sum: number, v: any) => sum + Number(v.valor_aula), 0) / valoresAula.length : 0;
    setValorAula(vlAula);
    setGanhoMes(aulasM * vlAula);

    // Verificar status de pagamento do mês
    const { data: pagamento } = await supabase.from('pagamentos_professores').select('status').eq('professor_id', profId).eq('mes_referencia', mesAtual).single();
    if (pagamento) setGanhoStatus(pagamento.status);

    setLoading(false);
  };

  const getHorasDoDia = () => {
    const hoje = new Date().getDay(); // 0=Dom, 1=Seg...
    const horasDia = horarios.filter(h => h.dia_semana === hoje);
    let totalMin = 0;
    horasDia.forEach(h => {
      const [hi, mi] = h.horario_inicio.split(':').map(Number);
      const [hf, mf] = h.horario_fim.split(':').map(Number);
      totalMin += (hf * 60 + mf) - (hi * 60 + mi);
    });
    return totalMin / 60;
  };

  const registrarCheckin = async () => {
    if (!professor) return;
    const hoje = getHoje();
    const horario = new Date().toTimeString().slice(0, 8);

    // Verificar se já fez check-in hoje
    const { data: existing } = await supabase
      .from('checkins_professores')
      .select('id')
      .eq('professor_id', professor.id)
      .eq('data', hoje)
      .single();

    if (existing) { setCheckinMsg('✅ Você já confirmou presença hoje!'); return; }

    // Calcular horas do dia
    const horasDia = getHorasDoDia();
    if (horasDia === 0) { setCheckinMsg('⚠️ Você não tem aulas programadas para hoje.'); return; }

    // Registrar check-in
    await supabase.from('checkins_professores').insert({
      professor_id: professor.id,
      data: hoje,
      horario,
      horas_confirmadas: horasDia,
    });

    setHorasConfirmadas(prev => prev + horasDia);
    setCheckinMsg(`✅ Presença confirmada! ${horasDia}h registradas.`);
  };

  const startScanner = async () => {
    const { Html5Qrcode } = await import('html5-qrcode');
    const scanner = new Html5Qrcode('qr-reader-prof');
    setScannerRef(scanner);
    scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 250, height: 250 } },
      async (decodedText) => {
        if (decodedText.includes('/checkin')) {
          await scanner.stop(); setShowQrScanner(false); await registrarCheckin();
        } else { setCheckinMsg('⚠️ QR Code inválido.'); await scanner.stop(); setShowQrScanner(false); }
      }, () => {}
    ).catch(() => { setCheckinMsg('⚠️ Câmera indisponível.'); setShowQrScanner(false); });
  };

  const stopScanner = async () => { if (scannerRef) { try { await scannerRef.stop(); } catch (e) {} } };
  useEffect(() => { if (showQrScanner) { setTimeout(() => startScanner(), 100); } }, [showQrScanner]);
  const handleLogout = async () => { await supabase.auth.signOut(); window.location.href = '/'; };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-black"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div></div>;
  if (!professor) return <div className="min-h-screen flex items-center justify-center bg-black"><div className="card text-center"><p className="text-dark-400">Conta não vinculada.</p><button onClick={handleLogout} className="btn-secondary mt-4">Sair</button></div></div>;

  return (
    <div className="min-h-screen bg-black">
      <header className="bg-dark-800 border-b border-dark-700">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/IC.png" alt="MyGym" className="w-8 h-8 rounded" />
            <h1 className="font-bold text-dark-100">Portal do Professor</h1>
          </div>
          <div className="flex items-center gap-4">
            <p className="font-medium text-dark-200">{professor.nome}</p>
            <button onClick={handleLogout} className="text-sm text-dark-400 hover:text-red-400">Sair</button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Horas confirmadas */}
        <div className="card">
          <h2 className="text-lg font-semibold text-dark-100 mb-4">⏱ Horas da Semana</h2>
          <div className="bg-dark-700 rounded-xl p-6 text-center">
            <p className="text-4xl font-bold text-primary-400">{horasConfirmadas}h <span className="text-dark-400 text-xl">de {horasSemanais}h</span></p>
            <p className="text-sm text-dark-400 mt-2">confirmadas esta semana</p>
            <div className="w-full bg-dark-800 rounded-full h-3 mt-4">
              <div className="bg-primary-600 h-3 rounded-full transition-all" style={{ width: `${Math.min((horasConfirmadas / horasSemanais) * 100, 100)}%` }}></div>
            </div>
          </div>
        </div>

        {/* Check-in */}
        <div className="card">
          <h2 className="text-lg font-semibold text-dark-100 mb-4">📱 Confirmar Presença</h2>
          {!showQrScanner ? (
            <div className="text-center py-4">
              <p className="text-dark-400 text-sm mb-4">Escaneie o QR Code da academia para confirmar que deu aula hoje.</p>
              <button onClick={() => setShowQrScanner(true)} className="btn-primary px-8 py-3">📷 Fazer Check-in</button>
              {checkinMsg && <div className={`mt-4 p-3 rounded-lg ${checkinMsg.includes('✅') ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>{checkinMsg}</div>}
            </div>
          ) : (
            <div><div id="qr-reader-prof" className="w-full max-w-sm mx-auto"></div><button onClick={() => { setShowQrScanner(false); stopScanner(); }} className="btn-secondary w-full mt-4">Cancelar</button></div>
          )}
        </div>

        {/* Meus Ganhos */}
        <div className="card">
          <h2 className="text-lg font-semibold text-dark-100 mb-4">💰 Meus Ganhos — {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</h2>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-dark-700 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-primary-400">{aulasNoMes}</p>
              <p className="text-xs text-dark-400">aulas dadas</p>
            </div>
            <div className="bg-dark-700 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-dark-200">R$ {valorAula.toFixed(0)}</p>
              <p className="text-xs text-dark-400">por aula</p>
            </div>
            <div className="bg-dark-700 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-green-400">R$ {ganhoMes.toFixed(2)}</p>
              <p className="text-xs text-dark-400">total do mês</p>
            </div>
          </div>
          <div className={`p-3 rounded-lg text-center text-sm font-medium ${ganhoStatus === 'pago' ? 'bg-green-900/30 text-green-400' : 'bg-yellow-900/30 text-yellow-400'}`}>
            {ganhoStatus === 'pago' ? '✅ Pagamento confirmado' : '⏳ Pagamento pendente'}
          </div>
        </div>

        {/* Minhas Aulas */}
        <div className="card">
          <h2 className="text-lg font-semibold text-dark-100 mb-4">🏃 Minhas Aulas</h2>
          {modalidades.length === 0 ? (
            <p className="text-dark-400 text-center py-4">Nenhuma modalidade vinculada.</p>
          ) : (
            <div className="space-y-4">
              {modalidades.map((mod) => {
                const modHorarios = horarios.filter(h => h.modalidade_id === mod.id);
                return (
                  <div key={mod.id} className="bg-dark-700 rounded-xl p-4">
                    <h3 className="font-medium text-dark-100 mb-2">{mod.nome}</h3>
                    {modHorarios.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {modHorarios.map((h: any) => (
                          <span key={h.id} className="inline-flex items-center gap-1 px-3 py-1.5 bg-dark-800 rounded-lg text-sm text-dark-200">
                            <strong className="text-primary-400">{diasSemana[h.dia_semana]}</strong> {h.horario_inicio?.slice(0, 5)}-{h.horario_fim?.slice(0, 5)}
                          </span>
                        ))}
                      </div>
                    ) : <p className="text-dark-400 text-sm">Sem horários definidos.</p>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
