'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import DashboardLayout from '@/components/DashboardLayout';

interface Avaliacao {
  id: string;
  aluno_id: string;
  data_avaliacao: string;
  peso: number;
  altura: number;
  imc: number;
  gordura_corporal?: number;
  massa_muscular?: number;
  braco_esq?: number;
  braco_dir?: number;
  peitoral?: number;
  cintura?: number;
  quadril?: number;
  coxa_esq?: number;
  coxa_dir?: number;
  panturrilha?: number;
  observacoes?: string;
  alunos?: { nome: string };
}

export default function AvaliacoesPage() {
  const [alunos, setAlunos] = useState<any[]>([]);
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showHistorico, setShowHistorico] = useState(false);
  const [historicoAluno, setHistoricoAluno] = useState<Avaliacao[]>([]);
  const [historicoNome, setHistoricoNome] = useState('');
  const [selectedAluno, setSelectedAluno] = useState('');

  const [form, setForm] = useState({
    aluno_id: '',
    data_avaliacao: new Date().toISOString().split('T')[0],
    peso: '',
    altura: '',
    gordura_corporal: '',
    massa_muscular: '',
    braco_esq: '',
    braco_dir: '',
    peitoral: '',
    cintura: '',
    quadril: '',
    coxa_esq: '',
    coxa_dir: '',
    panturrilha: '',
    observacoes: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [{ data: al }, { data: av }] = await Promise.all([
      supabase.from('alunos').select('id, nome').eq('status', 'ativo').order('nome'),
      supabase.from('avaliacoes_fisicas').select('*, alunos(nome)').order('data_avaliacao', { ascending: false }).limit(50),
    ]);
    if (al) setAlunos(al);
    if (av) setAvaliacoes(av as any);
    setLoading(false);
  };

  const calcIMC = (peso: string, altura: string) => {
    const p = parseFloat(peso);
    const a = parseFloat(altura);
    if (p > 0 && a > 0) return (p / (a * a)).toFixed(1);
    return '—';
  };

  const getIMCClassificacao = (imc: number) => {
    if (imc < 18.5) return { label: 'Abaixo do peso', color: 'text-blue-600' };
    if (imc < 25) return { label: 'Peso normal', color: 'text-green-600' };
    if (imc < 30) return { label: 'Sobrepeso', color: 'text-yellow-600' };
    if (imc < 35) return { label: 'Obesidade I', color: 'text-orange-600' };
    return { label: 'Obesidade II+', color: 'text-red-600' };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const peso = parseFloat(form.peso);
    const altura = parseFloat(form.altura);
    const imc = peso > 0 && altura > 0 ? peso / (altura * altura) : null;

    const payload: any = {
      aluno_id: form.aluno_id,
      data_avaliacao: form.data_avaliacao,
      peso: peso || null,
      altura: altura || null,
      imc: imc ? parseFloat(imc.toFixed(2)) : null,
      gordura_corporal: form.gordura_corporal ? parseFloat(form.gordura_corporal) : null,
      massa_muscular: form.massa_muscular ? parseFloat(form.massa_muscular) : null,
      braco_esq: form.braco_esq ? parseFloat(form.braco_esq) : null,
      braco_dir: form.braco_dir ? parseFloat(form.braco_dir) : null,
      peitoral: form.peitoral ? parseFloat(form.peitoral) : null,
      cintura: form.cintura ? parseFloat(form.cintura) : null,
      quadril: form.quadril ? parseFloat(form.quadril) : null,
      coxa_esq: form.coxa_esq ? parseFloat(form.coxa_esq) : null,
      coxa_dir: form.coxa_dir ? parseFloat(form.coxa_dir) : null,
      panturrilha: form.panturrilha ? parseFloat(form.panturrilha) : null,
      observacoes: form.observacoes || null,
    };

    const { error } = await supabase.from('avaliacoes_fisicas').insert(payload);
    if (error) { alert('Erro: ' + error.message); return; }

    setShowModal(false);
    loadData();
  };

  const openHistorico = async (alunoId: string, nome: string) => {
    setHistoricoNome(nome);
    const { data } = await supabase
      .from('avaliacoes_fisicas')
      .select('*')
      .eq('aluno_id', alunoId)
      .order('data_avaliacao', { ascending: true });
    setHistoricoAluno(data || []);
    setShowHistorico(true);
  };

  const handleNew = () => {
    setForm({
      aluno_id: '', data_avaliacao: new Date().toISOString().split('T')[0],
      peso: '', altura: '', gordura_corporal: '', massa_muscular: '',
      braco_esq: '', braco_dir: '', peitoral: '', cintura: '',
      quadril: '', coxa_esq: '', coxa_dir: '', panturrilha: '', observacoes: '',
    });
    setShowModal(true);
  };

  const getDiff = (atual: number | undefined, anterior: number | undefined) => {
    if (!atual || !anterior) return null;
    const diff = atual - anterior;
    if (diff === 0) return <span className="text-dark-400">—</span>;
    return (
      <span className={diff > 0 ? 'text-red-500' : 'text-green-500'}>
        {diff > 0 ? '↑' : '↓'} {Math.abs(diff).toFixed(1)}
      </span>
    );
  };

  return (
    <DashboardLayout activeMenu="avaliacoes" title="Avaliações Físicas">
      <div className="mb-6 flex justify-between items-center">
        <p className="text-dark-400">Registre e acompanhe a evolução física dos alunos.</p>
        <button onClick={handleNew} className="btn-primary">+ Nova Avaliação</button>
      </div>

      {/* Últimas avaliações */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-dark-800">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-dark-400 uppercase">Aluno</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-dark-400 uppercase">Data</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-dark-400 uppercase">Peso</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-dark-400 uppercase">Altura</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-dark-400 uppercase">IMC</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-dark-400 uppercase">% Gordura</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-dark-400 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-100">
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-dark-400">Carregando...</td></tr>
              ) : avaliacoes.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-dark-400">Nenhuma avaliação registrada.</td></tr>
              ) : (
                avaliacoes.map((av) => {
                  const imcClass = av.imc ? getIMCClassificacao(av.imc) : null;
                  return (
                    <tr key={av.id} className="hover:bg-dark-800">
                      <td className="px-6 py-4 font-medium">{av.alunos?.nome}</td>
                      <td className="px-6 py-4 text-dark-200">{new Date(av.data_avaliacao).toLocaleDateString('pt-BR')}</td>
                      <td className="px-6 py-4">{av.peso ? `${av.peso} kg` : '—'}</td>
                      <td className="px-6 py-4">{av.altura ? `${av.altura} m` : '—'}</td>
                      <td className="px-6 py-4">
                        {av.imc ? (
                          <span className={imcClass?.color}>{av.imc} <span className="text-xs">({imcClass?.label})</span></span>
                        ) : '—'}
                      </td>
                      <td className="px-6 py-4">{av.gordura_corporal ? `${av.gordura_corporal}%` : '—'}</td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => openHistorico(av.aluno_id, av.alunos?.nome || '')} className="text-primary-600 text-sm font-medium">
                          📈 Evolução
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Nova Avaliação */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-dark-700">
              <h2 className="text-xl font-semibold">Nova Avaliação Física</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-1">Aluno *</label>
                  <select value={form.aluno_id} onChange={(e) => setForm({...form, aluno_id: e.target.value})} className="input-field" required>
                    <option value="">Selecione</option>
                    {alunos.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-1">Data</label>
                  <input type="date" value={form.data_avaliacao} onChange={(e) => setForm({...form, data_avaliacao: e.target.value})} className="input-field" />
                </div>
              </div>

              {/* Composição corporal */}
              <h3 className="font-medium text-dark-200 pt-2">Composição Corporal</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-dark-400 mb-1">Peso (kg)</label>
                  <input type="number" step="0.1" value={form.peso} onChange={(e) => setForm({...form, peso: e.target.value})} className="input-field" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-dark-400 mb-1">Altura (m)</label>
                  <input type="number" step="0.01" value={form.altura} onChange={(e) => setForm({...form, altura: e.target.value})} className="input-field" placeholder="1.75" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-dark-400 mb-1">% Gordura</label>
                  <input type="number" step="0.1" value={form.gordura_corporal} onChange={(e) => setForm({...form, gordura_corporal: e.target.value})} className="input-field" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-dark-400 mb-1">Massa Muscular (kg)</label>
                  <input type="number" step="0.1" value={form.massa_muscular} onChange={(e) => setForm({...form, massa_muscular: e.target.value})} className="input-field" />
                </div>
              </div>

              {/* IMC calculado */}
              {form.peso && form.altura && (
                <div className="bg-primary-50 rounded-lg p-3">
                  <p className="text-sm text-primary-700">
                    <strong>IMC calculado:</strong> {calcIMC(form.peso, form.altura)}
                    {parseFloat(calcIMC(form.peso, form.altura) || '0') > 0 && (
                      <span className="ml-2 text-xs">({getIMCClassificacao(parseFloat(calcIMC(form.peso, form.altura) || '0')).label})</span>
                    )}
                  </p>
                </div>
              )}

              {/* Medidas */}
              <h3 className="font-medium text-dark-200 pt-2">Medidas (cm)</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-dark-400 mb-1">Braço Esq.</label>
                  <input type="number" step="0.1" value={form.braco_esq} onChange={(e) => setForm({...form, braco_esq: e.target.value})} className="input-field" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-dark-400 mb-1">Braço Dir.</label>
                  <input type="number" step="0.1" value={form.braco_dir} onChange={(e) => setForm({...form, braco_dir: e.target.value})} className="input-field" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-dark-400 mb-1">Peitoral</label>
                  <input type="number" step="0.1" value={form.peitoral} onChange={(e) => setForm({...form, peitoral: e.target.value})} className="input-field" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-dark-400 mb-1">Cintura</label>
                  <input type="number" step="0.1" value={form.cintura} onChange={(e) => setForm({...form, cintura: e.target.value})} className="input-field" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-dark-400 mb-1">Quadril</label>
                  <input type="number" step="0.1" value={form.quadril} onChange={(e) => setForm({...form, quadril: e.target.value})} className="input-field" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-dark-400 mb-1">Coxa Esq.</label>
                  <input type="number" step="0.1" value={form.coxa_esq} onChange={(e) => setForm({...form, coxa_esq: e.target.value})} className="input-field" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-dark-400 mb-1">Coxa Dir.</label>
                  <input type="number" step="0.1" value={form.coxa_dir} onChange={(e) => setForm({...form, coxa_dir: e.target.value})} className="input-field" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-dark-400 mb-1">Panturrilha</label>
                  <input type="number" step="0.1" value={form.panturrilha} onChange={(e) => setForm({...form, panturrilha: e.target.value})} className="input-field" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-200 mb-1">Observações</label>
                <textarea value={form.observacoes} onChange={(e) => setForm({...form, observacoes: e.target.value})} className="input-field" rows={2} />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" className="btn-primary">Salvar Avaliação</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Histórico/Evolução */}
      {showHistorico && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-dark-700">
              <h2 className="text-xl font-semibold">📈 Evolução — {historicoNome}</h2>
            </div>
            <div className="p-6">
              {historicoAluno.length === 0 ? (
                <p className="text-dark-400 text-center py-8">Nenhuma avaliação registrada.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-dark-800">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs text-dark-400">Data</th>
                        <th className="px-3 py-2 text-left text-xs text-dark-400">Peso</th>
                        <th className="px-3 py-2 text-left text-xs text-dark-400">IMC</th>
                        <th className="px-3 py-2 text-left text-xs text-dark-400">% Gord.</th>
                        <th className="px-3 py-2 text-left text-xs text-dark-400">Musc.</th>
                        <th className="px-3 py-2 text-left text-xs text-dark-400">Cintura</th>
                        <th className="px-3 py-2 text-left text-xs text-dark-400">Braço D.</th>
                        <th className="px-3 py-2 text-left text-xs text-dark-400">Coxa D.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dark-100">
                      {historicoAluno.map((av, i) => {
                        const anterior = i > 0 ? historicoAluno[i - 1] : null;
                        return (
                          <tr key={av.id}>
                            <td className="px-3 py-2 font-medium">{new Date(av.data_avaliacao).toLocaleDateString('pt-BR')}</td>
                            <td className="px-3 py-2">
                              {av.peso ? `${av.peso}kg` : '—'}
                              {anterior && <span className="ml-1">{getDiff(av.peso, anterior.peso)}</span>}
                            </td>
                            <td className="px-3 py-2">
                              {av.imc || '—'}
                              {anterior && <span className="ml-1">{getDiff(av.imc, anterior.imc)}</span>}
                            </td>
                            <td className="px-3 py-2">
                              {av.gordura_corporal ? `${av.gordura_corporal}%` : '—'}
                              {anterior && <span className="ml-1">{getDiff(av.gordura_corporal, anterior.gordura_corporal)}</span>}
                            </td>
                            <td className="px-3 py-2">
                              {av.massa_muscular ? `${av.massa_muscular}kg` : '—'}
                            </td>
                            <td className="px-3 py-2">
                              {av.cintura ? `${av.cintura}cm` : '—'}
                              {anterior && <span className="ml-1">{getDiff(av.cintura, anterior.cintura)}</span>}
                            </td>
                            <td className="px-3 py-2">
                              {av.braco_dir ? `${av.braco_dir}cm` : '—'}
                            </td>
                            <td className="px-3 py-2">
                              {av.coxa_dir ? `${av.coxa_dir}cm` : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Resumo da evolução */}
                  {historicoAluno.length >= 2 && (
                    <div className="mt-6 bg-primary-50 rounded-xl p-4">
                      <h4 className="font-medium text-primary-800 mb-2">Resumo da Evolução (primeira → última)</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        {(() => {
                          const first = historicoAluno[0];
                          const last = historicoAluno[historicoAluno.length - 1];
                          const items = [];
                          if (first.peso && last.peso) {
                            const diff = last.peso - first.peso;
                            items.push({ label: 'Peso', value: `${diff > 0 ? '+' : ''}${diff.toFixed(1)} kg`, positive: diff < 0 });
                          }
                          if (first.gordura_corporal && last.gordura_corporal) {
                            const diff = last.gordura_corporal - first.gordura_corporal;
                            items.push({ label: '% Gordura', value: `${diff > 0 ? '+' : ''}${diff.toFixed(1)}%`, positive: diff < 0 });
                          }
                          if (first.massa_muscular && last.massa_muscular) {
                            const diff = last.massa_muscular - first.massa_muscular;
                            items.push({ label: 'Massa Musc.', value: `${diff > 0 ? '+' : ''}${diff.toFixed(1)} kg`, positive: diff > 0 });
                          }
                          if (first.cintura && last.cintura) {
                            const diff = last.cintura - first.cintura;
                            items.push({ label: 'Cintura', value: `${diff > 0 ? '+' : ''}${diff.toFixed(1)} cm`, positive: diff < 0 });
                          }
                          return items.map((item, idx) => (
                            <div key={idx} className={`p-2 rounded-lg ${item.positive ? 'bg-green-100' : 'bg-red-100'}`}>
                              <p className="text-xs text-dark-400">{item.label}</p>
                              <p className={`font-bold ${item.positive ? 'text-green-700' : 'text-red-700'}`}>{item.value}</p>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end mt-6">
                <button onClick={() => setShowHistorico(false)} className="btn-primary">Fechar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
