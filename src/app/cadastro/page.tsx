'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function FormularioCadastroPage() {
  const [form, setForm] = useState({
    nome: '', endereco: '', bairro: '', cep: '', cidade: '', telefone: '',
    cpf: '', data_nascimento: '', email: '', dia_vencimento: '', observacoes: '',
    treino_outro: '',
  });
  const [modalidadesDisponiveis, setModalidadesDisponiveis] = useState<any[]>([]);
  const [modalidadesSelecionadas, setModalidadesSelecionadas] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    supabase.from('modalidades').select('id, nome').eq('ativo', true).order('nome').then(({ data }) => {
      if (data) setModalidadesDisponiveis(data);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErro('');

    // Verificar duplicidade por CPF ou e-mail
    const cpfLimpo = form.cpf.replace(/\D/g, '');
    const { data: existente } = await supabase
      .from('pre_cadastros')
      .select('id')
      .or(`cpf.eq.${cpfLimpo},email.eq.${form.email}`)
      .limit(1);

    if (existente && existente.length > 0) {
      setErro('Este CPF ou e-mail já foi cadastrado. Você não pode preencher mais de uma vez.');
      setLoading(false);
      return;
    }

    // Também verificar na tabela de alunos
    const { data: alunoExiste } = await supabase
      .from('alunos')
      .select('id')
      .or(`cpf.eq.${cpfLimpo},email.eq.${form.email}`)
      .limit(1);

    if (alunoExiste && alunoExiste.length > 0) {
      setErro('Você já está cadastrado no sistema. Entre em contato com a academia.');
      setLoading(false);
      return;
    }

    const modsSelecionadasNomes = modalidadesDisponiveis.filter(m => modalidadesSelecionadas.includes(m.id)).map(m => m.nome);
    const obsCompleta = [
      modsSelecionadasNomes.length > 0 ? `Treinos: ${modsSelecionadasNomes.join(', ')}` : '',
      form.treino_outro ? `Treino outro: ${form.treino_outro}` : '',
      form.observacoes || '',
    ].filter(Boolean).join(' | ');

    const { error } = await supabase.from('pre_cadastros').insert({
      nome: form.nome,
      endereco: form.endereco || null,
      bairro: form.bairro || null,
      cep: form.cep || null,
      cidade: form.cidade || null,
      telefone: form.telefone,
      cpf: cpfLimpo,
      data_nascimento: form.data_nascimento || null,
      email: form.email,
      dia_vencimento: form.dia_vencimento ? parseInt(form.dia_vencimento) : null,
      observacoes: obsCompleta || null,
    });

    if (error) { setErro('Erro ao enviar: ' + error.message); setLoading(false); return; }
    setEnviado(true);
    setLoading(false);
  };

  if (enviado) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black px-4">
        <div className="card max-w-md text-center">
          <img src="/IC.png" alt="MyGym" className="w-16 h-16 mx-auto mb-4 rounded-xl" />
          <h2 className="text-xl font-bold text-dark-100 mb-2">Cadastro Enviado!</h2>
          <p className="text-dark-400">Seus dados foram recebidos. A academia irá analisar e entrar em contato.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black px-4 py-8">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-8">
          <img src="/IC.png" alt="MyGym" className="w-20 h-20 mx-auto mb-4 rounded-xl" />
          <h1 className="text-2xl font-bold text-dark-100">Atualização de Cadastro</h1>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-200 mb-1">Nome Completo *</label>
            <input type="text" value={form.nome} onChange={(e) => setForm({...form, nome: e.target.value})} className="input-field" required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1">CPF *</label>
              <input type="text" value={form.cpf} onChange={(e) => setForm({...form, cpf: e.target.value})} className="input-field" placeholder="000.000.000-00" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1">Data de Nascimento</label>
              <input type="date" value={form.data_nascimento} onChange={(e) => setForm({...form, data_nascimento: e.target.value})} className="input-field" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1">Telefone *</label>
              <input type="text" value={form.telefone} onChange={(e) => setForm({...form, telefone: e.target.value})} className="input-field" placeholder="(00) 00000-0000" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1">E-mail *</label>
              <input type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} className="input-field" required />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-200 mb-1">Endereço</label>
            <input type="text" value={form.endereco} onChange={(e) => setForm({...form, endereco: e.target.value})} className="input-field" placeholder="Rua, número" />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1">Bairro</label>
              <input type="text" value={form.bairro} onChange={(e) => setForm({...form, bairro: e.target.value})} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1">CEP</label>
              <input type="text" value={form.cep} onChange={(e) => setForm({...form, cep: e.target.value})} className="input-field" placeholder="00000-000" />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1">Cidade</label>
              <input type="text" value={form.cidade} onChange={(e) => setForm({...form, cidade: e.target.value})} className="input-field" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-200 mb-1">Dia do vencimento da mensalidade</label>
            <input type="number" min="1" max="30" value={form.dia_vencimento} onChange={(e) => setForm({...form, dia_vencimento: e.target.value})} className="input-field" placeholder="Ex: 10" />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-200 mb-2">Selecione seu(s) treino(s)</label>
            <div className="space-y-2">
              {modalidadesDisponiveis.map((mod) => (
                <label key={mod.id} className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${modalidadesSelecionadas.includes(mod.id) ? 'bg-primary-900/30 border border-primary-600' : 'bg-dark-700 border border-dark-600'}`}>
                  <input type="checkbox" checked={modalidadesSelecionadas.includes(mod.id)} onChange={() => setModalidadesSelecionadas(prev => prev.includes(mod.id) ? prev.filter(id => id !== mod.id) : [...prev, mod.id])} className="rounded" />
                  <span className="text-dark-200">{mod.nome}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-200 mb-1">Não encontrou seu treino? Descreva</label>
            <input type="text" value={form.treino_outro} onChange={(e) => setForm({...form, treino_outro: e.target.value})} className="input-field" placeholder="Descreva o treino desejado" />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-200 mb-1">Observações</label>
            <textarea value={form.observacoes} onChange={(e) => setForm({...form, observacoes: e.target.value})} className="input-field" rows={3} placeholder="Alguma informação adicional..." />
          </div>

          {erro && <div className="bg-red-900/30 text-red-400 text-sm p-3 rounded-lg">{erro}</div>}

          <button type="submit" disabled={loading} className="btn-primary w-full py-3">
            {loading ? 'Enviando...' : 'Enviar Cadastro'}
          </button>
        </form>

        <p className="text-center text-dark-400 text-xs mt-6">MyGym — Sistema de Gestão para Academias</p>
      </div>
    </div>
  );
}
