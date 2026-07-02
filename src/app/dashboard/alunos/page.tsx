'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { formatDate } from '@/lib/utils';
import DashboardLayout from '@/components/DashboardLayout';

interface AlunoFull {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  cpf?: string;
  data_nascimento?: string;
  endereco?: string;
  status: string;
  convenio_id?: string;
  observacoes?: string;
  created_at: string;
  aluno_modalidades?: any[];
  matriculas?: any[];
}

export default function AlunosPage() {
  const [alunos, setAlunos] = useState<AlunoFull[]>([]);
  const [convenios, setConvenios] = useState<any[]>([]);
  const [modalidades, setModalidades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showFicha, setShowFicha] = useState(false);
  const [showAddMod, setShowAddMod] = useState(false);
  const [editingAluno, setEditingAluno] = useState<AlunoFull | null>(null);
  const [fichaAluno, setFichaAluno] = useState<AlunoFull | null>(null);
  const [logModalidades, setLogModalidades] = useState<any[]>([]);
  const [logMatricula, setLogMatricula] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('todos');
  const [filterPlano, setFilterPlano] = useState('todos');
  const [selectedMods, setSelectedMods] = useState<string[]>([]);

  const [form, setForm] = useState({
    nome: '', email: '', telefone: '', cpf: '', data_nascimento: '',
    endereco: '', status: 'ativo', convenio_id: '', observacoes: '',
    data_inicio: new Date().toISOString().split('T')[0],
    dia_vencimento: '10',
    primeiro_pagamento_confirmado: false,
    forma_pagamento_inicial: 'pix',
    treino_hipertrofia: false,
  });

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    const [{ data: al }, { data: conv }, { data: mods }] = await Promise.all([
      supabase.from('alunos').select('*, aluno_modalidades(id, modalidade_id, status, modalidades(nome, valor)), matriculas(id, status, valor_final, data_inicio, planos(nome))').order('nome'),
      supabase.from('convenios').select('*').eq('ativo', true),
      supabase.from('modalidades').select('*, planos(nome)').eq('ativo', true).order('nome'),
    ]);
    if (al) setAlunos(al as any);
    if (conv) setConvenios(conv);
    if (mods) setModalidades(mods);
    setLoading(false);
  };

  const loadLogMod = async (alunoId: string) => {
    const { data } = await supabase.from('log_modalidades_aluno').select('*, modalidades(nome)').eq('aluno_id', alunoId).order('created_at', { ascending: false });
    if (data) setLogModalidades(data);
  };

  const loadLogMat = async (alunoId: string) => {
    const { data } = await supabase.from('log_matriculas').select('*').eq('aluno_id', alunoId).order('created_at', { ascending: false });
    if (data) setLogMatricula(data);
  };

  const calcValorTotal = (modIds: string[], convenioId?: string) => {
    let total = 0;
    modIds.forEach(id => {
      const mod = modalidades.find(m => m.id === id);
      if (mod?.valor) total += Number(mod.valor);
    });
    if (convenioId) {
      const conv = convenios.find(c => c.id === convenioId);
      if (conv) total -= total * conv.desconto_percentual / 100;
    }
    return total;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const alunoPayload = {
      nome: form.nome, email: form.email, telefone: form.telefone,
      cpf: form.cpf || null, data_nascimento: form.data_nascimento || null,
      endereco: form.endereco || null, status: form.status,
      convenio_id: form.convenio_id || null, observacoes: form.observacoes || null,
      dia_vencimento: parseInt(form.dia_vencimento) || 10,
      treino_hipertrofia: form.treino_hipertrofia,
    };

    if (editingAluno) {
      const { error } = await supabase.from('alunos').update(alunoPayload).eq('id', editingAluno.id);
      if (error) { alert('Erro ao salvar: ' + error.message); return; }
      setShowModal(false);
      loadAll();
      return;
    } else {
      // Senha = 6 primeiros dígitos do CPF
      const cpfDigitos = form.cpf.replace(/\D/g, '');
      const senhaTemp = cpfDigitos.length >= 6 ? cpfDigitos.slice(0, 6) : 'Gym123';

      // Criar usuário auth
      let userId: string | null = null;
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: form.email, password: senhaTemp, email_confirm: true,
        user_metadata: { nome: form.nome, role: 'aluno' },
      });
      if (!authError && authUser?.user) {
        userId = authUser.user.id;
      } else if (authError?.message?.includes('already been registered')) {
        // User já existe, buscar o ID e atualizar a senha
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
        const existing = existingUsers?.users?.find((u: any) => u.email === form.email);
        if (existing) {
          userId = existing.id;
          // Atualizar senha para o CPF do novo cadastro
          await supabaseAdmin.auth.admin.updateUserById(existing.id, { password: senhaTemp });
        }
      }

      // Criar aluno
      const numeroMatricula = Date.now().toString().slice(-6);
      const { data: novoAluno, error: errAluno } = await supabase
        .from('alunos').insert({ ...alunoPayload, user_id: userId }).select().single();
      if (errAluno || !novoAluno) { alert('Erro: ' + errAluno?.message); return; }

      // Vincular modalidades
      if (selectedMods.length > 0) {
        const vinculos = selectedMods.map(modId => ({
          aluno_id: novoAluno.id, modalidade_id: modId, status: 'ativa',
        }));
        await supabase.from('aluno_modalidades').insert(vinculos);

        // Log
        for (const modId of selectedMods) {
          await supabase.from('log_modalidades_aluno').insert({
            aluno_id: novoAluno.id, modalidade_id: modId, acao: 'adicionada', data_alteracao: form.data_inicio,
          });
        }

        // Criar matrícula com valor total
        const valorTotal = calcValorTotal(selectedMods, form.convenio_id);
        const mod0 = modalidades.find(m => m.id === selectedMods[0]);
        const duracao = mod0?.planos ? mod0.planos.duracao_meses || 1 : 1;
        const planoId = mod0?.plano_id;

        // Usar split para evitar problemas de timezone
        const [anoI, mesI, diaI] = form.data_inicio.split('-').map(Number);
        const mesFim = mesI + duracao;
        const anoFim = anoI + Math.floor((mesFim - 1) / 12);
        const mesRealFim = ((mesFim - 1) % 12) + 1;
        const dataFimStr = `${anoFim}-${String(mesRealFim).padStart(2, '0')}-${String(diaI).padStart(2, '0')}`;

        if (planoId) {
          const { data: matricula } = await supabase.from('matriculas').insert({
            aluno_id: novoAluno.id, plano_id: planoId,
            data_inicio: form.data_inicio, data_fim: dataFimStr,
            valor_final: valorTotal, status: 'ativa',
          }).select().single();

          if (matricula) {
            // Gerar mensalidades
            // Regra: vencimento = mesmo dia no mês seguinte. Se dia não existe no mês, usar último dia.
            const mensalidades = [];
            const valorMensal = valorTotal / duracao;
            const diaVenc = parseInt(form.dia_vencimento) || diaI;
            for (let i = 0; i < duracao; i++) {
              const mes = mesI + i; // começa no mês do início (primeiro pagamento = mês de cadastro)
              let ano = anoI;
              let mesCalc = mes;
              // Ajustar se passou de dezembro
              while (mesCalc > 12) { mesCalc -= 12; ano++; }
              // Verificar último dia do mês (para regra do dia 31 → 30)
              const ultimoDia = new Date(ano, mesCalc, 0).getDate();
              const diaFinal = Math.min(diaVenc, ultimoDia);
              const dataVenc = `${ano}-${String(mesCalc).padStart(2, '0')}-${String(diaFinal).padStart(2, '0')}`;
              mensalidades.push({
                matricula_id: matricula.id, aluno_id: novoAluno.id,
                valor: valorMensal, data_vencimento: dataVenc,
                status: i === 0 && form.primeiro_pagamento_confirmado ? 'pago' : (dataVenc < new Date().toISOString().split('T')[0] ? 'atrasado' : 'pendente'),
                data_pagamento: i === 0 && form.primeiro_pagamento_confirmado ? new Date().toISOString().split('T')[0] : null,
                forma_pagamento: i === 0 && form.primeiro_pagamento_confirmado ? form.forma_pagamento_inicial : null,
              });
            }
            await supabase.from('mensalidades').insert(mensalidades);
            await supabase.from('log_matriculas').insert({
              matricula_id: matricula.id, aluno_id: novoAluno.id, acao: 'criada',
              observacao: `Modalidades: ${selectedMods.map(id => modalidades.find(m => m.id === id)?.nome).join(', ')} - R$ ${valorTotal.toFixed(2)}`,
            });
          }
        }
      }

      const senhaExibir = cpfDigitos.length >= 6 ? senhaTemp + ' (6 dígitos do CPF)' : 'Gym123 (padrão)';
      alert(`✅ Aluno cadastrado!\n\nE-mail: ${form.email}\nSenha: ${senhaExibir}`);
    }
    setShowModal(false);
    setSelectedMods([]);
    loadAll();
  };

  const handleEdit = (aluno: AlunoFull) => {
    setEditingAluno(aluno);
    const matAtiva = aluno.matriculas?.find((m: any) => m.status === 'ativa' || m.status === 'suspensa');
    const dataInicioMat = matAtiva?.data_inicio || '';
    setForm({ nome: aluno.nome, email: aluno.email, telefone: aluno.telefone, cpf: aluno.cpf || '', data_nascimento: aluno.data_nascimento || '', endereco: aluno.endereco || '', status: aluno.status, convenio_id: aluno.convenio_id || '', observacoes: aluno.observacoes || '', data_inicio: dataInicioMat, dia_vencimento: String((aluno as any).dia_vencimento || '10'), primeiro_pagamento_confirmado: false, forma_pagamento_inicial: 'pix', treino_hipertrofia: (aluno as any).treino_hipertrofia || false });
    setShowModal(true);
  };

  const handleNew = () => {
    setEditingAluno(null);
    setForm({ nome: '', email: '', telefone: '', cpf: '', data_nascimento: '', endereco: '', status: 'ativo', convenio_id: '', observacoes: '', data_inicio: new Date().toISOString().split('T')[0], dia_vencimento: '10', primeiro_pagamento_confirmado: false, forma_pagamento_inicial: 'pix', treino_hipertrofia: false });
    setSelectedMods([]);
    setShowModal(true);
  };

  const handleOpenFicha = async (aluno: AlunoFull) => {
    setFichaAluno(aluno);
    await loadLogMod(aluno.id);
    await loadLogMat(aluno.id);
    setShowFicha(true);
  };

  const handleAddModalidade = async (alunoId: string, modId: string) => {
    await supabase.from('aluno_modalidades').insert({ aluno_id: alunoId, modalidade_id: modId, status: 'ativa' });
    await supabase.from('log_modalidades_aluno').insert({ aluno_id: alunoId, modalidade_id: modId, acao: 'adicionada' });
    loadAll();
    if (fichaAluno) { await loadLogMod(alunoId); setFichaAluno({ ...fichaAluno }); }
    setShowAddMod(false);
  };

  const handleRemoveModalidade = async (alunoId: string, alunoModId: string, modId: string) => {
    const motivo = prompt('Motivo da remoção:');
    if (motivo === null) return;
    await supabase.from('aluno_modalidades').update({ status: 'inativa', data_fim: new Date().toISOString().split('T')[0] }).eq('id', alunoModId);
    await supabase.from('log_modalidades_aluno').insert({ aluno_id: alunoId, modalidade_id: modId, acao: 'removida', observacao: motivo || null });
    loadAll();
    if (fichaAluno) await loadLogMod(alunoId);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este aluno e todos os dados?')) return;
    await supabase.from('alunos').delete().eq('id', id);
    loadAll();
  };

  const handlePausarAtivar = async (aluno: AlunoFull) => {
    const isAtivo = aluno.status === 'ativo';
    const acao = isAtivo ? 'pausar' : 'reativar';
    const motivo = prompt(`Motivo para ${acao} o aluno:`);
    if (motivo === null) return;

    const novoStatus = isAtivo ? 'suspenso' : 'ativo';

    // Atualizar status do aluno
    await supabase.from('alunos').update({ status: novoStatus }).eq('id', aluno.id);

    // Atualizar matrícula
    const matStatus = isAtivo ? 'suspensa' : 'ativa';
    await supabase.from('matriculas').update({ status: matStatus }).eq('aluno_id', aluno.id).in('status', ['ativa', 'suspensa']);

    // Se pausando, cancelar mensalidades futuras pendentes
    if (isAtivo) {
      const hoje = new Date().toISOString().split('T')[0];
      await supabase.from('mensalidades').update({ status: 'cancelado' }).eq('aluno_id', aluno.id).eq('status', 'pendente').gt('data_vencimento', hoje);
    }

    // Log
    const mat = aluno.matriculas?.find(m => m.status === 'ativa' || m.status === 'suspensa');
    if (mat) {
      await supabase.from('log_matriculas').insert({
        matricula_id: mat.id, aluno_id: aluno.id, acao: isAtivo ? 'pausada' : 'ativada', observacao: motivo || null,
      });
    }

    loadAll();
  };

  const toggleMod = (id: string) => setSelectedMods(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);

  const filteredAlunos = alunos.filter((a) => {
    const matchSearch = a.nome.toLowerCase().includes(searchTerm.toLowerCase()) || a.email.toLowerCase().includes(searchTerm.toLowerCase()) || a.telefone.includes(searchTerm);
    const matchStatus = filterStatus === 'todos' || a.status === filterStatus;
    const mods = a.aluno_modalidades?.filter((am: any) => am.status === 'ativa') || [];
    const matchPlano = filterPlano === 'todos' || (filterPlano === 'com' && mods.length > 0) || (filterPlano === 'sem' && mods.length === 0);
    return matchSearch && matchStatus && matchPlano;
  });

  const getAlunoMods = (aluno: AlunoFull) => aluno.aluno_modalidades?.filter(am => am.status === 'ativa') || [];
  const getConvenioNome = (id?: string) => id ? convenios.find(c => c.id === id)?.nome : null;
  const statusBadge = (s: string) => ({ ativo: 'badge-ativo', inadimplente: 'badge-inadimplente', suspenso: 'badge-suspenso', cancelado: 'badge-inadimplente' }[s] || 'badge-ativo');

  return (
    <DashboardLayout activeMenu="alunos" title="Gestão de Alunos">
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="input-field flex-1" />
        <div>
          <label className="block text-xs text-dark-400 mb-1">Plano</label>
          <select value={filterPlano} onChange={(e) => setFilterPlano(e.target.value)} className="input-field w-full sm:w-40">
            <option value="todos">Todos</option>
            <option value="com">Com Plano</option>
            <option value="sem">Sem Plano</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-dark-400 mb-1">Status</label>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="input-field w-full sm:w-40">
            <option value="todos">Todos</option>
            <option value="ativo">Ativos</option>
            <option value="inadimplente">Inadimplentes</option>
            <option value="suspenso">Suspensos</option>
            <option value="cancelado">Cancelados</option>
          </select>
        </div>
        <button onClick={handleNew} className="btn-primary whitespace-nowrap">+ Novo Aluno</button>
      </div>

      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-dark-800">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-dark-400 uppercase">Nome</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-dark-400 uppercase">Modalidades</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-dark-400 uppercase">Início</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-dark-400 uppercase">Mensalidade</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-dark-400 uppercase">Status</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-dark-400 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-100">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-dark-400">Carregando...</td></tr>
              ) : filteredAlunos.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-dark-400">Nenhum aluno encontrado</td></tr>
              ) : (
                filteredAlunos.map((aluno) => {
                  const mods = getAlunoMods(aluno);
                  const matAtiva = aluno.matriculas?.find((m: any) => m.status === 'ativa' || m.status === 'suspensa');
                  return (
                    <tr key={aluno.id} className="hover:bg-dark-800 cursor-pointer" onClick={() => handleOpenFicha(aluno)}>
                      <td className="px-6 py-4">
                        <p className="font-medium text-dark-100">{aluno.nome}</p>
                        <p className="text-sm text-dark-400">{aluno.telefone}</p>
                        <p className="text-xs text-dark-200">Matrícula: #{aluno.id.slice(-6).toUpperCase()}</p>
                      </td>
                      <td className="px-6 py-4">
                        {mods.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {mods.map((am: any) => (
                              <span key={am.id} className="px-2 py-0.5 bg-primary-100 text-primary-700 rounded-full text-xs">{am.modalidades?.nome}</span>
                            ))}
                          </div>
                        ) : <span className="text-dark-200 text-sm">—</span>}
                      </td>
                      <td className="px-6 py-4 text-sm text-dark-200">
                        {matAtiva?.data_inicio ? formatDate(matAtiva.data_inicio) : '—'}
                      </td>
                      <td className="px-6 py-4 text-sm text-primary-400 font-medium">
                        {mods.length > 0 ? `R$ ${mods.reduce((sum: number, am: any) => sum + (Number(am.modalidades?.valor) || 0), 0).toFixed(2)}` : '—'}
                      </td>
                      <td className="px-6 py-4"><span className={statusBadge(aluno.status)}>{aluno.status}</span></td>
                      <td className="px-6 py-4 text-right space-x-2" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => handlePausarAtivar(aluno)} className={`text-sm font-medium ${aluno.status === 'ativo' ? 'text-yellow-600' : 'text-green-600'}`}>
                          {aluno.status === 'ativo' ? '⏸ Pausar' : '▶ Ativar'}
                        </button>
                        <button onClick={() => handleEdit(aluno)} className="text-primary-600 text-sm font-medium">Editar</button>
                        <button onClick={() => handleDelete(aluno.id)} className="text-red-600 text-sm font-medium">Excluir</button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Cadastro/Edição */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-dark-700">
              <h2 className="text-xl font-semibold">{editingAluno ? 'Editar Aluno' : 'Novo Aluno'}</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-dark-200 mb-1">Nome *</label><input type="text" value={form.nome} onChange={(e) => setForm({...form, nome: e.target.value})} className="input-field" required /></div>
                <div><label className="block text-sm font-medium text-dark-200 mb-1">E-mail *</label><input type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} className="input-field" required /></div>
                <div><label className="block text-sm font-medium text-dark-200 mb-1">Telefone *</label><input type="text" value={form.telefone} onChange={(e) => setForm({...form, telefone: e.target.value})} className="input-field" required /></div>
                <div><label className="block text-sm font-medium text-dark-200 mb-1">CPF</label><input type="text" value={form.cpf} onChange={(e) => setForm({...form, cpf: e.target.value})} className="input-field" /></div>
                <div><label className="block text-sm font-medium text-dark-200 mb-1">Data de Nascimento</label><input type="date" value={form.data_nascimento} onChange={(e) => setForm({...form, data_nascimento: e.target.value})} className="input-field" /></div>
                <div><label className="block text-sm font-medium text-dark-200 mb-1">Status</label><select value={form.status} onChange={(e) => setForm({...form, status: e.target.value})} className="input-field"><option value="ativo">Ativo</option><option value="suspenso">Suspenso</option><option value="inadimplente">Inadimplente</option><option value="cancelado">Cancelado</option></select></div>
              </div>

              {/* Data de Início e Dia do Vencimento - sempre visíveis */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-1">📅 Data de Início *</label>
                  <input type="date" value={form.data_inicio} onChange={(e) => {
                    const novaData = e.target.value;
                    const dia = novaData ? novaData.split('-')[2] : '10';
                    setForm({...form, data_inicio: novaData, dia_vencimento: dia});
                  }} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-1">💳 Dia do Vencimento</label>
                  <input type="number" min="1" max="30" value={form.dia_vencimento} onChange={(e) => setForm({...form, dia_vencimento: e.target.value})} className="input-field" placeholder="10" />
                  <p className="text-xs text-dark-400 mt-1">Próximo vencimento: dia {form.dia_vencimento || '—'} do mês seguinte</p>
                </div>
              </div>

              {/* Primeiro pagamento */}
              {!editingAluno && (
                <div className="bg-green-50 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <input type="checkbox" id="primeiro-pag" checked={form.primeiro_pagamento_confirmado} onChange={(e) => setForm({...form, primeiro_pagamento_confirmado: e.target.checked})} className="rounded w-5 h-5" />
                    <label htmlFor="primeiro-pag" className="text-sm font-medium text-green-800">✅ Primeiro pagamento confirmado</label>
                  </div>
                  {form.primeiro_pagamento_confirmado && (
                    <div>
                      <label className="block text-sm font-medium text-green-700 mb-1">Forma de Pagamento</label>
                      <select value={form.forma_pagamento_inicial || ''} onChange={(e) => setForm({...form, forma_pagamento_inicial: e.target.value})} className="input-field">
                        <option value="pix">PIX</option>
                        <option value="transferencia">Transferência</option>
                        <option value="dinheiro">Dinheiro</option>
                        <option value="cartao">Cartão</option>
                      </select>
                    </div>
                  )}
                </div>
              )}
              <div><label className="block text-sm font-medium text-dark-200 mb-1">Endereço</label><input type="text" value={form.endereco} onChange={(e) => setForm({...form, endereco: e.target.value})} className="input-field" /></div>

              {/* Convênio */}
              <div className="bg-blue-50 rounded-xl p-4">
                <label className="block text-sm font-medium text-blue-800 mb-1">🤝 Convênio</label>
                <select value={form.convenio_id} onChange={(e) => setForm({...form, convenio_id: e.target.value})} className="input-field">
                  <option value="">Nenhum</option>
                  {convenios.map((c) => <option key={c.id} value={c.id}>{c.nome} ({c.desconto_percentual}% desc.)</option>)}
                </select>
              </div>

              {/* Treinos Hipertrofia */}
              <div className={`rounded-xl p-4 border-2 transition-colors ${form.treino_hipertrofia ? 'bg-orange-50 border-orange-400' : 'bg-dark-800 border-dark-600'}`}>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={form.treino_hipertrofia} onChange={(e) => setForm({...form, treino_hipertrofia: e.target.checked})} className="rounded w-5 h-5 accent-orange-500" />
                  <div>
                    <p className={`font-medium ${form.treino_hipertrofia ? 'text-orange-800' : 'text-dark-200'}`}>🏋️ Ativar Treinos Hipertrofia</p>
                    <p className={`text-xs ${form.treino_hipertrofia ? 'text-orange-600' : 'text-dark-400'}`}>Módulo especial com treinos guiados por dia da semana (sem custo adicional)</p>
                  </div>
                </label>
              </div>

              {/* Modalidades (só no cadastro novo) */}
              {!editingAluno && (
                <div className="bg-primary-50 rounded-xl p-4">
                  <h3 className="font-medium text-primary-800 mb-3">🏃 Modalidades *</h3>
                  <div className="space-y-2">
                    {modalidades.map((mod) => (
                      <label key={mod.id} className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${selectedMods.includes(mod.id) ? 'bg-primary-100 border border-primary-300' : 'bg-dark-800 border border-dark-700'}`}>
                        <div className="flex items-center gap-3">
                          <input type="checkbox" checked={selectedMods.includes(mod.id)} onChange={() => toggleMod(mod.id)} className="rounded" />
                          <div>
                            <p className="font-medium text-dark-100">{mod.nome}</p>
                            <p className="text-xs text-dark-400">{mod.planos?.nome}</p>
                          </div>
                        </div>
                        <span className="font-medium text-primary-700">R$ {mod.valor ? Number(mod.valor).toFixed(2) : '0.00'}</span>
                      </label>
                    ))}
                  </div>
                  {selectedMods.length > 0 && (
                    <div className="mt-3 p-3 bg-dark-800 rounded-lg border border-primary-200">
                      <p className="text-sm font-medium text-primary-800">
                        Total: R$ {calcValorTotal(selectedMods, form.convenio_id).toFixed(2)}
                        {form.convenio_id && ' (com desconto)'}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div><label className="block text-sm font-medium text-dark-200 mb-1">Observações</label><textarea value={form.observacoes} onChange={(e) => setForm({...form, observacoes: e.target.value})} className="input-field" rows={2} /></div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" className="btn-primary">{editingAluno ? 'Salvar' : 'Cadastrar Aluno'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ficha do Aluno */}
      {showFicha && fichaAluno && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-dark-700 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-semibold">{fichaAluno.nome}</h2>
                <p className="text-sm text-dark-400">{fichaAluno.email} • {fichaAluno.telefone}</p>
                <p className="text-xs text-dark-200">Matrícula #{fichaAluno.id.slice(-6).toUpperCase()}</p>
              </div>
              <span className={statusBadge(fichaAluno.status)}>{fichaAluno.status}</span>
            </div>
            <div className="p-6 space-y-6">
              {/* Modalidades ativas */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-dark-100">🏃 Modalidades Ativas</h3>
                  <button onClick={() => setShowAddMod(true)} className="text-sm text-primary-600 font-medium">+ Adicionar</button>
                </div>
                {(() => {
                  const mods = getAlunoMods(fichaAluno);
                  if (mods.length === 0) return <p className="text-dark-400 text-sm">Nenhuma modalidade.</p>;
                  return (
                    <div className="space-y-2">
                      {mods.map((am: any) => (
                        <div key={am.id} className="flex items-center justify-between p-3 bg-primary-50 rounded-lg">
                          <div>
                            <p className="font-medium text-primary-800">{am.modalidades?.nome}</p>
                            <p className="text-xs text-primary-600">R$ {am.modalidades?.valor ? Number(am.modalidades.valor).toFixed(2) : '—'}</p>
                          </div>
                          <button onClick={() => handleRemoveModalidade(fichaAluno.id, am.id, am.modalidade_id)} className="text-red-500 text-sm">Remover</button>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Log de alterações de modalidades */}
              <div>
                <h3 className="font-medium text-dark-100 mb-3">📝 Histórico de Alterações</h3>
                {logModalidades.length === 0 && logMatricula.length === 0 ? (
                  <p className="text-sm text-dark-400">Nenhum registro.</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {logModalidades.map((log) => (
                      <div key={log.id} className="flex items-start gap-3 p-2 bg-dark-800 rounded-lg text-sm">
                        <span className="text-lg">{log.acao === 'adicionada' ? '➕' : '➖'}</span>
                        <div className="flex-1">
                          <p className="font-medium text-dark-200">{log.modalidades?.nome} — <span className="capitalize">{log.acao}</span></p>
                          {log.observacao && <p className="text-dark-400 text-xs">{log.observacao}</p>}
                        </div>
                        <span className="text-xs text-dark-400">{formatDate(log.data_alteracao)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3">
                <button onClick={() => { handleEdit(fichaAluno); setShowFicha(false); }} className="btn-secondary">✏️ Editar Dados</button>
                <button onClick={() => setShowFicha(false)} className="btn-primary">Fechar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Adicionar Modalidade */}
      {showAddMod && fichaAluno && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-2xl w-full max-w-sm">
            <div className="p-6 border-b border-dark-700">
              <h2 className="text-lg font-semibold">Adicionar Modalidade</h2>
            </div>
            <div className="p-6 space-y-2">
              {modalidades.filter(m => !getAlunoMods(fichaAluno).find((am: any) => am.modalidade_id === m.id)).map(mod => (
                <button key={mod.id} onClick={() => handleAddModalidade(fichaAluno.id, mod.id)} className="w-full flex items-center justify-between p-3 bg-dark-800 rounded-lg hover:bg-primary-50 transition-colors">
                  <span className="font-medium">{mod.nome}</span>
                  <span className="text-sm text-primary-600">R$ {mod.valor ? Number(mod.valor).toFixed(2) : '—'}</span>
                </button>
              ))}
              <button onClick={() => setShowAddMod(false)} className="btn-secondary w-full mt-4">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
