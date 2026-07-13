'use client';

import { useEffect, useState } from 'react';
import { supabase, Convenio } from '@/lib/supabase';
import DashboardLayout from '@/components/DashboardLayout';

export default function ConveniosPage() {
  const [convenios, setConvenios] = useState<Convenio[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Convenio | null>(null);

  const [form, setForm] = useState({
    nome: '',
    desconto_percentual: '',
    valor_checkin: '',
    descricao: '',
    ativo: true,
  });

  useEffect(() => {
    loadConvenios();
  }, []);

  const loadConvenios = async () => {
    const { data } = await supabase
      .from('convenios')
      .select('*')
      .order('nome');
    
    if (data) setConvenios(data);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      nome: form.nome,
      desconto_percentual: parseFloat(form.desconto_percentual) || 0,
      valor_checkin: parseFloat(form.valor_checkin) || 0,
      descricao: form.descricao || null,
      ativo: form.ativo,
    };

    if (editing) {
      await supabase.from('convenios').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('convenios').insert(payload);
    }

    setShowModal(false);
    loadConvenios();
  };

  const handleEdit = (convenio: Convenio) => {
    setEditing(convenio);
    setForm({
      nome: convenio.nome,
      desconto_percentual: String(convenio.desconto_percentual),
      valor_checkin: String(convenio.valor_checkin || ''),
      descricao: convenio.descricao || '',
      ativo: convenio.ativo,
    });
    setShowModal(true);
  };

  const handleNew = () => {
    setEditing(null);
    setForm({ nome: '', desconto_percentual: '', valor_checkin: '', descricao: '', ativo: true });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este convênio?')) return;
    await supabase.from('convenios').delete().eq('id', id);
    loadConvenios();
  };

  const toggleAtivo = async (convenio: Convenio) => {
    await supabase
      .from('convenios')
      .update({ ativo: !convenio.ativo })
      .eq('id', convenio.id);
    loadConvenios();
  };

  return (
    <DashboardLayout activeMenu="convenios" title="Convênios e Parcerias">
      <div className="mb-6 flex justify-between items-center">
        <p className="text-dark-400">
          Gerencie convênios e parceiros que oferecem desconto na mensalidade dos alunos.
        </p>
        <button onClick={handleNew} className="btn-primary">
          + Novo Convênio
        </button>
      </div>

      {/* Lista de convênios */}
      <div className="grid gap-4">
        {loading ? (
          <div className="card animate-pulse">
            <div className="h-6 bg-dark-700 rounded w-1/3 mb-2"></div>
            <div className="h-4 bg-dark-700 rounded w-1/2"></div>
          </div>
        ) : convenios.length === 0 ? (
          <div className="card text-center py-12">
            <img src="/icons/convenios.jpg" alt="" className="w-12 h-12 mx-auto mb-4 rounded" />
            <p className="text-dark-400">Nenhum convênio cadastrado.</p>
            <p className="text-dark-400 text-sm mt-1">
              Crie convênios como Gympass, TotalPass, ou parcerias com empresas.
            </p>
          </div>
        ) : (
          convenios.map((convenio) => (
            <div key={convenio.id} className={`card flex items-center justify-between ${!convenio.ativo ? 'opacity-60' : ''}`}>
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${convenio.ativo ? 'bg-blue-100' : 'bg-dark-700'}`}>
                  <img src="/icons/convenios.jpg" alt="" className="w-8 h-8 rounded" />
                </div>
                <div>
                  <h3 className="font-semibold text-dark-100">{convenio.nome}</h3>
                  {convenio.descricao && (
                    <p className="text-sm text-dark-400">{convenio.descricao}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  {convenio.desconto_percentual > 0 && (
                    <>
                      <span className="text-2xl font-bold text-primary-600">
                        {convenio.desconto_percentual}%
                      </span>
                      <p className="text-xs text-dark-400">de desconto</p>
                    </>
                  )}
                  {(convenio.valor_checkin ?? 0) > 0 && (
                    <>
                      <span className="text-2xl font-bold text-emerald-500">
                        R$ {Number(convenio.valor_checkin).toFixed(2)}
                      </span>
                      <p className="text-xs text-dark-400">por check-in</p>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleAtivo(convenio)}
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      convenio.ativo
                        ? 'bg-green-100 text-green-700'
                        : 'bg-dark-700 text-dark-400'
                    }`}
                  >
                    {convenio.ativo ? 'Ativo' : 'Inativo'}
                  </button>
                  <button
                    onClick={() => handleEdit(convenio)}
                    className="text-primary-600 hover:text-primary-700 text-sm"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(convenio.id)}
                    className="text-red-600 hover:text-red-700 text-sm"
                  >
                    Excluir
                  </button>
                </div>
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
              <h2 className="text-xl font-semibold">
                {editing ? 'Editar Convênio' : 'Novo Convênio'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-1">
                  Nome do Convênio *
                </label>
                <input
                  type="text"
                  value={form.nome}
                  onChange={(e) => setForm({...form, nome: e.target.value})}
                  className="input-field"
                  placeholder="Ex: Gympass, TotalPass, Empresa XYZ"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-200 mb-1">
                  Percentual de Desconto (%)
                </label>
                <input
                  type="number"
                  value={form.desconto_percentual}
                  onChange={(e) => setForm({...form, desconto_percentual: e.target.value})}
                  className="input-field"
                  placeholder="Ex: 30"
                  min="0"
                  max="100"
                  step="0.01"
                />
                <p className="text-xs text-dark-400 mt-1">
                  Este desconto será aplicado automaticamente na mensalidade dos alunos vinculados.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-200 mb-1">
                  Valor por Check-in (R$)
                </label>
                <input
                  type="number"
                  value={form.valor_checkin}
                  onChange={(e) => setForm({...form, valor_checkin: e.target.value})}
                  className="input-field"
                  placeholder="Ex: 6.15"
                  min="0"
                  step="0.01"
                />
                <p className="text-xs text-dark-400 mt-1">
                  Cada check-in do aluno abate este valor da mensalidade (ex: Gympass).
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-200 mb-1">Descrição</label>
                <textarea
                  value={form.descricao}
                  onChange={(e) => setForm({...form, descricao: e.target.value})}
                  className="input-field"
                  rows={2}
                  placeholder="Descrição opcional do convênio"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="ativo"
                  checked={form.ativo}
                  onChange={(e) => setForm({...form, ativo: e.target.checked})}
                  className="rounded"
                />
                <label htmlFor="ativo" className="text-sm text-dark-200">Convênio ativo</label>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  {editing ? 'Salvar' : 'Criar Convênio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
