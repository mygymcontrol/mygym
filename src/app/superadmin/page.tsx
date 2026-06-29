'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabase-admin';

const RESEND_API_KEY = 're_TrzFz4ti_9FLbF42seMU5H7QRUTH5huh8';

interface Academia {
  id: string;
  nome: string;
  slug: string;
  email_proprietario: string;
  status: string;
  created_at: string;
}

export default function SuperAdminPage() {
  const [academias, setAcademias] = useState<Academia[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [authorized, setAuthorized] = useState(false);

  const [form, setForm] = useState({ nome: '', slug: '', email: '' });

  useEffect(() => { checkAuth(); }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = '/'; return; }

    // Verificar se é super admin
    const { data: sa } = await supabase.from('super_admins').select('id').eq('user_id', user.id).single();
    if (!sa) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (profile?.role !== 'admin') {
        window.location.href = '/';
        return;
      }
    }
    setAuthorized(true);
    loadAcademias();
  };

  const loadAcademias = async () => {
    const { data } = await supabase.from('academias').select('*').order('created_at', { ascending: false });
    if (data) setAcademias(data);
    setLoading(false);
  };

  const generateSlug = (nome: string) => {
    return nome.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const handleNomeChange = (nome: string) => {
    setForm({ ...form, nome, slug: generateSlug(nome) });
  };

  const sendEmail = async (to: string, nome: string, slug: string, senha: string) => {
    const baseUrl = window.location.origin;
    const loginUrl = `${baseUrl}/academia/${slug}/`;

    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'MyGym <onboarding@resend.dev>',
          to,
          subject: `🏋️ Sua academia "${nome}" está pronta no MyGym!`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #16a34a; margin: 0;">MyGym</h1>
                <p style="color: #666;">Sistema de Gestão para Academias</p>
              </div>
              <h2 style="color: #333;">Olá! Sua academia está pronta! 🎉</h2>
              <p>A academia <strong>${nome}</strong> foi criada com sucesso no MyGym.</p>
              <div style="background: #f0fdf4; border: 1px solid #16a34a; border-radius: 12px; padding: 20px; margin: 20px 0;">
                <h3 style="color: #16a34a; margin-top: 0;">Dados de Acesso</h3>
                <p><strong>Link:</strong> <a href="${loginUrl}">${loginUrl}</a></p>
                <p><strong>E-mail:</strong> ${to}</p>
                <p><strong>Senha temporária:</strong> ${senha}</p>
              </div>
              <p style="color: #666; font-size: 14px;">Acesse o link, faça login e comece a configurar: modalidades, planos e alunos.</p>
              <p style="color: #999; font-size: 12px; margin-top: 30px; text-align: center;">Recomendamos trocar a senha no primeiro acesso.</p>
            </div>
          `,
        }),
      });
    } catch (err) {
      console.error('Erro ao enviar e-mail:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setResult(null);

    try {
      // Verificar slug
      const { data: existing } = await supabase.from('academias').select('id').eq('slug', form.slug).single();
      if (existing) { setResult({ error: 'Slug já está em uso.' }); setCreating(false); return; }

      // Senha temporária
      const senhaTemp = Math.random().toString(36).slice(-8) + 'A1!';

      // Criar usuário auth
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: form.email, password: senhaTemp, email_confirm: true,
        user_metadata: { nome: form.nome, role: 'admin' },
      });

      if (authError) { setResult({ error: authError.message }); setCreating(false); return; }
      const userId = authUser.user!.id;

      // Criar academia
      const { data: academia, error: acadError } = await supabase.from('academias').insert({
        nome: form.nome, slug: form.slug, email_proprietario: form.email,
        proprietario_id: userId, status: 'ativa',
      }).select().single();

      if (acadError) { setResult({ error: acadError.message }); setCreating(false); return; }

      // Criar profile
      await supabase.from('profiles').upsert({
        id: userId, email: form.email, nome: form.nome, role: 'admin', academia_id: academia.id,
      });

      // Criar configurações padrão
      await supabase.from('configuracoes').insert({ academia_id: academia.id, nome_academia: form.nome });

      // Enviar e-mail
      await sendEmail(form.email, form.nome, form.slug, senhaTemp);

      const loginUrl = `${window.location.origin}/academia/${form.slug}/`;
      setResult({ success: true, academia: { nome: form.nome, email: form.email }, loginUrl, senhaTemp });
      loadAcademias();
    } catch (err: any) {
      setResult({ error: err.message });
    } finally {
      setCreating(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  if (!authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <header className="bg-dark-800 border-b border-dark-700">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚡</span>
            <div>
              <h1 className="font-bold text-lg text-dark-100">MyGym — Super Admin</h1>
              <p className="text-xs text-dark-400">Gerenciamento de Academias</p>
            </div>
          </div>
          <button onClick={handleLogout} className="text-sm text-dark-400 hover:text-red-400">Sair</button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="card">
            <p className="text-sm text-dark-400">Total de Academias</p>
            <p className="text-3xl font-bold text-primary-400">{academias.length}</p>
          </div>
          <div className="card">
            <p className="text-sm text-dark-400">Ativas</p>
            <p className="text-3xl font-bold text-green-400">{academias.filter(a => a.status === 'ativa').length}</p>
          </div>
          <div className="card">
            <p className="text-sm text-dark-400">Pendentes</p>
            <p className="text-3xl font-bold text-yellow-400">{academias.filter(a => a.status === 'pendente').length}</p>
          </div>
        </div>

        {/* Botão + Lista */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-dark-100">Academias</h2>
          <button onClick={() => { setShowModal(true); setForm({ nome: '', slug: '', email: '' }); setResult(null); }} className="btn-primary">
            + Nova Academia
          </button>
        </div>

        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-dark-800">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-medium text-dark-400 uppercase">Academia</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-dark-400 uppercase">Slug / Link</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-dark-400 uppercase">Proprietário</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-dark-400 uppercase">Status</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-dark-400 uppercase">Criada em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700">
                {loading ? (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-dark-400">Carregando...</td></tr>
                ) : academias.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-dark-400">Nenhuma academia cadastrada</td></tr>
                ) : (
                  academias.map((acad) => (
                    <tr key={acad.id} className="hover:bg-dark-800">
                      <td className="px-6 py-4 font-medium text-dark-100">{acad.nome}</td>
                      <td className="px-6 py-4">
                        <code className="text-xs bg-dark-700 px-2 py-1 rounded text-primary-400">/academia/{acad.slug}</code>
                      </td>
                      <td className="px-6 py-4 text-sm text-dark-300">{acad.email_proprietario}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          acad.status === 'ativa' ? 'bg-green-900/30 text-green-400' :
                          acad.status === 'pendente' ? 'bg-yellow-900/30 text-yellow-400' :
                          'bg-red-900/30 text-red-400'
                        }`}>{acad.status}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-dark-400">
                        {new Date(acad.created_at).toLocaleDateString('pt-BR')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Nova Academia */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-2xl w-full max-w-md">
            <div className="p-6 border-b border-dark-700">
              <h2 className="text-xl font-semibold text-dark-100">Nova Academia</h2>
              <p className="text-sm text-dark-400 mt-1">O proprietário receberá um e-mail com os dados de acesso.</p>
            </div>

            {!result?.success ? (
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-1">Nome da Academia *</label>
                  <input
                    type="text"
                    value={form.nome}
                    onChange={(e) => handleNomeChange(e.target.value)}
                    className="input-field"
                    placeholder="Ex: Power Fitness"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-1">Slug (URL) *</label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-dark-400">/academia/</span>
                    <input
                      type="text"
                      value={form.slug}
                      onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                      className="input-field flex-1"
                      placeholder="power-fitness"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-1">E-mail do Proprietário *</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="input-field"
                    placeholder="proprietario@email.com"
                    required
                  />
                </div>

                {result?.error && (
                  <div className="p-3 bg-red-900/30 text-red-400 rounded-lg text-sm">{result.error}</div>
                )}

                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
                  <button type="submit" disabled={creating} className="btn-primary">
                    {creating ? 'Criando...' : '🚀 Criar Academia'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-6 space-y-4">
                <div className="text-center py-4">
                  <span className="text-4xl block mb-2">✅</span>
                  <h3 className="text-lg font-semibold text-dark-100">Academia Criada!</h3>
                </div>
                <div className="bg-green-900/20 border border-green-800 rounded-xl p-4 space-y-2">
                  <p className="text-sm text-dark-200"><strong>Link:</strong> <code className="text-primary-400">{result.loginUrl}</code></p>
                  <p className="text-sm text-dark-200"><strong>E-mail:</strong> {result.academia.email}</p>
                  <p className="text-sm text-dark-200"><strong>Senha:</strong> <code className="text-yellow-400">{result.senhaTemp}</code></p>
                </div>
                <p className="text-xs text-dark-400 text-center">Um e-mail foi enviado ao proprietário com estas informações.</p>
                <button onClick={() => setShowModal(false)} className="btn-primary w-full">Fechar</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
