'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import DashboardLayout from '@/components/DashboardLayout';

export default function ConfiguracoesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    nome_academia: '',
    endereco: '',
    telefone: '',
    whatsapp_academia: '',
    pix_chave: '',
    pix_tipo: '',
    pix_beneficiario: '',
    banco_nome: '',
    banco_agencia: '',
    banco_conta: '',
    banco_tipo_conta: '',
    banco_beneficiario: '',
    mensagem_cobranca: '',
  });

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    const { data } = await supabase.from('configuracoes').select('*').single();
    if (data) {
      setForm({
        nome_academia: data.nome_academia || '',
        endereco: data.endereco || '',
        telefone: data.telefone || '',
        whatsapp_academia: data.whatsapp_academia || '',
        pix_chave: data.pix_chave || '',
        pix_tipo: data.pix_tipo || '',
        pix_beneficiario: data.pix_beneficiario || '',
        banco_nome: data.banco_nome || '',
        banco_agencia: data.banco_agencia || '',
        banco_conta: data.banco_conta || '',
        banco_tipo_conta: data.banco_tipo_conta || '',
        banco_beneficiario: data.banco_beneficiario || '',
        mensagem_cobranca: data.mensagem_cobranca || '',
      });
    }
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    // Converter campos vazios para null
    const payload: any = {};
    Object.entries(form).forEach(([key, value]) => {
      payload[key] = value === '' ? null : value;
    });

    await supabase
      .from('configuracoes')
      .update(payload)
      .not('id', 'is', null);

    setSaving(false);
    alert('Configurações salvas!');
  };

  if (loading) {
    return (
      <DashboardLayout activeMenu="configuracoes" title="Configurações">
        <div className="card animate-pulse">
          <div className="h-6 bg-dark-700 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-dark-700 rounded w-2/3"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout activeMenu="configuracoes" title="Configurações">
      <form onSubmit={handleSave} className="space-y-8 max-w-3xl">
        {/* Dados da Academia */}
        <div className="card">
          <h2 className="text-lg font-semibold text-dark-100 mb-4">🏢 Dados da Academia</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1">Nome da Academia</label>
              <input
                type="text"
                value={form.nome_academia}
                onChange={(e) => setForm({...form, nome_academia: e.target.value})}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1">Telefone</label>
              <input
                type="text"
                value={form.telefone}
                onChange={(e) => setForm({...form, telefone: e.target.value})}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1">WhatsApp (para receber comprovantes)</label>
              <input
                type="text"
                value={form.whatsapp_academia}
                onChange={(e) => setForm({...form, whatsapp_academia: e.target.value})}
                className="input-field"
                placeholder="5518999999999"
              />
              <p className="text-xs text-dark-400 mt-1">Número com DDD+DDI que o aluno usará para enviar comprovantes</p>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-dark-200 mb-1">Endereço</label>
              <input
                type="text"
                value={form.endereco}
                onChange={(e) => setForm({...form, endereco: e.target.value})}
                className="input-field"
              />
            </div>
          </div>
        </div>

        {/* PIX */}
        <div className="card">
          <h2 className="text-lg font-semibold text-dark-100 mb-2">💲 Dados do PIX</h2>
          <p className="text-sm text-dark-400 mb-4">
            Estas informações ficarão visíveis na área do aluno para pagamento.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1">Tipo da Chave</label>
              <select
                value={form.pix_tipo}
                onChange={(e) => setForm({...form, pix_tipo: e.target.value})}
                className="input-field"
              >
                <option value="">Selecione</option>
                <option value="cpf">CPF</option>
                <option value="cnpj">CNPJ</option>
                <option value="email">E-mail</option>
                <option value="telefone">Telefone</option>
                <option value="aleatoria">Chave Aleatória</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1">Chave PIX</label>
              <input
                type="text"
                value={form.pix_chave}
                onChange={(e) => setForm({...form, pix_chave: e.target.value})}
                className="input-field"
                placeholder="Sua chave PIX"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-dark-200 mb-1">Beneficiário</label>
              <input
                type="text"
                value={form.pix_beneficiario}
                onChange={(e) => setForm({...form, pix_beneficiario: e.target.value})}
                className="input-field"
                placeholder="Nome do beneficiário"
              />
            </div>
          </div>
        </div>

        {/* Conta Bancária */}
        <div className="card">
          <h2 className="text-lg font-semibold text-dark-100 mb-2">🏦 Conta Bancária</h2>
          <p className="text-sm text-dark-400 mb-4">
            Opcional — exibido como alternativa ao PIX na área do aluno.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1">Banco</label>
              <input
                type="text"
                value={form.banco_nome}
                onChange={(e) => setForm({...form, banco_nome: e.target.value})}
                className="input-field"
                placeholder="Ex: Nubank, Bradesco"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1">Tipo de Conta</label>
              <select
                value={form.banco_tipo_conta}
                onChange={(e) => setForm({...form, banco_tipo_conta: e.target.value})}
                className="input-field"
              >
                <option value="">Selecione</option>
                <option value="corrente">Corrente</option>
                <option value="poupanca">Poupança</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1">Agência</label>
              <input
                type="text"
                value={form.banco_agencia}
                onChange={(e) => setForm({...form, banco_agencia: e.target.value})}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1">Conta</label>
              <input
                type="text"
                value={form.banco_conta}
                onChange={(e) => setForm({...form, banco_conta: e.target.value})}
                className="input-field"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-dark-200 mb-1">Beneficiário</label>
              <input
                type="text"
                value={form.banco_beneficiario}
                onChange={(e) => setForm({...form, banco_beneficiario: e.target.value})}
                className="input-field"
              />
            </div>
          </div>
        </div>

        {/* Mensagem de Cobrança */}
        <div className="card">
          <h2 className="text-lg font-semibold text-dark-100 mb-2">📲 Mensagem de Cobrança (WhatsApp)</h2>
          <div>
            <textarea
              value={form.mensagem_cobranca}
              onChange={(e) => setForm({...form, mensagem_cobranca: e.target.value})}
              className="input-field"
              rows={4}
            />
            <p className="text-xs text-dark-400 mt-2">
              Variáveis: <code className="bg-dark-700 px-1 rounded">{'{nome}'}</code>{' '}
              <code className="bg-dark-700 px-1 rounded">{'{valor}'}</code>{' '}
              <code className="bg-dark-700 px-1 rounded">{'{vencimento}'}</code>
            </p>
          </div>
        </div>

        <button type="submit" disabled={saving} className="btn-primary px-8 py-3">
          {saving ? 'Salvando...' : '💾 Salvar Configurações'}
        </button>
      </form>
    </DashboardLayout>
  );
}
