'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import DashboardLayout from '@/components/DashboardLayout';

const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export default function ModalidadesPage() {
  const [tab, setTab] = useState<'modalidades' | 'planos'>('modalidades');
  const [modalidades, setModalidades] = useState<any[]>([]);
  const [planos, setPlanos] = useState<any[]>([]);
  const [horarios, setHorarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showModalMod, setShowModalMod] = useState(false);
  const [showModalPlano, setShowModalPlano] = useState(false);
  const [showModalHorario, setShowModalHorario] = useState(false);
  const [editingMod, setEditingMod] = useState<any>(null);
  const [editingPlano, setEditingPlano] = useState<any>(null);
  const [horarioModId, setHorarioModId] = useState('');

  const [formMod, setFormMod] = useState({ nome: '', descricao: '', capacidade_maxima: '30', plano_id: '', valor: '', ativo: true, professor_id_ref: '' });
  const [formPlano, setFormPlano] = useState({ nome: '', duracao_meses: '1', descricao: '', ativo: true });
  const [formHorario, setFormHorario] = useState({ dias_semana: [] as number[], horario_inicio: '06:00', horario_fim: '07:00', exercicios: [{ descricao: '', imagem: null as File | null }] });

  const toggleDia = (dia: number) => {
    setFormHorario(prev => ({
      ...prev,
      dias_semana: prev.dias_semana.includes(dia) ? prev.dias_semana.filter(d => d !== dia) : [...prev.dias_semana, dia]
    }));
  };

  const addExercicio = () => {
    setFormHorario(prev => ({ ...prev, exercicios: [...prev.exercicios, { descricao: '', imagem: null }] }));
  };

  const removeExercicio = (idx: number) => {
    setFormHorario(prev => ({ ...prev, exercicios: prev.exercicios.filter((_, i) => i !== idx) }));
  };

  const updateExercicio = (idx: number, field: string, value: any) => {
    setFormHorario(prev => ({ ...prev, exercicios: prev.exercicios.map((ex, i) => i === idx ? { ...ex, [field]: value } : ex) }));
  };

  useEffect(() => { loadData(); }, []);

  const [professores, setProfessores] = useState<any[]>([]);

  const loadData = async () => {
    const [{ data: mods }, { data: pls }, { data: hrs }, { data: profs }] = await Promise.all([
      supabase.from('modalidades').select('*, planos(nome, duracao_meses)').order('nome'),
      supabase.from('planos').select('*').order('duracao_meses'),
      supabase.from('horarios_aulas').select('*, modalidades(nome), exercicios_horario(id, titulo, descricao, imagem_url, ordem)').order('dia_semana').order('horario_inicio'),
      supabase.from('professores').select('id, nome').eq('status', 'ativo'),
    ]);
    if (mods) setModalidades(mods);
    if (pls) setPlanos(pls);
    if (hrs) setHorarios(hrs);
    if (profs) setProfessores(profs);
    setLoading(false);
  };

  // === MODALIDADES ===
  const handleSubmitMod = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { nome: formMod.nome, descricao: formMod.descricao || null, capacidade_maxima: parseInt(formMod.capacidade_maxima), plano_id: formMod.plano_id || null, valor: formMod.valor ? parseFloat(formMod.valor) : null, ativo: formMod.ativo, professor_id_ref: formMod.professor_id_ref || null };
    if (editingMod) { await supabase.from('modalidades').update(payload).eq('id', editingMod.id); }
    else { await supabase.from('modalidades').insert(payload); }
    setShowModalMod(false); loadData();
  };
  const handleEditMod = (mod: any) => { setEditingMod(mod); setFormMod({ nome: mod.nome, descricao: mod.descricao || '', capacidade_maxima: String(mod.capacidade_maxima), plano_id: mod.plano_id || '', valor: mod.valor ? String(mod.valor) : '', ativo: mod.ativo, professor_id_ref: mod.professor_id_ref || '' }); setShowModalMod(true); };
  const handleNewMod = () => { setEditingMod(null); setFormMod({ nome: '', descricao: '', capacidade_maxima: '30', plano_id: '', valor: '', ativo: true, professor_id_ref: '' }); setShowModalMod(true); };
  const handleDeleteMod = async (id: string) => { if (!confirm('Excluir?')) return; await supabase.from('modalidades').delete().eq('id', id); loadData(); };

  const handleDuplicarMod = async (mod: any) => {
    // Duplicar modalidade
    const { data: novaMod } = await supabase.from('modalidades').insert({
      nome: mod.nome + ' (Cópia)', descricao: mod.descricao, capacidade_maxima: mod.capacidade_maxima,
      plano_id: mod.plano_id, valor: mod.valor, ativo: mod.ativo, professor_id_ref: mod.professor_id_ref,
    }).select().single();
    if (!novaMod) { alert('Erro ao duplicar'); return; }

    // Duplicar horários
    const horariosOriginal = horarios.filter(h => h.modalidade_id === mod.id);
    for (const h of horariosOriginal) {
      const { data: novoH } = await supabase.from('horarios_aulas').insert({
        modalidade_id: novaMod.id, dia_semana: h.dia_semana, horario_inicio: h.horario_inicio,
        horario_fim: h.horario_fim, descricao_treino: h.descricao_treino, imagem_url: h.imagem_url,
      }).select().single();

      // Duplicar exercícios do horário
      if (novoH && h.exercicios_horario && h.exercicios_horario.length > 0) {
        const exInserts = h.exercicios_horario.map((ex: any) => ({
          horario_id: novoH.id, titulo: ex.titulo, descricao: ex.descricao, imagem_url: ex.imagem_url, ordem: ex.ordem,
        }));
        await supabase.from('exercicios_horario').insert(exInserts);
      }
    }
    loadData();
    alert('✅ Modalidade duplicada!');
  };

  // === PLANOS ===
  const handleSubmitPlano = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { nome: formPlano.nome, valor: 0, duracao_meses: parseInt(formPlano.duracao_meses), descricao: formPlano.descricao || null, ativo: formPlano.ativo };
    if (editingPlano) { await supabase.from('planos').update(payload).eq('id', editingPlano.id); }
    else { await supabase.from('planos').insert(payload); }
    setShowModalPlano(false); loadData();
  };
  const handleEditPlano = (p: any) => { setEditingPlano(p); setFormPlano({ nome: p.nome, duracao_meses: String(p.duracao_meses), descricao: p.descricao || '', ativo: p.ativo }); setShowModalPlano(true); };
  const handleNewPlano = () => { setEditingPlano(null); setFormPlano({ nome: '', duracao_meses: '1', descricao: '', ativo: true }); setShowModalPlano(true); };
  const handleDeletePlano = async (id: string) => { if (!confirm('Excluir?')) return; await supabase.from('planos').delete().eq('id', id); loadData(); };

  // === HORARIOS ===
  const handleSubmitHorario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formHorario.dias_semana.length === 0) { alert('Selecione pelo menos um dia.'); return; }

    const inserts = formHorario.dias_semana.map(dia => ({
      modalidade_id: horarioModId,
      dia_semana: dia,
      horario_inicio: formHorario.horario_inicio,
      horario_fim: formHorario.horario_fim,
    }));
    const { data: horariosInseridos, error: insertError } = await supabase.from('horarios_aulas').insert(inserts).select();
    if (insertError) { alert('Erro ao criar horário: ' + insertError.message); return; }

    // Inserir exercícios para cada horário criado
    if (horariosInseridos && formHorario.exercicios.length > 0) {
      for (const horario of horariosInseridos) {
        for (let i = 0; i < formHorario.exercicios.length; i++) {
          const ex = formHorario.exercicios[i];
          if (!ex.descricao && !ex.imagem) continue;

          let imagemUrl = null;
          if (ex.imagem) {
            const ext = ex.imagem.name.split('.').pop();
            const fileName = `treinos/${horario.id}_${i}_${Date.now()}.${ext}`;
            const { data: uploadData, error: uploadError } = await supabase.storage.from('mygym').upload(fileName, ex.imagem);
            if (!uploadError && uploadData) {
              const { data: urlData } = supabase.storage.from('mygym').getPublicUrl(fileName);
              imagemUrl = urlData.publicUrl;
            }
          }

          await supabase.from('exercicios_horario').insert({
            horario_id: horario.id,
            descricao: ex.descricao,
            imagem_url: imagemUrl,
            ordem: i,
          });
        }
      }
    }

    setShowModalHorario(false); loadData();
  };
  const handleDeleteHorario = async (id: string) => { await supabase.from('horarios_aulas').delete().eq('id', id); loadData(); };

  // Exercícios extras
  const [showExercicioModal, setShowExercicioModal] = useState(false);
  const [exercicioHorarioId, setExercicioHorarioId] = useState('');
  const [exercicioForm, setExercicioForm] = useState({ titulo: '', descricao: '', imagem: null as File | null });

  const openAddExercicio = (horarioId: string) => { setExercicioHorarioId(horarioId); setExercicioForm({ titulo: '', descricao: '', imagem: null }); setShowExercicioModal(true); };

  const handleSubmitExercicio = async (e: React.FormEvent) => {
    e.preventDefault();
    let imagemUrl = null;
    if (exercicioForm.imagem) {
      try {
        const ext = exercicioForm.imagem.name.split('.').pop();
        const fileName = `exercicios/${exercicioHorarioId}_${Date.now()}.${ext}`;
        const { data: uploadData, error: uploadError } = await supabase.storage.from('mygym').upload(fileName, exercicioForm.imagem);
        if (!uploadError && uploadData) {
          const { data: urlData } = supabase.storage.from('mygym').getPublicUrl(fileName);
          imagemUrl = urlData.publicUrl;
        }
      } catch (err) { console.error('Upload erro:', err); }
    }
    const { error } = await supabase.from('exercicios_horario').insert({
      horario_id: exercicioHorarioId, titulo: exercicioForm.titulo || 'Exercício', descricao: exercicioForm.descricao || null, imagem_url: imagemUrl,
    });
    if (error) { alert('Erro ao salvar exercício: ' + error.message); return; }
    setShowExercicioModal(false); loadData();
  };
  const openAddHorario = (modId: string) => { setHorarioModId(modId); setFormHorario({ dias_semana: [], horario_inicio: '06:00', horario_fim: '07:00', exercicios: [{ descricao: '', imagem: null }] }); setShowModalHorario(true); };

  const getHorariosForMod = (modId: string) => horarios.filter(h => h.modalidade_id === modId);

  return (
    <DashboardLayout activeMenu="modalidades" title="Modalidades">
      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-dark-700 p-1 rounded-lg w-fit">
        <button onClick={() => setTab('modalidades')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'modalidades' ? 'bg-dark-800 shadow-sm text-white' : 'text-dark-400 hover:text-dark-200'}`}><img src="/icons/modalidades.jpg" alt="" className="w-5 h-5 rounded" /> Modalidades</button>
        <button onClick={() => setTab('planos')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'planos' ? 'bg-dark-800 shadow-sm text-white' : 'text-dark-400 hover:text-dark-200'}`}><img src="/icons/mensalidades-pendentes.jpg" alt="" className="w-5 h-5 rounded" /> Planos</button>
      </div>

      {/* TAB MODALIDADES */}
      {tab === 'modalidades' && (
        <>
          <div className="mb-4 flex justify-between items-center">
            <p className="text-dark-400 text-sm">Atividades com plano, valor e horários vinculados.</p>
            <button onClick={handleNewMod} className="btn-primary">+ Nova Modalidade</button>
          </div>

          <div className="space-y-4">
            {loading ? <div className="card animate-pulse"><div className="h-20 bg-dark-700 rounded"></div></div> :
            modalidades.length === 0 ? <div className="card text-center py-12"><span className="text-4xl block mb-4">🏃</span><p className="text-dark-400">Nenhuma modalidade.</p></div> :
            modalidades.map((mod) => {
              const isHipertrofia = mod.nome.startsWith('TREINOS HIPERTROFIA');
              return (
              <div key={mod.id} className={`card ${!mod.ativo ? 'opacity-60' : ''} ${isHipertrofia ? 'border-2 border-orange-500/50 bg-gradient-to-br from-orange-950/20 to-dark-900' : ''}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {isHipertrofia && <span className="text-2xl">🏋️</span>}
                    <div>
                      <h3 className={`font-semibold text-lg ${isHipertrofia ? 'text-orange-400' : 'text-dark-100'}`}>{mod.nome}</h3>
                      {isHipertrofia && <p className="text-xs text-orange-300/70">Módulo Especial • Treinos guiados por dia</p>}
                      {!isHipertrofia && mod.descricao && <p className="text-sm text-dark-400">{mod.descricao}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {mod.valor && <span className={`text-lg font-bold ${isHipertrofia ? 'text-orange-400' : 'text-primary-600'}`}>R$ {Number(mod.valor).toFixed(2)}</span>}
                    {!mod.valor && isHipertrofia && <span className="text-sm text-orange-400/70">Sem custo</span>}
                    {mod.planos && <span className="text-xs bg-dark-700 px-2 py-1 rounded">{mod.planos.nome}</span>}
                    <span className={`px-2 py-0.5 rounded-full text-xs ${mod.ativo ? (isHipertrofia ? 'bg-orange-900/30 text-orange-400' : 'bg-green-100 text-green-700') : 'bg-dark-700 text-dark-400'}`}>{mod.ativo ? 'Ativa' : 'Inativa'}</span>
                  </div>
                </div>

                {/* Horários desta modalidade */}
                <div className="bg-dark-800 rounded-lg p-3 mt-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-dark-400 uppercase">Horários</span>
                    <button onClick={() => openAddHorario(mod.id)} className="text-xs text-primary-600 font-medium">+ Adicionar</button>
                  </div>
                  {getHorariosForMod(mod.id).length === 0 ? (
                    <p className="text-xs text-dark-400">Nenhum horário definido.</p>
                  ) : (
                    <div className="space-y-2">
                      {getHorariosForMod(mod.id).map((h: any) => (
                        <details key={h.id} className="bg-dark-700 rounded-lg border border-dark-600">
                          <summary className="flex items-center justify-between p-2 cursor-pointer">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-white text-xs">{diasSemana[h.dia_semana]?.slice(0, 3)}</span>
                              <span className="text-dark-300 text-xs">{h.horario_inicio?.slice(0, 5)}-{h.horario_fim?.slice(0, 5)}</span>
                              {h.descricao_treino && <span className="text-dark-400 text-xs ml-1">📋</span>}
                              {h.imagem_url && <span className="text-dark-400 text-xs">🖼</span>}
                            </div>
                            <div className="flex items-center gap-1">
                              <button onClick={(e) => { e.preventDefault(); const novoDia = prompt('Dia (0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sáb):', String(h.dia_semana)); const novoInicio = prompt('Horário início (HH:MM):', h.horario_inicio?.slice(0,5)); const novoFim = prompt('Horário fim (HH:MM):', h.horario_fim?.slice(0,5)); if (novoDia !== null && novoInicio && novoFim) { supabase.from('horarios_aulas').update({ dia_semana: parseInt(novoDia), horario_inicio: novoInicio, horario_fim: novoFim }).eq('id', h.id).then(() => loadData()); } }} className="text-yellow-400 hover:text-yellow-300 text-xs px-1">✎</button>
                              <button onClick={(e) => { e.preventDefault(); openAddExercicio(h.id); }} className="text-primary-400 hover:text-primary-300 text-xs px-1">+ Exercício</button>
                              <button onClick={(e) => { e.preventDefault(); handleDeleteHorario(h.id); }} className="text-red-400 hover:text-red-600 text-xs px-1">✕</button>
                            </div>
                          </summary>
                          <div className="px-3 pb-3 space-y-2 border-t border-dark-600 pt-2">
                            {h.descricao_treino && <p className="text-sm text-dark-200 whitespace-pre-line">{h.descricao_treino}</p>}
                            {h.imagem_url && <img src={h.imagem_url} alt="Treino" className="rounded-lg max-h-32 object-cover" />}
                            {h.exercicios_horario && h.exercicios_horario.length > 0 && (
                              <div className="space-y-2 mt-2">
                                {h.exercicios_horario.sort((a: any, b: any) => (a.ordem || 0) - (b.ordem || 0)).map((ex: any, idx: number, arr: any[]) => (
                                  <div key={ex.id} className="bg-dark-800 rounded p-2 flex items-start gap-2">
                                    {ex.imagem_url && <img src={ex.imagem_url} alt="" className="w-12 h-12 rounded object-cover flex-shrink-0" />}
                                    <div className="flex-1">
                                      <p className="text-xs font-medium text-dark-200">{ex.titulo}</p>
                                      {ex.descricao && <p className="text-xs text-dark-400">{ex.descricao}</p>}
                                    </div>
                                    <div className="flex flex-col gap-1">
                                      <button onClick={async () => { if (idx === 0) return; const newArr = [...arr]; const item = newArr.splice(idx, 1)[0]; newArr.splice(idx - 1, 0, item); for (let i = 0; i < newArr.length; i++) { await supabase.from('exercicios_horario').update({ ordem: i + 1 }).eq('id', newArr[i].id); } loadData(); }} className={`px-2 py-1 rounded text-sm ${idx === 0 ? 'bg-dark-800 text-dark-600' : 'bg-dark-700 text-white hover:bg-primary-600 active:scale-90'}`}>▲</button>
                                      <button onClick={async () => { if (idx === arr.length - 1) return; const newArr = [...arr]; const item = newArr.splice(idx, 1)[0]; newArr.splice(idx + 1, 0, item); for (let i = 0; i < newArr.length; i++) { await supabase.from('exercicios_horario').update({ ordem: i + 1 }).eq('id', newArr[i].id); } loadData(); }} className={`px-2 py-1 rounded text-sm ${idx === arr.length - 1 ? 'bg-dark-800 text-dark-600' : 'bg-dark-700 text-white hover:bg-primary-600 active:scale-90'}`}>▼</button>
                                    </div>
                                    <button onClick={() => { const novoTitulo = prompt('Título:', ex.titulo || ''); const novaDesc = prompt('Descrição:', ex.descricao || ''); if (novoTitulo !== null) { supabase.from('exercicios_horario').update({ titulo: novoTitulo, descricao: novaDesc }).eq('id', ex.id).then(() => loadData()); } }} className="text-primary-400 text-xs">✎</button>
                                    <button onClick={() => { const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*,.gif'; input.onchange = async (ev: any) => { const file = ev.target.files[0]; if (!file) return; const ext = file.name.split('.').pop(); const fileName = `exercicios/${ex.id}_${Date.now()}.${ext}`; const { data: up } = await supabase.storage.from('mygym').upload(fileName, file); if (up) { const { data: url } = supabase.storage.from('mygym').getPublicUrl(fileName); await supabase.from('exercicios_horario').update({ imagem_url: url.publicUrl }).eq('id', ex.id); loadData(); } }; input.click(); }} className="text-yellow-400 text-xs">🖼</button>
                                    <button onClick={() => supabase.from('exercicios_horario').delete().eq('id', ex.id).then(() => loadData())} className="text-red-400 text-xs">✕</button>
                                  </div>
                                ))}
                              </div>
                            )}
                            {(!h.descricao_treino && !h.imagem_url && (!h.exercicios_horario || h.exercicios_horario.length === 0)) && (
                              <p className="text-xs text-dark-400">Nenhum treino cadastrado para este dia.</p>
                            )}
                          </div>
                        </details>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-3 mt-3 pt-3 border-t border-dark-700">
                  <button onClick={() => handleEditMod(mod)} className="text-primary-600 text-sm font-medium">Editar</button>
                  <button onClick={() => handleDuplicarMod(mod)} className="text-yellow-400 text-sm font-medium">📋 Duplicar</button>
                  <button onClick={() => handleDeleteMod(mod.id)} className="text-red-600 text-sm font-medium">Excluir</button>
                </div>
              </div>
              );
            })}
          </div>
        </>
      )}

      {/* TAB PLANOS */}
      {tab === 'planos' && (
        <>
          <div className="mb-4 flex justify-between items-center">
            <p className="text-dark-400 text-sm">Tipos de recorrência (duração) que podem ser vinculados às modalidades.</p>
            <button onClick={handleNewPlano} className="btn-primary">+ Novo Plano</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {planos.map((p) => (
              <div key={p.id} className={`card ${!p.ativo ? 'opacity-60' : ''}`}>
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-dark-100">{p.nome}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${p.ativo ? 'bg-green-100 text-green-700' : 'bg-dark-700 text-dark-400'}`}>{p.ativo ? 'Ativo' : 'Inativo'}</span>
                </div>
                <p className="text-dark-400 text-sm">{p.duracao_meses} {p.duracao_meses === 1 ? 'mês' : 'meses'}</p>
                {p.descricao && <p className="text-xs text-dark-400 mt-1">{p.descricao}</p>}
                <div className="flex gap-2 pt-3 mt-3 border-t border-dark-700">
                  <button onClick={() => handleEditPlano(p)} className="text-primary-600 text-sm font-medium">Editar</button>
                  <button onClick={() => handleDeletePlano(p.id)} className="text-red-600 text-sm font-medium">Excluir</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modal Modalidade */}
      {showModalMod && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-2xl w-full max-w-md">
            <div className="p-6 border-b border-dark-700"><h2 className="text-xl font-semibold">{editingMod ? 'Editar' : 'Nova'} Modalidade</h2></div>
            <form onSubmit={handleSubmitMod} className="p-6 space-y-4">
              <div><label className="block text-sm font-medium text-dark-200 mb-1">Nome *</label><input type="text" value={formMod.nome} onChange={(e) => setFormMod({...formMod, nome: e.target.value})} className="input-field" required /></div>
              <div><label className="block text-sm font-medium text-dark-200 mb-1">Descrição</label><textarea value={formMod.descricao} onChange={(e) => setFormMod({...formMod, descricao: e.target.value})} className="input-field" rows={2} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-dark-200 mb-1">Plano</label><select value={formMod.plano_id} onChange={(e) => setFormMod({...formMod, plano_id: e.target.value})} className="input-field"><option value="">Selecione</option>{planos.filter(p => p.ativo).map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></div>
                <div><label className="block text-sm font-medium text-dark-200 mb-1">Valor (R$)</label><input type="number" step="0.01" value={formMod.valor} onChange={(e) => setFormMod({...formMod, valor: e.target.value})} className="input-field" /></div>
              </div>
              <div><label className="block text-sm font-medium text-dark-200 mb-1">Capacidade</label><input type="number" value={formMod.capacidade_maxima} onChange={(e) => setFormMod({...formMod, capacidade_maxima: e.target.value})} className="input-field" min="1" /></div>
              <div><label className="block text-sm font-medium text-dark-200 mb-1">Professor</label><select value={formMod.professor_id_ref} onChange={(e) => setFormMod({...formMod, professor_id_ref: e.target.value})} className="input-field"><option value="">Sem professor</option>{professores.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></div>
              <div className="flex items-center gap-2"><input type="checkbox" checked={formMod.ativo} onChange={(e) => setFormMod({...formMod, ativo: e.target.checked})} className="rounded" /><label className="text-sm text-dark-200">Ativa</label></div>
              <div className="flex justify-end gap-3 pt-4"><button type="button" onClick={() => setShowModalMod(false)} className="btn-secondary">Cancelar</button><button type="submit" className="btn-primary">{editingMod ? 'Salvar' : 'Criar'}</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Plano */}
      {showModalPlano && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-2xl w-full max-w-sm">
            <div className="p-6 border-b border-dark-700"><h2 className="text-xl font-semibold">{editingPlano ? 'Editar' : 'Novo'} Plano</h2></div>
            <form onSubmit={handleSubmitPlano} className="p-6 space-y-4">
              <div><label className="block text-sm font-medium text-dark-200 mb-1">Nome *</label><input type="text" value={formPlano.nome} onChange={(e) => setFormPlano({...formPlano, nome: e.target.value})} className="input-field" placeholder="Ex: Mensal, Trimestral" required /></div>
              <div><label className="block text-sm font-medium text-dark-200 mb-1">Duração (meses) *</label><select value={formPlano.duracao_meses} onChange={(e) => setFormPlano({...formPlano, duracao_meses: e.target.value})} className="input-field"><option value="1">1 mês</option><option value="3">3 meses</option><option value="6">6 meses</option><option value="12">12 meses</option></select></div>
              <div><label className="block text-sm font-medium text-dark-200 mb-1">Descrição</label><textarea value={formPlano.descricao} onChange={(e) => setFormPlano({...formPlano, descricao: e.target.value})} className="input-field" rows={2} /></div>
              <div className="flex items-center gap-2"><input type="checkbox" checked={formPlano.ativo} onChange={(e) => setFormPlano({...formPlano, ativo: e.target.checked})} className="rounded" /><label className="text-sm text-dark-200">Ativo</label></div>
              <div className="flex justify-end gap-3 pt-4"><button type="button" onClick={() => setShowModalPlano(false)} className="btn-secondary">Cancelar</button><button type="submit" className="btn-primary">{editingPlano ? 'Salvar' : 'Criar'}</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Horário */}
      {showModalHorario && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-dark-700"><h2 className="text-xl font-semibold text-dark-100">Adicionar Horário</h2></div>
            <form onSubmit={handleSubmitHorario} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">Dias da Semana</label>
                <div className="grid grid-cols-4 gap-2">
                  {diasSemana.map((d, i) => (
                    <button key={i} type="button" onClick={() => toggleDia(i)} className={`px-2 py-2 rounded-lg text-xs font-medium transition-colors ${formHorario.dias_semana.includes(i) ? 'bg-primary-600 text-white' : 'bg-dark-700 text-dark-400 hover:bg-dark-600'}`}>{d.slice(0, 3)}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-dark-200 mb-1">Início</label><input type="time" value={formHorario.horario_inicio} onChange={(e) => setFormHorario({...formHorario, horario_inicio: e.target.value})} className="input-field" /></div>
                <div><label className="block text-sm font-medium text-dark-200 mb-1">Fim</label><input type="time" value={formHorario.horario_fim} onChange={(e) => setFormHorario({...formHorario, horario_fim: e.target.value})} className="input-field" /></div>
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">Exercícios / Treinos</label>
                <div className="space-y-3">
                  {formHorario.exercicios.map((ex, idx) => (
                    <div key={idx} className="bg-dark-700 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-dark-400">Exercício {idx + 1}</span>
                        {formHorario.exercicios.length > 1 && <button type="button" onClick={() => removeExercicio(idx)} className="text-red-400 text-xs">✕ Remover</button>}
                      </div>
                      <textarea value={ex.descricao} onChange={(e) => updateExercicio(idx, 'descricao', e.target.value)} className="input-field mb-2" rows={2} placeholder="Descrição do exercício..." />
                      <input type="file" accept="image/*,.gif" onChange={(e) => updateExercicio(idx, 'imagem', e.target.files?.[0] || null)} className="input-field text-xs" />
                    </div>
                  ))}
                </div>
                <button type="button" onClick={addExercicio} className="mt-2 text-sm text-primary-400 font-medium">+ Adicionar exercício</button>
              </div>
              <div className="flex justify-end gap-3 pt-4"><button type="button" onClick={() => setShowModalHorario(false)} className="btn-secondary">Cancelar</button><button type="submit" className="btn-primary">Adicionar</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Exercício Extra */}
      {showExercicioModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-2xl w-full max-w-md">
            <div className="p-6 border-b border-dark-700"><h2 className="text-xl font-semibold text-dark-100">Adicionar Exercício</h2></div>
            <form onSubmit={handleSubmitExercicio} className="p-6 space-y-4">
              <div><label className="block text-sm font-medium text-dark-200 mb-1">Título *</label><input type="text" value={exercicioForm.titulo} onChange={(e) => setExercicioForm({...exercicioForm, titulo: e.target.value})} className="input-field" placeholder="Ex: Supino Reto" required /></div>
              <div><label className="block text-sm font-medium text-dark-200 mb-1">Descrição</label><textarea value={exercicioForm.descricao} onChange={(e) => setExercicioForm({...exercicioForm, descricao: e.target.value})} className="input-field" rows={3} placeholder="Ex: 4 séries x 12 repetições" /></div>
              <div><label className="block text-sm font-medium text-dark-200 mb-1">Foto / GIF</label><input type="file" accept="image/*,.gif" onChange={(e) => setExercicioForm({...exercicioForm, imagem: e.target.files?.[0] || null})} className="input-field" /></div>
              <div className="flex justify-end gap-3 pt-4"><button type="button" onClick={() => setShowExercicioModal(false)} className="btn-secondary">Cancelar</button><button type="submit" className="btn-primary">Adicionar</button></div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
