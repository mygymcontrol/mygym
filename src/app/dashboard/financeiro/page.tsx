'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatDate, formatMoney, getMesAtual, getHoje } from '@/lib/utils';
import DashboardLayout from '@/components/DashboardLayout';

interface Movimentacao {
  id: string;
  tipo: 'entrada' | 'saida';
  valor: number;
  data: string;
  categoria: string;
  descricao: string;
  registrado_por: string;
  created_at: string;
}

const CATEGORIAS = [
  'Mensalidade',
  'Material',
  'Manutenção',
  'Salário',
  'Água/Luz',
  'Aluguel',
  'Outros',
];

export default function FinanceiroPage() {
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
  const [receitaMensalidades, setReceitaMensalidades] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filterMes, setFilterMes] = useState(getMesAtual());
  const [filterTipo, setFilterTipo] = useState('todos');
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    tipo: 'entrada' as 'entrada' | 'saida',
    data: getHoje(),
    valor: '',
    categoria: 'Mensalidade',
    descricao: '',
  });

  useEffect(() => {
    loadMovimentacoes();
  }, [filterMes, filterTipo]);

  const loadMovimentacoes = async () => {
    setLoading(true);
    const academiaId = localStorage.getItem('academia_id');
    if (!academiaId) { setLoading(false); return; }

    const [ano, mes] = filterMes.split('-');
    const startDate = `${ano}-${mes}-01`;
    const endDate = `${ano}-${mes}-${new Date(Number(ano), Number(mes), 0).getDate()}`;

    let query = supabase
      .from('financeiro')
      .select('*')
      .eq('academia_id', academiaId)
      .gte('data', startDate)
      .lte('data', endDate)
      .order('data', { ascending: false });

    if (filterTipo !== 'todos') {
      query = query.eq('tipo', filterTipo);
    }

    const { data } = await query;
    if (data) setMovimentacoes(data);

    // Buscar receita de mensalidades pagas no período
    const { data: mensPagas } = await supabase
      .from('mensalidades')
      .select('valor')
      .eq('status', 'pago')
      .gte('data_pagamento', startDate)
      .lte('data_pagamento', endDate);
    const totalMens = (mensPagas || []).reduce((sum, m) => sum + Number(m.valor), 0);
    setReceitaMensalidades(totalMens);

    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.valor || Number(form.valor) <= 0) {
      alert('Informe um valor válido.');
      return;
    }

    setSaving(true);
    const academiaId = localStorage.getItem('academia_id');
    const userName = localStorage.getItem('user_name') || 'Admin';

    const { error } = await supabase.from('financeiro').insert({
      academia_id: academiaId,
      tipo: form.tipo,
      valor: Number(form.valor),
      data: form.data,
      categoria: form.categoria,
      descricao: form.descricao,
      registrado_por: userName,
    });

    if (error) {
      alert('Erro ao salvar: ' + error.message);
    } else {
      setShowModal(false);
      setForm({ tipo: 'entrada', data: getHoje(), valor: '', categoria: 'Mensalidade', descricao: '' });
      loadMovimentacoes();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja excluir esta movimentação?')) return;
    await supabase.from('financeiro').delete().eq('id', id);
    loadMovimentacoes();
  };

  // Cálculos do resumo
  const totalEntradas = movimentacoes
    .filter((m) => m.tipo === 'entrada')
    .reduce((acc, m) => acc + Number(m.valor), 0);

  const totalSaidas = movimentacoes
    .filter((m) => m.tipo === 'saida')
    .reduce((acc, m) => acc + Number(m.valor), 0);

  const receitaTotal = receitaMensalidades + totalEntradas;
  const saldo = receitaTotal - totalSaidas;

  return (
    <DashboardLayout activeMenu="financeiro" title="Financeiro">
      {/* Cards Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="card p-4 border-l-4 border-green-500">
          <p className="text-sm text-dark-400">Receita Mensalidades</p>
          <p className="text-xl font-bold text-green-400">{formatMoney(receitaMensalidades)}</p>
        </div>
        <div className="card p-4 border-l-4 border-emerald-500">
          <p className="text-sm text-dark-400">Entradas Manuais</p>
          <p className="text-xl font-bold text-emerald-400">{formatMoney(totalEntradas)}</p>
        </div>
        <div className="card p-4 border-l-4 border-red-500">
          <p className="text-sm text-dark-400">Saídas</p>
          <p className="text-xl font-bold text-red-400">{formatMoney(totalSaidas)}</p>
        </div>
        <div className="card p-4 border-l-4 border-blue-500">
          <p className="text-sm text-dark-400">Saldo Total</p>
          <p className={`text-xl font-bold ${saldo >= 0 ? 'text-blue-400' : 'text-red-400'}`}>{formatMoney(saldo)}</p>
        </div>
      </div>

      {/* Filtros + Botão */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div>
          <label className="block text-xs text-dark-400 mb-1">Mês/Ano</label>
          <input
            type="month"
            value={filterMes}
            onChange={(e) => setFilterMes(e.target.value)}
            className="input-field w-full sm:w-48"
          />
        </div>
        <div>
          <label className="block text-xs text-dark-400 mb-1">Tipo</label>
          <select
            value={filterTipo}
            onChange={(e) => setFilterTipo(e.target.value)}
            className="input-field w-full sm:w-40"
          >
            <option value="todos">Todos</option>
            <option value="entrada">Entradas</option>
            <option value="saida">Saídas</option>
          </select>
        </div>
        <div className="ml-auto flex items-end">
          <button onClick={() => setShowModal(true)} className="btn-primary">
            + Nova Movimentação
          </button>
        </div>
      </div>

      {/* Tabela */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-dark-800">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-dark-400 uppercase">Data</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-dark-400 uppercase">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-dark-400 uppercase">Categoria</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-dark-400 uppercase">Descrição</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-dark-400 uppercase">Valor</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-dark-400 uppercase">Registrado por</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-dark-400 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-100">
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-dark-400">Carregando...</td></tr>
              ) : movimentacoes.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-dark-400">Nenhuma movimentação encontrada</td></tr>
              ) : (
                movimentacoes.map((m) => (
                  <tr key={m.id} className="hover:bg-dark-800">
                    <td className="px-4 py-3 text-dark-200">{formatDate(m.data)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${m.tipo === 'entrada' ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'}`}>
                        {m.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-dark-200">{m.categoria}</td>
                    <td className="px-4 py-3 text-dark-200">{m.descricao || '—'}</td>
                    <td className={`px-4 py-3 font-medium ${m.tipo === 'entrada' ? 'text-green-400' : 'text-red-400'}`}>
                      {m.tipo === 'entrada' ? '+' : '-'} {formatMoney(m.valor)}
                    </td>
                    <td className="px-4 py-3 text-dark-400 text-sm">{m.registrado_por}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(m.id)}
                        className="text-red-400 hover:text-red-300 text-sm font-medium"
                      >
                        🗑️ Excluir
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Nova Movimentação */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-2xl w-full max-w-md">
            <div className="p-6 border-b border-dark-700">
              <h2 className="text-xl font-semibold text-dark-100">Nova Movimentação</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-1">Tipo</label>
                <select
                  value={form.tipo}
                  onChange={(e) => setForm({ ...form, tipo: e.target.value as 'entrada' | 'saida' })}
                  className="input-field w-full"
                >
                  <option value="entrada">Entrada</option>
                  <option value="saida">Saída</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-200 mb-1">Data</label>
                <input
                  type="date"
                  value={form.data}
                  onChange={(e) => setForm({ ...form, data: e.target.value })}
                  className="input-field w-full"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-200 mb-1">Valor (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.valor}
                  onChange={(e) => setForm({ ...form, valor: e.target.value })}
                  className="input-field w-full"
                  placeholder="0,00"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-200 mb-1">Categoria</label>
                <select
                  value={form.categoria}
                  onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                  className="input-field w-full"
                >
                  {CATEGORIAS.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-200 mb-1">Descrição</label>
                <input
                  type="text"
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  className="input-field w-full"
                  placeholder="Descrição da movimentação"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
