'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabase-admin';
import DashboardLayout from '@/components/DashboardLayout';

export default function ProfessoresPage() {
  const [professores, setProfessores] = useState<any[]>([]);
  const [modalidades, setModalidades] = useState<any[]>([]);
  const [horarios, setHorarios] = useState<any[]>([]);
  const [profModValores, setProfModValores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showValorModal, setShowValorModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [valorProfId, setValorProfId] = useState('');
  const [valorForm, setValorForm] = useState({ modalidade_id: '', valor_aula: '' });

  const [form, setForm] = useState({ nome: '', email: '', telefone: '', cpf: '', data_nascimento: '', endereco: '', observacoes: '' });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const [{ data: profs }, { data: mods }, { data: hrs }, { data: pmv }] = await Promise.all([
      supabase.from('professores').select('*').order('nome'),
      supabase.from('modalidades').select('id, nome, professor_id_ref').eq('ativo', true),
      supabase.from('horarios_aulas').select('*'),
      supabase.from('professor_modalidade_valor').select('*'),
    ]);
    if (profs) setProfessores(profs);
    if (mods) setModalidades(mods);
    if (hrs) setHorarios(hrs);
    if (pmv) setProfModValores(pmv);
    setLoading(false);
  };

  const getModsForProf = (profId: string) => modalidades.filter(m => m.professor_id_ref === profId);

  const getHorasSemanais = (profId: string) => {
    const mods = getModsForProf(profId);
    let totalMin = 0;
    mods.forEach(mod => {
      const hrs = horarios.filter(h => h.modalidade_id === mod.id);
      hrs.forEach(h => {
        const [hi, mi] = h.horario_inicio.split(':').map(Number);
        const [hf, mf] = h.horario_fim.split(':').map(Number);
        totalMin += (hf * 60 + mf) - (hi * 60 + mi);
      });
    });
    return (totalMin / 60).toFixed(1);
  };

  const getValorMensal = (profId: string) => {
    const valores = profModValores.filter(v => v.professor_id === profId);
    let total = 0;
    valores.forEach(v => {
      total += Number(v.valor_aula);
    });
    return total;
  };

  const getValoresProf = (profId: string) => profModValores.filter(v => v.professor_id === profId);

  const handleAddValor = async (e: React.FormEvent) => {
    e.preventDefault();
    await supabase.from('professor_modalidade_valor').insert({
      professor_id: valorProfId, modalidade_id: valorForm.modalidade_id, valor_aula: parseFloat(valorForm.valor_aula),
    });
    setShowValorModal(false); loadData();
  };

  const handleDeleteValor = async (id: string) => {
    await supabase.from('professor_modalidade_valor').delete().eq('id', id);
    loadData();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { nome: form.nome, email: form.email, telefone: form.telefone, cpf: form.cpf || null, data_nascimento: form.data_nascimento || null, endereco: form.endereco || null, observacoes: form.observacoes || null };

    if (editing) {
      await supabase.from('professores').update(payload).eq('id', editing.id);
    } else {
      // Criar login
      const cpfDigitos = form.cpf.replace(/\D/g, '');
      const senhaTemp = cpfDigitos.length >= 6 ? cpfDigitos.slice(0, 6) : 'Gym123';

      let userId: string | null = null;
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: form.email, password: senhaTemp, email_confirm: true,
        user_metadata: { nome: form.nome, role: 'professor' },
      });
      if (!authError && authUser?.user) {
        userId = authUser.user.id;
      } else if (authError?.message?.includes('already been registered')) {
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
        const existing = existingUsers?.users?.find((u: any) => u.email === form.email);
        if (existing) { userId = existing.id; await supabaseAdmin.auth.admin.updateUserById(existing.id, { password: senhaTemp }); }
      }

      const { error } = await supabase.from('professores').insert({ ...payload, user_id: userId });
      if (error) { alert('Erro: ' + error.message); return; }

      const senhaExibir = cpfDigitos.length >= 6 ? senhaTemp + ' (6 dígitos CPF)' : 'Gym123 (padrão)';
      alert(`✅ Professor cadastrado!\n\nE-mail: ${form.email}\nSenha: ${senhaExibir}`);
    }
    setShowModal(false); loadData();
  };

  const handleEdit = (p: any) => { setEditing(p); setForm({ nome: p.nome, email: p.email, telefone: p.telefone, cpf: p.cpf || '', data_nascimento: p.data_nascimento || '', endereco: p.endereco || '', observacoes: p.observacoes || '' }); setShowModal(true); };
  const handleNew = () => { setEditing(null); setForm({ nome: '', email: '', telefone: '', cpf: '', data_nascimento: '', endereco: '', observacoes: '' }); setShowModal(true); };
  const handleDelete = async (id: string) => { if (!confirm('Excluir professor?')) return; await supabase.from('professores').delete().eq('id', id); loadData(); };

  const [showPagModal, setShowPagModal] = useState(false);
  const [pagProf, setPagProf] = useState<any>(null);
  const [pagForm, setPagForm] = useState({ forma_pagamento: 'pix', observacoes: '' });

  const handlePagarProfessor = async (prof: any) => {
    // Calcular valor do mês
    const hoje = new Date();
    const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;

    // Verificar se já pagou este mês
    const { data: pagExist } = await supabase.from('pagamentos_professores').select('id').eq('professor_id', prof.id).eq('mes_referencia', mesAtual).eq('status', 'pago').single();
    if (pagExist) { alert('Pagamento deste mês já foi confirmado.'); return; }

    setPagProf(prof);
    setShowPagModal(true);
  };

  const confirmarPagamentoProf = async () => {
    if (!pagProf) return;
    const hoje = new Date();
    const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    const inicioMes = `${mesAtual}-01`;
    const fimMes = `${mesAtual}-31`;

    // Contar check-ins do mês
    const { data: checkins } = await supabase.from('checkins_professores').select('id').eq('professor_id', pagProf.id).gte('data', inicioMes).lte('data', fimMes);
    const aulas = checkins?.length || 0;

    // Buscar valor mensal
    const valores = profModValores.filter((v: any) => v.professor_id === pagProf.id);
    const valorTotal = valores.reduce((s: number, v: any) => s + Number(v.valor_aula), 0);

    // Inserir ou atualizar pagamento
    await supabase.from('pagamentos_professores').upsert({
      professor_id: pagProf.id, mes_referencia: mesAtual, valor: valorTotal,
      status: 'pago', forma_pagamento: pagForm.forma_pagamento,
      data_pagamento: hoje.toISOString().split('T')[0], observacoes: pagForm.observacoes || null,
    }, { onConflict: 'professor_id,mes_referencia' }).select();

    // Se upsert não funciona sem unique constraint, usar insert
    const { error } = await supabase.from('pagamentos_professores').insert({
      professor_id: pagProf.id, mes_referencia: mesAtual, valor: valorTotal,
      status: 'pago', forma_pagamento: pagForm.forma_pagamento,
      data_pagamento: hoje.toISOString().split('T')[0], observacoes: pagForm.observacoes || null,
    });

    alert(`✅ Pagamento confirmado!\n${pagProf.nome} — ${aulas} aulas — R$ ${valorTotal.toFixed(2)}`);
    setShowPagModal(false);
  };

  return (
    <DashboardLayout activeMenu="professores" title="Professores">
      <div className="mb-6 flex justify-between items-center">
        <p className="text-dark-400">Gerencie os professores e instrutores da academia.</p>
        <button onClick={handleNew} className="btn-primary">+ Novo Professor</button>
      </div>

      <div className="space-y-4">
        {loading ? <div className="card animate-pulse"><div className="h-20 bg-dark-700 rounded"></div></div> :
        professores.length === 0 ? <div className="card text-center py-12"><p className="text-dark-400">Nenhum professor cadastrado.</p></div> :
        professores.map((prof) => {
          const mods = getModsForProf(prof.id);
          const horas = getHorasSemanais(prof.id);
          return (
            <div key={prof.id} className="card">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-lg text-dark-100">{prof.nome}</h3>
                  <p className="text-sm text-dark-400">{prof.email} • {prof.telefone}</p>
                </div>
                <div className="text-right">
                  <span className={`badge-${prof.status === 'ativo' ? 'ativo' : 'suspenso'}`}>{prof.status}</span>
                  <p className="text-sm text-primary-400 mt-1 font-medium">{horas}h/semana</p>
                  <p className="text-sm text-green-400 font-medium">R$ {getValorMensal(prof.id).toFixed(2)}/mês</p>
                </div>
              </div>

              {/* Valores por modalidade */}
              {getValoresProf(prof.id).length > 0 && (
                <div className="mt-3 space-y-1">
                  {getValoresProf(prof.id).map((v: any) => {
                    const modNome = modalidades.find(m => m.id === v.modalidade_id)?.nome || '—';
                    return (
                      <div key={v.id} className="flex items-center justify-between text-xs bg-dark-700 px-3 py-1.5 rounded">
                        <span className="text-dark-200">{modNome}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-green-400 font-medium">R$ {Number(v.valor_aula).toFixed(2)}/mês</span>
                          <button onClick={() => { const novoValor = prompt(`Novo valor mensal para ${modNome}:`, String(v.valor_aula)); if (novoValor && !isNaN(Number(novoValor))) { supabase.from('professor_modalidade_valor').update({ valor_aula: parseFloat(novoValor) }).eq('id', v.id).then(() => loadData()); } }} className="text-primary-400">✎</button>
                          <button onClick={() => handleDeleteValor(v.id)} className="text-red-400">✕</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-dark-700">
                <button onClick={() => handleEdit(prof)} className="px-3 py-1.5 bg-blue-900/30 text-blue-400 border border-blue-800 rounded-lg text-sm font-medium hover:bg-blue-900/50 transition-colors">✏️ Editar</button>
                <button onClick={() => { setValorProfId(prof.id); setValorForm({ modalidade_id: '', valor_aula: '' }); setShowValorModal(true); }} className="px-3 py-1.5 bg-green-900/30 text-green-400 border border-green-800 rounded-lg text-sm font-medium hover:bg-green-900/50 transition-colors">+ Valor Mensal</button>
                <button onClick={() => handlePagarProfessor(prof)} className="px-3 py-1.5 bg-yellow-900/30 text-yellow-400 border border-yellow-800 rounded-lg text-sm font-medium hover:bg-yellow-900/50 transition-colors">💰 Pagar</button>
                <button onClick={() => handleDelete(prof.id)} className="px-3 py-1.5 bg-red-900/30 text-red-400 border border-red-800 rounded-lg text-sm font-medium hover:bg-red-900/50 transition-colors">🗑 Excluir</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-dark-700"><h2 className="text-xl font-semibold text-dark-100">{editing ? 'Editar' : 'Novo'} Professor</h2></div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-dark-200 mb-1">Nome *</label><input type="text" value={form.nome} onChange={(e) => setForm({...form, nome: e.target.value})} className="input-field" required /></div>
                <div><label className="block text-sm font-medium text-dark-200 mb-1">E-mail *</label><input type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} className="input-field" required /></div>
                <div><label className="block text-sm font-medium text-dark-200 mb-1">Telefone *</label><input type="text" value={form.telefone} onChange={(e) => setForm({...form, telefone: e.target.value})} className="input-field" required /></div>
                <div><label className="block text-sm font-medium text-dark-200 mb-1">CPF</label><input type="text" value={form.cpf} onChange={(e) => setForm({...form, cpf: e.target.value})} className="input-field" /></div>
                <div><label className="block text-sm font-medium text-dark-200 mb-1">Data Nascimento</label><input type="date" value={form.data_nascimento} onChange={(e) => setForm({...form, data_nascimento: e.target.value})} className="input-field" /></div>
              </div>
              <div><label className="block text-sm font-medium text-dark-200 mb-1">Endereço</label><input type="text" value={form.endereco} onChange={(e) => setForm({...form, endereco: e.target.value})} className="input-field" /></div>
              <div><label className="block text-sm font-medium text-dark-200 mb-1">Observações</label><textarea value={form.observacoes} onChange={(e) => setForm({...form, observacoes: e.target.value})} className="input-field" rows={2} /></div>
              <div className="flex justify-end gap-3 pt-4"><button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button><button type="submit" className="btn-primary">{editing ? 'Salvar' : 'Cadastrar'}</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Valor por Modalidade */}
      {showValorModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-2xl w-full max-w-sm">
            <div className="p-6 border-b border-dark-700"><h2 className="text-lg font-semibold text-dark-100">Definir Valor Mensal</h2></div>
            <form onSubmit={handleAddValor} className="p-6 space-y-4">
              <div><label className="block text-sm font-medium text-dark-200 mb-1">Modalidade</label><select value={valorForm.modalidade_id} onChange={(e) => setValorForm({...valorForm, modalidade_id: e.target.value})} className="input-field" required><option value="">Selecione</option>{modalidades.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}</select></div>
              <div><label className="block text-sm font-medium text-dark-200 mb-1">Valor Mensal (R$)</label><input type="number" step="0.01" min="0" value={valorForm.valor_aula} onChange={(e) => setValorForm({...valorForm, valor_aula: e.target.value})} className="input-field" required placeholder="0.00" /></div>
              <div className="flex justify-end gap-3 pt-4"><button type="button" onClick={() => setShowValorModal(false)} className="btn-secondary">Cancelar</button><button type="submit" className="btn-primary">Salvar</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Pagar Professor */}
      {showPagModal && pagProf && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-2xl w-full max-w-sm">
            <div className="p-6 border-b border-dark-700">
              <h2 className="text-xl font-semibold text-dark-100">Confirmar Pagamento</h2>
              <p className="text-sm text-dark-400 mt-1">{pagProf.nome} — {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-1">Forma de Pagamento</label>
                <select value={pagForm.forma_pagamento} onChange={(e) => setPagForm({...pagForm, forma_pagamento: e.target.value})} className="input-field">
                  <option value="pix">PIX</option>
                  <option value="transferencia">Transferência</option>
                  <option value="dinheiro">Dinheiro</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-1">Observações</label>
                <textarea value={pagForm.observacoes} onChange={(e) => setPagForm({...pagForm, observacoes: e.target.value})} className="input-field" rows={2} />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button onClick={() => setShowPagModal(false)} className="btn-secondary">Cancelar</button>
                <button onClick={confirmarPagamentoProf} className="btn-primary">✅ Confirmar Pagamento</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
