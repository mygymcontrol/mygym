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

  useEffect(() => {
    loadCheckins();
    loadQrConfig();
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

        {/* Check-ins de hoje */}
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
