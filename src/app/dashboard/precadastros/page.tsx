'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatDate } from '@/lib/utils';
import DashboardLayout from '@/components/DashboardLayout';

export default function PreCadastrosPage() {
  const [precadastros, setPrecadastros] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState('todos');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const { data } = await supabase.from('pre_cadastros').select('*').order('created_at', { ascending: false });
    if (data) setPrecadastros(data);
    setLoading(false);
  };

  const getStatusLabel = (status: string) => {
    if (status === 'importado') return 'cadastrado';
    return 'pendente';
  };

  const filteredPrecadastros = precadastros.filter(p => {
    if (filtroStatus === 'todos') return true;
    if (filtroStatus === 'pendente') return p.status !== 'importado';
    if (filtroStatus === 'cadastrado') return p.status === 'importado';
    return true;
  });

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este pré-cadastro?')) return;
    await supabase.from('pre_cadastros').delete().eq('id', id);
    loadData();
  };

  const exportToExcel = () => {
    if (precadastros.length === 0) return;
    const headers = ['Nome', 'E-mail', 'Telefone', 'CPF', 'Cidade', 'Dia Venc.', 'Observações', 'Data'];
    const rows = precadastros.map(p => [
      p.nome, p.email, p.telefone, p.cpf, p.cidade || '', p.dia_vencimento || '', p.observacoes || '', formatDate(p.created_at?.split('T')[0]),
    ]);
    const csv = [headers.join(';'), ...rows.map(r => r.map(v => `"${v}"`).join(';'))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `pre-cadastros.csv`;
    link.click();
  };

  return (
    <DashboardLayout activeMenu="precadastros" title="Pré-Cadastros">
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <p className="text-dark-400">Formulários preenchidos pelos alunos.</p>
          <p className="text-lg font-bold text-primary-400 mt-1">{precadastros.length} cadastro(s) recebido(s)</p>
        </div>
        <div className="flex gap-3">
          <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className="input-field w-44">
            <option value="todos">Todos</option>
            <option value="pendente">Pendentes</option>
            <option value="cadastrado">Cadastrados</option>
          </select>
          {precadastros.length > 0 && (
            <button onClick={exportToExcel} className="btn-secondary">📥 Exportar Excel</button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="card animate-pulse"><div className="h-20 bg-dark-700 rounded"></div></div>
        ) : precadastros.length === 0 ? (
          <div className="card text-center py-12"><p className="text-dark-400">Nenhum pré-cadastro recebido ainda.</p></div>
        ) : filteredPrecadastros.length === 0 ? (
          <div className="card text-center py-12"><p className="text-dark-400">Nenhum resultado para este filtro.</p></div>
        ) : (
          filteredPrecadastros.map((p) => (
            <div key={p.id} className="card">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-dark-100">{p.nome}</h3>
                  <p className="text-sm text-dark-400">{p.email} • {p.telefone}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-dark-400">{formatDate(p.created_at?.split('T')[0])}</span>
                  <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${p.status === 'importado' ? 'bg-green-900/30 text-green-400' : 'bg-yellow-900/30 text-yellow-400'}`}>{getStatusLabel(p.status)}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-xs text-dark-300">
                <p><strong>CPF:</strong> {p.cpf}</p>
                <p><strong>Nascimento:</strong> {p.data_nascimento ? formatDate(p.data_nascimento) : '—'}</p>
                <p><strong>Cidade:</strong> {p.cidade || '—'}</p>
                <p><strong>Dia Venc.:</strong> {p.dia_vencimento || '—'}</p>
              </div>
              {p.endereco && <p className="text-xs text-dark-400 mt-1"><strong>Endereço:</strong> {p.endereco}{p.bairro ? `, ${p.bairro}` : ''}{p.cep ? ` - ${p.cep}` : ''}</p>}
              {p.observacoes && <p className="text-xs text-dark-300 mt-2 bg-dark-700 p-2 rounded">{p.observacoes}</p>}
              <div className="flex gap-3 mt-3 pt-3 border-t border-dark-700">
                <button onClick={() => handleDelete(p.id)} className="text-red-400 text-sm font-medium">Excluir</button>
              </div>
            </div>
          ))
        )}
      </div>
    </DashboardLayout>
  );
}
