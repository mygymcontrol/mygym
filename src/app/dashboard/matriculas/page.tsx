'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import DashboardLayout from '@/components/DashboardLayout';

interface MatriculaFull {
  id: string;
  data_inicio: string;
  data_fim: string;
  valor_final: number;
  status: string;
  alunos: { id: string; nome: string; convenio_id: string | null };
  planos: { nome: string; valor: number; duracao_meses: number };
}

export default function MatriculasPage() {
  const [matriculas, setMatriculas] = useState<MatriculaFull[]>([]);
  const [alunos, setAlunos] = useState<any[]>([]);
  const [planos, setPlanos] = useState<any[]>([]);
  const [convenios, setConvenios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [form, setForm] = useState({
    aluno_id: '',
    plano_id: '',
    data_inicio: new Date().toISOString().split('T')[0],
  });

  const [valorCalculado, setValorCalculado] = useState<number | null>(null);
  const [descontoInfo, setDescontoInfo] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    calcularValor();
  }, [form.aluno_id, form.plano_id]);

  const loadData = async () => {
    const [{ data: mat }, { data: al }, { data: pl }, { data: conv }] = await Promise.all([
      supabase.from('matriculas').select('*, alunos(id, nome, convenio_id), planos(nome, valor, duracao_meses)').order('created_at', { ascending: false }),
      supabase.from('alunos').select('id, nome, convenio_id').eq('status', 'ativo').order('nome'),
      supabase.from('planos').select('*').eq('ativo', true).order('nome'),
      supabase.from('convenios').select('*').eq('ativo', true),
    ]);

    if (mat) setMatriculas(mat as any);
    if (al) setAlunos(al);
    if (pl) setPlanos(pl);
    if (conv) setConvenios(conv);
    setLoading(false);
  };

  const calcularValor = () => {
    if (!form.aluno_id || !form.plano_id) {
      setValorCalculado(null);
      setDescontoInfo('');
      return;
    }

    const aluno = alunos.find(a => a.id === form.aluno_id);
    const plano = planos.find(p => p.id === form.plano_id);

    if (!aluno || !plano) return;

    let valor = Number(plano.valor);
    let info = '';

    if (aluno.convenio_id) {
      const convenio = convenios.find(c => c.id === aluno.convenio_id);
      if (convenio) {
        const desconto = valor * (convenio.desconto_percentual / 100);
        valor = valor - desconto;
        info = `${convenio.nome}: -${convenio.desconto_percentual}% (R$ ${desconto.toFixed(2)} de desconto)`;
      }
    }

    setValorCalculado(valor);
    setDescontoInfo(info);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valorCalculado) return;

    const plano = planos.find(p => p.id === form.plano_id);
    const dataInicio = new Date(form.data_inicio);
    const dataFim = new Date(dataInicio);
    dataFim.setMonth(dataFim.getMonth() + plano.duracao_meses);

    // Criar matrícula
    const { data: matricula, error } = await supabase
      .from('matriculas')
      .insert({
        aluno_id: form.aluno_id,
        plano_id: form.plano_id,
        data_inicio: form.data_inicio,
        data_fim: dataFim.toISOString().split('T')[0],
        valor_final: valorCalculado,
        status: 'ativa',
      })
      .select()
      .single();

    if (error || !matricula) {
      alert('Erro ao criar matrícula');
      return;
    }

    // Gerar mensalidades automaticamente
    const mensalidades = [];
    for (let i = 0; i < plano.duracao_meses; i++) {
      const vencimento = new Date(dataInicio);
      vencimento.setMonth(vencimento.getMonth() + i);
      // Vencimento no dia 10 de cada mês
      vencimento.setDate(10);

      mensalidades.push({
        matricula_id: matricula.id,
        aluno_id: form.aluno_id,
        valor: valorCalculado / plano.duracao_meses,
        data_vencimento: vencimento.toISOString().split('T')[0],
        status: 'pendente',
      });
    }

    await supabase.from('mensalidades').insert(mensalidades);

    setShowModal(false);
    loadData();
    alert(`Matrícula criada! ${mensalidades.length} mensalidade(s) gerada(s).`);
  };

  const cancelarMatricula = async (id: string) => {
    if (!confirm('Cancelar esta matrícula?')) return;
    await supabase.from('matriculas').update({ status: 'cancelada' }).eq('id', id);
    loadData();
  };

  return (
    <DashboardLayout activeMenu="matriculas" title="Matrículas">
      <div className="mb-6 flex justify-between items-center">
        <p className="text-dark-400">Vincule alunos aos planos e gere mensalidades automaticamente.</p>
        <button onClick={() => { setShowModal(true); setForm({ aluno_id: '', plano_id: '', data_inicio: new Date().toISOString().split('T')[0] }); }} className="btn-primary">
          + Nova Matrícula
        </button>
      </div>

      {/* Tabela */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-dark-800">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-dark-400 uppercase">Aluno</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-dark-400 uppercase">Plano</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-dark-400 uppercase">Período</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-dark-400 uppercase">Valor</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-dark-400 uppercase">Status</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-dark-400 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-100">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-dark-400">Carregando...</td></tr>
              ) : matriculas.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-dark-400">Nenhuma matrícula cadastrada</td></tr>
              ) : (
                matriculas.map((m) => (
                  <tr key={m.id} className="hover:bg-dark-800">
                    <td className="px-6 py-4 font-medium">{m.alunos?.nome}</td>
                    <td className="px-6 py-4">{m.planos?.nome}</td>
                    <td className="px-6 py-4 text-sm text-dark-400">
                      {new Date(m.data_inicio).toLocaleDateString('pt-BR')} → {new Date(m.data_fim).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 font-medium">R$ {Number(m.valor_final).toFixed(2)}</td>
                    <td className="px-6 py-4">
                      <span className={`badge-${m.status === 'ativa' ? 'ativo' : m.status === 'cancelada' ? 'inadimplente' : 'suspenso'}`}>
                        {m.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {m.status === 'ativa' && (
                        <button onClick={() => cancelarMatricula(m.id)} className="text-red-600 text-sm font-medium">
                          Cancelar
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Nova Matrícula */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-2xl w-full max-w-md">
            <div className="p-6 border-b border-dark-700">
              <h2 className="text-xl font-semibold">Nova Matrícula</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-1">Aluno *</label>
                <select
                  value={form.aluno_id}
                  onChange={(e) => setForm({...form, aluno_id: e.target.value})}
                  className="input-field"
                  required
                >
                  <option value="">Selecione o aluno</option>
                  {alunos.map(a => (
                    <option key={a.id} value={a.id}>{a.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-200 mb-1">Plano *</label>
                <select
                  value={form.plano_id}
                  onChange={(e) => setForm({...form, plano_id: e.target.value})}
                  className="input-field"
                  required
                >
                  <option value="">Selecione o plano</option>
                  {planos.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.nome} - R$ {Number(p.valor).toFixed(2)} ({p.duracao_meses} {p.duracao_meses === 1 ? 'mês' : 'meses'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-200 mb-1">Data de Início</label>
                <input
                  type="date"
                  value={form.data_inicio}
                  onChange={(e) => setForm({...form, data_inicio: e.target.value})}
                  className="input-field"
                  required
                />
              </div>

              {/* Resumo do valor */}
              {valorCalculado !== null && (
                <div className="bg-primary-50 rounded-xl p-4">
                  <p className="text-sm font-medium text-primary-800">Valor Final:</p>
                  <p className="text-2xl font-bold text-primary-700">R$ {valorCalculado.toFixed(2)}</p>
                  {descontoInfo && (
                    <p className="text-sm text-primary-600 mt-1">🤝 {descontoInfo}</p>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" className="btn-primary">Criar Matrícula</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
