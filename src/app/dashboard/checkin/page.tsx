'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getHoje } from '@/lib/utils';
import DashboardLayout from '@/components/DashboardLayout';

interface CheckinComAluno {
  id: string;
  data: string;
  horario: string;
  alunos: {
    nome: string;
  };
}

export default function CheckinPage() {
  const [checkins, setCheckins] = useState<CheckinComAluno[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrUrl, setQrUrl] = useState('');
  const [configQr, setConfigQr] = useState('');
  const [alunos, setAlunos] = useState<any[]>([]);
  const [alunoSelecionado, setAlunoSelecionado] = useState('');
  const [buscaAluno, setBuscaAluno] = useState('');
  const [checkinManualMsg, setCheckinManualMsg] = useState('');

  useEffect(() => {
    loadCheckins();
    loadQrConfig();
    loadAlunos();
  }, []);

  const loadCheckins = async () => {
    const hoje = getHoje();
    const { data } = await supabase
      .from('checkins')
      .select('*, alunos(nome)')
      .eq('data', hoje)
      .order('horario', { ascending: false });
    
    if (data) setCheckins(data as any);
    setLoading(false);
  };

  const loadQrConfig = async () => {
    const { data } = await supabase
      .from('configuracoes')
      .select('qrcode_checkin')
      .single();
    
    if (data?.qrcode_checkin) {
      setConfigQr(data.qrcode_checkin);
      setQrUrl(data.qrcode_checkin);
    }
  };

  const loadAlunos = async () => {
    const { data } = await supabase
      .from('alunos')
      .select('id, nome')
      .eq('status', 'ativo')
      .order('nome');
    if (data) setAlunos(data);
  };

  const handleCheckinManual = async () => {
    if (!alunoSelecionado) return;

    const hoje = getHoje();
    const horario = new Date().toTimeString().slice(0, 8);

    // Verificar se já fez check-in hoje
    const { data: existing } = await supabase
      .from('checkins')
      .select('id')
      .eq('aluno_id', alunoSelecionado)
      .eq('data', hoje)
      .single();

    if (existing) {
      setCheckinManualMsg('⚠️ Este aluno já fez check-in hoje.');
      setTimeout(() => setCheckinManualMsg(''), 3000);
      return;
    }

    const { error } = await supabase.from('checkins').insert({
      aluno_id: alunoSelecionado,
      data: hoje,
      horario,
    });

    if (error) {
      setCheckinManualMsg('❌ Erro ao registrar check-in.');
    } else {
      const aluno = alunos.find(a => a.id === alunoSelecionado);
      setCheckinManualMsg(`✅ Check-in registrado para ${aluno?.nome}!`);
      setAlunoSelecionado('');
      setBuscaAluno('');
      loadCheckins();
    }
    setTimeout(() => setCheckinManualMsg(''), 3000);
  };

  const generateQrCode = async () => {
    // A URL do checkin aponta para a página pública de check-in
    const checkinUrl = `${window.location.origin}/checkin/`;
    setQrUrl(checkinUrl);

    // Salvar nas configurações
    await supabase
      .from('configuracoes')
      .update({ qrcode_checkin: checkinUrl })
      .not('id', 'is', null);
    
    setConfigQr(checkinUrl);
  };

  const qrImageUrl = qrUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrUrl)}`
    : '';

  return (
    <DashboardLayout activeMenu="checkin" title="Check-in por QR Code">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Coluna Esquerda: QR Code + Check-in Manual */}
        <div className="space-y-8">
          {/* QR Code */}
          <div className="card text-center">
            <h2 className="text-lg font-semibold text-dark-100 mb-4">QR Code da Academia</h2>
            <p className="text-sm text-dark-400 mb-6">
              Imprima este QR Code e coloque na recepção. Os alunos escanearão para marcar presença.
            </p>

            {qrUrl ? (
              <div className="space-y-4">
                <div className="inline-block p-4 bg-dark-800 border-2 border-dark-200 rounded-2xl">
                  <img
                    src={qrImageUrl}
                    alt="QR Code Check-in"
                    className="w-64 h-64 mx-auto"
                  />
                </div>
                <p className="text-xs text-dark-400 break-all">{qrUrl}</p>
                <div className="flex justify-center gap-3">
                  <a
                    href={qrImageUrl}
                    download="qrcode-checkin.png"
                    className="btn-primary"
                  >
                    📥 Baixar QR Code
                  </a>
                  <button onClick={generateQrCode} className="btn-secondary">
                    🔄 Regenerar
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-8">
                <span className="text-6xl block mb-4">📱</span>
                <button onClick={generateQrCode} className="btn-primary">
                  Gerar QR Code
                </button>
              </div>
            )}
          </div>

          {/* Check-in Manual */}
          <div className="card">
            <h2 className="text-lg font-semibold text-dark-100 mb-4">✋ Check-in Manual</h2>
            <p className="text-sm text-dark-400 mb-4">
              Digite o nome do aluno para registrar a presença manualmente.
            </p>

            <div className="space-y-3">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Digite o nome do aluno..."
                  value={buscaAluno}
                  onChange={(e) => { setBuscaAluno(e.target.value); setAlunoSelecionado(''); }}
                  className="input-field"
                />
                {buscaAluno.length >= 2 && !alunoSelecionado && (
                  <div className="absolute z-10 w-full mt-1 bg-dark-800 border border-dark-600 rounded-xl max-h-48 overflow-y-auto shadow-lg">
                    {alunos
                      .filter(a => a.nome.toLowerCase().includes(buscaAluno.toLowerCase()))
                      .length === 0 ? (
                        <div className="px-4 py-3 text-sm text-dark-400">Nenhum aluno encontrado.</div>
                      ) : (
                        alunos
                          .filter(a => a.nome.toLowerCase().includes(buscaAluno.toLowerCase()))
                          .map((aluno) => (
                            <button
                              key={aluno.id}
                              onClick={() => { setAlunoSelecionado(aluno.id); setBuscaAluno(aluno.nome); }}
                              className="w-full text-left px-4 py-3 text-sm text-dark-200 hover:bg-dark-700 transition-colors border-b border-dark-700 last:border-b-0"
                            >
                              {aluno.nome}
                            </button>
                          ))
                      )}
                  </div>
                )}
              </div>

              {alunoSelecionado && (
                <div className="flex items-center gap-2 p-2 bg-primary-900/20 border border-primary-800 rounded-lg">
                  <span className="text-sm text-primary-400">✓ Selecionado:</span>
                  <span className="text-sm font-medium text-dark-100">{buscaAluno}</span>
                  <button onClick={() => { setAlunoSelecionado(''); setBuscaAluno(''); }} className="ml-auto text-dark-400 hover:text-red-400 text-xs">✕</button>
                </div>
              )}

              <button
                onClick={handleCheckinManual}
                disabled={!alunoSelecionado}
                className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ✅ Confirmar Check-in
              </button>

              {checkinManualMsg && (
                <div className={`p-3 rounded-lg text-sm text-center font-medium ${
                  checkinManualMsg.includes('✅') ? 'bg-green-900/30 text-green-400' :
                  checkinManualMsg.includes('⚠️') ? 'bg-yellow-900/30 text-yellow-400' :
                  'bg-red-900/30 text-red-400'
                }`}>
                  {checkinManualMsg}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Coluna Direita: Check-ins de hoje */}
        <div className="card">
          <h2 className="text-lg font-semibold text-dark-100 mb-4">
            Check-ins de Hoje ({checkins.length})
          </h2>

          {loading ? (
            <p className="text-dark-400">Carregando...</p>
          ) : checkins.length === 0 ? (
            <div className="text-center py-8">
              <span className="text-4xl block mb-2">🏃</span>
              <p className="text-dark-400">Nenhum check-in hoje.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {checkins.map((checkin) => (
                <div
                  key={checkin.id}
                  className="flex items-center justify-between p-3 bg-dark-800 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                      <span className="text-xs font-medium text-primary-700">
                        {checkin.alunos?.nome?.charAt(0)}
                      </span>
                    </div>
                    <span className="font-medium text-dark-200">{checkin.alunos?.nome}</span>
                  </div>
                  <span className="text-sm text-dark-400">{checkin.horario?.slice(0, 5)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
