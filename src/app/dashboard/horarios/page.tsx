'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import DashboardLayout from '@/components/DashboardLayout';

interface HorarioFull {
  id: string;
  dia_semana: number;
  horario_inicio: string;
  horario_fim: string;
  capacidade: number;
  modalidades: { nome: string };
}

const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export default function HorariosPage() {
  const [horarios, setHorarios] = useState<HorarioFull[]>([]);
  const [modalidades, setModalidades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [form, setForm] = useState({
    modalidade_id: '',
    dia_semana: '1',
    horario_inicio: '06:00',
    horario_fim: '07:00',
    capacidade: '30',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [{ data: h }, { data: m }] = await Promise.all([
      supabase.from('horarios_aulas').select('*, modalidades(nome)').order('dia_semana').order('horario_inicio'),
      supabase.from('modalidades').select('id, nome').eq('ativo', true).order('nome'),
    ]);
    if (h) setHorarios(h as any);
    if (m) setModalidades(m);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await supabase.from('horarios_aulas').insert({
      modalidade_id: form.modalidade_id,
      dia_semana: parseInt(form.dia_semana),
      horario_inicio: form.horario_inicio,
      horario_fim: form.horario_fim,
      capacidade: parseInt(form.capacidade),
    });
    setShowModal(false);
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover este horário?')) return;
    await supabase.from('horarios_aulas').delete().eq('id', id);
    loadData();
  };

  // Agrupar por dia da semana
  const horariosPorDia = diasSemana.map((dia, index) => ({
    dia,
    index,
    aulas: horarios.filter(h => h.dia_semana === index),
  })).filter(d => d.aulas.length > 0);

  return (
    <DashboardLayout activeMenu="horarios" title="Grade de Horários">
      <div className="mb-6 flex justify-between items-center">
        <p className="text-dark-400">Configure a grade semanal de aulas.</p>
        <button onClick={() => setShowModal(true)} className="btn-primary">+ Novo Horário</button>
      </div>

      {loading ? (
        <div className="card animate-pulse"><div className="h-40 bg-dark-700 rounded"></div></div>
      ) : horariosPorDia.length === 0 ? (
        <div className="card text-center py-12">
          <span className="text-4xl block mb-4">🕐</span>
          <p className="text-dark-400">Nenhum horário cadastrado.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {horariosPorDia.map(({ dia, aulas }) => (
            <div key={dia} className="card">
              <h3 className="font-semibold text-dark-100 mb-3">{dia}</h3>
              <div className="space-y-2">
                {aulas.map(aula => (
                  <div key={aula.id} className="flex items-center justify-between p-3 bg-dark-800 rounded-lg">
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-mono text-dark-200">
                        {aula.horario_inicio?.slice(0, 5)} - {aula.horario_fim?.slice(0, 5)}
                      </span>
                      <span className="font-medium text-dark-100">{aula.modalidades?.nome}</span>
                      <span className="text-xs text-dark-400">({aula.capacidade} vagas)</span>
                    </div>
                    <button onClick={() => handleDelete(aula.id)} className="text-red-500 text-sm">✕</button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-2xl w-full max-w-md">
            <div className="p-6 border-b border-dark-700">
              <h2 className="text-xl font-semibold">Novo Horário</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-1">Modalidade *</label>
                <select value={form.modalidade_id} onChange={(e) => setForm({...form, modalidade_id: e.target.value})} className="input-field" required>
                  <option value="">Selecione</option>
                  {modalidades.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-1">Dia da Semana *</label>
                <select value={form.dia_semana} onChange={(e) => setForm({...form, dia_semana: e.target.value})} className="input-field">
                  {diasSemana.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-1">Início</label>
                  <input type="time" value={form.horario_inicio} onChange={(e) => setForm({...form, horario_inicio: e.target.value})} className="input-field" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-1">Fim</label>
                  <input type="time" value={form.horario_fim} onChange={(e) => setForm({...form, horario_fim: e.target.value})} className="input-field" required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-1">Capacidade</label>
                <input type="number" value={form.capacidade} onChange={(e) => setForm({...form, capacidade: e.target.value})} className="input-field" min="1" />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" className="btn-primary">Adicionar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
