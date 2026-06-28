'use client';

import { useEffect, useState } from 'react';
import { supabase, Plano } from '@/lib/supabase';
import DashboardLayout from '@/components/DashboardLayout';

export default function PlanosPage() {
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Plano | null>(null);

  const [form, setForm] = useState({
    nome: '',
    valor: '',
    duracao_meses: '1',
    descricao: '',
    ativo: true,
  });

  useEffect(() => {
    loadPlanos();
  }, []);

  const loadPlanos = async () => {
    const { data } = await supabase.from('planos').select('*').order('valor');
    if (data) setPlanos(data);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      nome: form.nome,
      valor: parseFloat(form.valor),
      duracao_meses: parseInt(form.duracao_meses),
      descricao: form.descricao || null,
      ativo: form.ativo,
    };

    if (editing) {
      await supabase.from('planos').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('planos').insert(payload);
    }

    setShowModal(false);
    loadPlanos();
  };

  const handleEdit = (plano: Plano) => {
    setEditing(plano);
    setForm({
      nome: plano.nome,
      valor: String(plano.valor),
      duracao_meses: String(plano.duracao_meses),
      descricao: plano.descricao || '',
      ativo: plano.ativo,
    });
    setShowModal(true);
  };

  const handleNew = () => {
    setEditing(null);
    setForm({ nome: '', valor: '', duracao_meses: '1', descricao: '', ativo: true });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este plano?')) return;
    await supabase.from('planos').delete().eq('id', id);
    loadPlanos();
  };

  return (
    <DashboardLayout activeMenu="planos" title="Planos">
      <div className="mb-6 flex justify-between items-center">
        <p className="text-dark-400">Gerencie os planos disponíveis para matrícula.</p>
        <button onClick={handleNew} className="btn-primary">+ Novo Plano</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          [...Array(3)].map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-6 bg-dark-700 rounded w-2/3 mb-4"></div>
              <div className="h-8 bg-dark-700 rounded w-1/2"></div>
            </div>
          ))
        ) : planos.length === 0 ? (
          <div className="col-span-full card text-center py-12">
            <span className="text-4xl block mb-4">📋</span>
            <p className="text-dark-400">Nenhum plano cadastrado.</p>
          </div>
        ) : (
          planos.map((plano) => (
            <div key={plano.id} className={`card ${!plano.ativo ? 'opacity-60' : ''}`}>
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-semibold text-lg text-dark-100">{plano.nome}</h3>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${plano.ativo ? 'bg-green-100 text-green-700' : 'bg-dark-700 text-dark-400'}`}>
                  {plano.ativo ? 'Ativo' : 'Inativo'}
                </span>
              </div>

              <div className="mb-4">
                <span className="text-3xl font-bold text-primary-600">
                  R$ {Number(plano.valor).toFixed(2)}
                </span>
                <span className="text-dark-400 text-sm">
                  /{plano.duracao_meses === 1 ? 'mês' : `${plano.duracao_meses} meses`}
                </span>
              </div>

              {plano.descricao && (
                <p className="text-sm text-dark-400 mb-4">{plano.descricao}</p>
              )}

              <div className="flex gap-2 pt-4 border-t border-dark-700">
                <button onClick={() => handleEdit(plano)} className="text-primary-600 text-sm font-medium">
                  Editar
                </button>
                <button onClick={() => handleDelete(plano.id)} className="text-red-600 text-sm font-medium">
                  Excluir
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-2xl w-full max-w-md">
            <div className="p-6 border-b border-dark-700">
              <h2 className="text-xl font-semibold">{editing ? 'Editar Plano' : 'Novo Plano'}</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-1">Nome do Plano *</label>
                <input
                  type="text"
                  value={form.nome}
                  onChange={(e) => setForm({...form, nome: e.target.value})}
                  className="input-field"
                  placeholder="Ex: Mensal, Trimestral, Anual"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-1">Valor (R$) *</label>
                  <input
                    type="number"
                    value={form.valor}
                    onChange={(e) => setForm({...form, valor: e.target.value})}
                    className="input-field"
                    step="0.01"
                    min="0"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-1">Duração (meses) *</label>
                  <select
                    value={form.duracao_meses}
                    onChange={(e) => setForm({...form, duracao_meses: e.target.value})}
                    className="input-field"
                  >
                    <option value="1">1 mês</option>
                    <option value="3">3 meses</option>
                    <option value="6">6 meses</option>
                    <option value="12">12 meses</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-1">Descrição</label>
                <textarea
                  value={form.descricao}
                  onChange={(e) => setForm({...form, descricao: e.target.value})}
                  className="input-field"
                  rows={2}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="plano-ativo"
                  checked={form.ativo}
                  onChange={(e) => setForm({...form, ativo: e.target.checked})}
                  className="rounded"
                />
                <label htmlFor="plano-ativo" className="text-sm text-dark-200">Plano ativo</label>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" className="btn-primary">{editing ? 'Salvar' : 'Criar Plano'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
