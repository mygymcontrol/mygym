'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import DashboardLayout from '@/components/DashboardLayout';

interface Notificacao {
  id: string;
  mensagem: string;
  tipo: string;
  status: string;
  enviada_em: string;
  alunos: { nome: string; telefone: string };
}

export default function WhatsAppPage() {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTipo, setFilterTipo] = useState('todos');

  useEffect(() => {
    loadNotificacoes();
  }, []);

  const loadNotificacoes = async () => {
    const { data } = await supabase
      .from('notificacoes_whatsapp')
      .select('*, alunos(nome, telefone)')
      .order('enviada_em', { ascending: false })
      .limit(100);
    
    if (data) setNotificacoes(data as any);
    setLoading(false);
  };

  const filteredNotificacoes = notificacoes.filter(n =>
    filterTipo === 'todos' || n.tipo === filterTipo
  );

  const tipoLabel: Record<string, string> = {
    cobranca: '💰 Cobrança',
    aviso: '📢 Aviso',
    lembrete: '🔔 Lembrete',
    geral: '💬 Geral',
  };

  return (
    <DashboardLayout activeMenu="whatsapp" title="WhatsApp - Histórico de Envios">
      <div className="mb-6">
        <p className="text-dark-400 mb-4">
          Histórico de mensagens enviadas via WhatsApp. Para enviar cobranças, acesse a aba{' '}
          <a href="/dashboard/mensalidades/" className="text-primary-600 font-medium">Mensalidades</a>.
        </p>

        <div className="flex gap-4">
          <select
            value={filterTipo}
            onChange={(e) => setFilterTipo(e.target.value)}
            className="input-field w-48"
          >
            <option value="todos">Todos os tipos</option>
            <option value="cobranca">Cobrança</option>
            <option value="aviso">Aviso</option>
            <option value="lembrete">Lembrete</option>
            <option value="geral">Geral</option>
          </select>
        </div>
      </div>

      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-dark-800">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-dark-400 uppercase">Aluno</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-dark-400 uppercase">Tipo</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-dark-400 uppercase">Mensagem</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-dark-400 uppercase">Enviada em</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-dark-400 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-100">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-dark-400">Carregando...</td></tr>
              ) : filteredNotificacoes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-dark-400">
                    <span className="text-4xl block mb-2">📲</span>
                    Nenhuma notificação enviada ainda.
                  </td>
                </tr>
              ) : (
                filteredNotificacoes.map((n) => (
                  <tr key={n.id} className="hover:bg-dark-800">
                    <td className="px-6 py-4">
                      <p className="font-medium text-dark-100">{n.alunos?.nome}</p>
                      <p className="text-xs text-dark-400">{n.alunos?.telefone}</p>
                    </td>
                    <td className="px-6 py-4 text-sm">{tipoLabel[n.tipo] || n.tipo}</td>
                    <td className="px-6 py-4 text-sm text-dark-200 max-w-xs truncate">{n.mensagem}</td>
                    <td className="px-6 py-4 text-sm text-dark-400">
                      {n.enviada_em ? new Date(n.enviada_em).toLocaleString('pt-BR') : '—'}
                    </td>
                    <td className="px-6 py-4">
                      <span className="badge-pago">Enviada</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
