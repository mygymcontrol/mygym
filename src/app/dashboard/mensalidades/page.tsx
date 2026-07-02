'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatDate } from '@/lib/utils';
import { renovarMensalidades } from '@/lib/renovar-mensalidades';
import DashboardLayout from '@/components/DashboardLayout';

interface MensalidadeComAluno {
  id: string;
  valor: number;
  data_vencimento: string;
  data_pagamento?: string;
  status: string;
  forma_pagamento?: string;
  comprovante_url?: string;
  observacoes?: string;
  aluno_id: string;
  alunos: { nome: string; telefone: string; email: string };
}

export default function MensalidadesPage() {
  const [mensalidades, setMensalidades] = useState<MensalidadeComAluno[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [mensagemCobranca, setMensagemCobranca] = useState('');
  const [showConfigMsg, setShowConfigMsg] = useState(false);
  const [showPagamento, setShowPagamento] = useState(false);
  const [selectedMensalidade, setSelectedMensalidade] = useState<MensalidadeComAluno | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const [pagForm, setPagForm] = useState({
    forma_pagamento: 'pix',
    observacoes: '',
    comprovante: null as File | null,
  });

  useEffect(() => {
    loadMensalidades();
    loadMensagemCobranca();
  }, []);

  const loadMensalidades = async () => {
    // Renovar mensalidades (gerar novas, marcar vencidas)
    try { await renovarMensalidades(); } catch (e) { console.error('Erro renovação:', e); }

    // Buscar todas mensalidades
    const { data } = await supabase
      .from('mensalidades')
      .select('*, alunos(nome, telefone, email)')
      .order('data_vencimento', { ascending: false });

    if (data) {
      // Mostrar: todas do mês atual (qualquer status) + atrasadas de meses anteriores
      const hoje = new Date();
      const mesAtual = hoje.getMonth() + 1;
      const anoAtual = hoje.getFullYear();

      const filtered = data.filter((m: any) => {
        if (m.status === 'atrasado') return true;
        const [ano, mes] = m.data_vencimento.split('-').map(Number);
        if (ano === anoAtual && mes === mesAtual) return true;
        return false;
      });
      setMensalidades(filtered as any);
    }
    setLoading(false);
  };

  const loadMensagemCobranca = async () => {
    const { data } = await supabase.from('configuracoes').select('mensagem_cobranca').single();
    if (data) setMensagemCobranca(data.mensagem_cobranca || '');
  };

  const saveMensagemCobranca = async () => {
    await supabase.from('configuracoes').update({ mensagem_cobranca: mensagemCobranca }).not('id', 'is', null);
    setShowConfigMsg(false);
  };

  const openPagamento = (m: MensalidadeComAluno) => {
    setSelectedMensalidade(m);
    setPagForm({ forma_pagamento: 'pix', observacoes: '', comprovante: null });
    setShowPagamento(true);
  };

  const handleConfirmarPagamento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMensalidade) return;

    // Bloquear se já está pago
    if (selectedMensalidade.status === 'pago') {
      alert('Esta mensalidade já foi confirmada como paga.');
      setShowPagamento(false);
      return;
    }

    setUploading(true);

    let comprovanteUrl = null;

    // Upload do comprovante se existir
    if (pagForm.comprovante) {
      const ext = pagForm.comprovante.name.split('.').pop();
      const fileName = `comprovantes/${selectedMensalidade.id}_${Date.now()}.${ext}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('mygym')
        .upload(fileName, pagForm.comprovante);

      if (!uploadError && uploadData) {
        const { data: urlData } = supabase.storage.from('mygym').getPublicUrl(fileName);
        comprovanteUrl = urlData.publicUrl;
      }
    }

    // Atualizar mensalidade (só se não está paga - double check)
    await supabase.from('mensalidades').update({
      status: 'pago',
      data_pagamento: new Date().toISOString().split('T')[0],
      forma_pagamento: pagForm.forma_pagamento,
      comprovante_url: comprovanteUrl,
      observacoes: pagForm.observacoes || null,
    }).eq('id', selectedMensalidade.id).neq('status', 'pago');

    setUploading(false);
    setShowPagamento(false);
    loadMensalidades();
  };

  const enviarWhatsApp = (m: MensalidadeComAluno) => {
    const telefone = m.alunos.telefone.replace(/\D/g, '');
    const msg = mensagemCobranca
      .replace('{nome}', m.alunos.nome)
      .replace('{valor}', Number(m.valor).toFixed(2))
      .replace('{vencimento}', formatDate(m.data_vencimento));
    window.open(`https://wa.me/${telefone}?text=${encodeURIComponent(msg)}`, '_blank');

    supabase.from('notificacoes_whatsapp').insert({
      aluno_id: m.aluno_id,
      mensagem: msg,
      tipo: 'cobranca',
      status: 'enviada',
    });
  };

  const enviarParaSelecionados = () => {
    const selecionadas = mensalidades.filter(m => selectedIds.includes(m.id));
    selecionadas.forEach((m, i) => { setTimeout(() => enviarWhatsApp(m), i * 500); });
    setSelectedIds([]);
  };

  const toggleSelect = (id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  const selectAll = () => {
    const filtered = filteredMensalidades.map(m => m.id);
    setSelectedIds(selectedIds.length === filtered.length ? [] : filtered);
  };

  const filteredMensalidades = mensalidades.filter(m => {
    const matchStatus = filterStatus === 'todos' || m.status === filterStatus;
    const matchSearch = !searchTerm || m.alunos?.nome?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchStatus && matchSearch;
  });

  return (
    <DashboardLayout activeMenu="mensalidades" title="Mensalidades">
      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <input type="text" placeholder="Buscar aluno..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="input-field flex-1" />
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="input-field w-full sm:w-48">
          <option value="todos">Todos</option>
          <option value="pendente">A vencer</option>
          <option value="atrasado">Atrasadas</option>
          <option value="pago">Pagas</option>
          <option value="cancelado">Canceladas</option>
        </select>
        <div className="flex gap-2 ml-auto">
          <button onClick={() => setShowConfigMsg(true)} className="btn-secondary"><img src="/icons/configuracoes.jpg" alt="" className="w-4 h-4 inline rounded" /> Mensagem</button>
          <button onClick={() => { if (selectedIds.length === 0) { alert('Selecione pelo menos um aluno.'); return; } enviarParaSelecionados(); }} className="btn-primary bg-green-600 hover:bg-green-700">
            <img src="/icons/whatsapp.png" alt="" className="w-4 h-4 inline rounded" /> Enviar WhatsApp {selectedIds.length > 0 && `(${selectedIds.length})`}
          </button>
        </div>
      </div>

      {/* Tabela */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-dark-800">
              <tr>
                <th className="px-4 py-3"><input type="checkbox" onChange={selectAll} checked={selectedIds.length === filteredMensalidades.length && filteredMensalidades.length > 0} className="rounded" /></th>
                <th className="text-left px-4 py-3 text-xs font-medium text-dark-400 uppercase">Aluno</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-dark-400 uppercase">Valor</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-dark-400 uppercase">Vencimento</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-dark-400 uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-dark-400 uppercase">Comprovante</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-dark-400 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-100">
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-dark-400">Carregando...</td></tr>
              ) : filteredMensalidades.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-dark-400">Nenhuma mensalidade encontrada</td></tr>
              ) : (
                filteredMensalidades.map((m) => (
                  <tr key={m.id} className="hover:bg-dark-800">
                    <td className="px-4 py-3"><input type="checkbox" checked={selectedIds.includes(m.id)} onChange={() => toggleSelect(m.id)} className="rounded" /></td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-dark-100">{m.alunos?.nome}</p>
                      <p className="text-xs text-dark-400">{m.alunos?.telefone}</p>
                    </td>
                    <td className="px-4 py-3 font-medium">R$ {Number(m.valor).toFixed(2)}</td>
                    <td className="px-4 py-3 text-dark-200">{formatDate(m.data_vencimento)}</td>
                    <td className="px-4 py-3"><span className={`badge-${m.status === 'pago' ? 'pago' : m.status === 'atrasado' ? 'inadimplente' : 'pendente'}`}>{m.status === 'pendente' ? 'A vencer' : m.status === 'pago' ? 'Pago' : m.status}</span></td>
                    <td className="px-4 py-3">
                      {m.comprovante_url ? (
                        <a href={m.comprovante_url} target="_blank" className="text-primary-600 text-sm underline">Ver</a>
                      ) : <span className="text-dark-200 text-sm">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right space-x-1">
                      {m.status !== 'pago' && (
                        <>
                          <button onClick={() => openPagamento(m)} className="text-green-600 hover:text-green-700 text-sm font-medium">💰 Confirmar Pagamento</button>
                          <button onClick={() => enviarWhatsApp(m)} className="text-green-600 hover:text-green-700 text-sm font-medium">📲</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Confirmar Pagamento */}
      {showPagamento && selectedMensalidade && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-2xl w-full max-w-md">
            <div className="p-6 border-b border-dark-700">
              <h2 className="text-xl font-semibold">Registrar Pagamento</h2>
              <p className="text-sm text-dark-400 mt-1">
                {selectedMensalidade.alunos?.nome} • R$ {Number(selectedMensalidade.valor).toFixed(2)}
              </p>
            </div>
            <form onSubmit={handleConfirmarPagamento} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-1">Forma de Pagamento</label>
                <select value={pagForm.forma_pagamento} onChange={(e) => setPagForm({...pagForm, forma_pagamento: e.target.value})} className="input-field">
                  <option value="pix">PIX</option>
                  <option value="transferencia">Transferência</option>
                  <option value="dinheiro">Dinheiro</option>
                  <option value="cartao">Cartão</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-200 mb-1">Comprovante (opcional)</label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setPagForm({...pagForm, comprovante: e.target.files?.[0] || null})}
                  className="input-field"
                />
                <p className="text-xs text-dark-400 mt-1">Imagem ou PDF do comprovante</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-200 mb-1">Observações</label>
                <textarea value={pagForm.observacoes} onChange={(e) => setPagForm({...pagForm, observacoes: e.target.value})} className="input-field" rows={2} placeholder="Ex: Pagamento via PIX, comprovante recebido por WhatsApp" />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowPagamento(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" disabled={uploading} className="btn-primary">
                  {uploading ? 'Salvando...' : '✓ Confirmar Pagamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Mensagem */}
      {showConfigMsg && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-2xl w-full max-w-lg">
            <div className="p-6 border-b border-dark-700"><h2 className="text-xl font-semibold">Mensagem de Cobrança</h2></div>
            <div className="p-6 space-y-4">
              <textarea value={mensagemCobranca} onChange={(e) => setMensagemCobranca(e.target.value)} className="input-field" rows={5} />
              <p className="text-xs text-dark-400">Variáveis: <code className="bg-dark-700 px-1 rounded">{'{nome}'}</code> <code className="bg-dark-700 px-1 rounded">{'{valor}'}</code> <code className="bg-dark-700 px-1 rounded">{'{vencimento}'}</code></p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowConfigMsg(false)} className="btn-secondary">Cancelar</button>
                <button onClick={saveMensagemCobranca} className="btn-primary">Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
