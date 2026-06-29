'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams } from 'next/navigation';

export default function AcademiaLoginPage() {
  const params = useParams();
  const slug = params?.slug as string;

  const [academia, setAcademia] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    if (slug) loadAcademia();
  }, [slug]);

  const loadAcademia = async () => {
    const { data, error } = await supabase
      .from('academias')
      .select('id, nome, slug, logo_url, cor_primaria, status')
      .eq('slug', slug)
      .single();

    if (error || !data) {
      setNotFound(true);
    } else {
      setAcademia(data);
      localStorage.setItem('academia_id', data.id);
      localStorage.setItem('academia_slug', data.slug);
      localStorage.setItem('academia_nome', data.nome);
    }
    setLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoggingIn(true);

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password: senha });

    if (authError) {
      setError('E-mail ou senha incorretos.');
      setLoggingIn(false);
      return;
    }

    if (data.user) {
      const { data: profile } = await supabase.from('profiles').select('role, academia_id').eq('id', data.user.id).single();

      if (profile) {
        if (profile.academia_id && profile.academia_id !== academia.id) {
          setError('Este usuário não pertence a esta academia.');
          await supabase.auth.signOut();
          setLoggingIn(false);
          return;
        }

        switch (profile.role) {
          case 'admin': window.location.href = '/dashboard/'; break;
          case 'professor': window.location.href = '/professor/'; break;
          case 'aluno': window.location.href = '/aluno/'; break;
          default: window.location.href = '/dashboard/';
        }
      } else {
        const role = data.user.user_metadata?.role || 'admin';
        if (role === 'admin') window.location.href = '/dashboard/';
        else if (role === 'professor') window.location.href = '/professor/';
        else window.location.href = '/aluno/';
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="card text-center max-w-sm">
          <span className="text-4xl block mb-4">❌</span>
          <h1 className="text-xl font-bold text-dark-100 mb-2">Academia não encontrada</h1>
          <p className="text-dark-400">O link que você acessou não corresponde a nenhuma academia cadastrada.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          {academia.logo_url ? (
            <img src={academia.logo_url} alt={academia.nome} className="w-16 h-16 mx-auto mb-4 rounded-xl" />
          ) : (
            <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-primary-600 flex items-center justify-center">
              <span className="text-2xl font-bold text-white">{academia.nome.charAt(0)}</span>
            </div>
          )}
          <h1 className="text-2xl font-bold text-dark-100">{academia.nome}</h1>
          <p className="text-sm text-dark-400 mt-1">Sistema de Gestão</p>
        </div>

        <div className="card">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1">E-mail</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-field" placeholder="seu@email.com" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1">Senha</label>
              <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} className="input-field" placeholder="••••••••" required />
            </div>

            {error && <div className="p-3 bg-red-900/30 text-red-400 rounded-lg text-sm text-center">{error}</div>}

            <button type="submit" disabled={loggingIn} className="btn-primary w-full py-3">
              {loggingIn ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-dark-500 mt-6">
          Powered by <span className="text-primary-400 font-medium">MyGym</span>
        </p>
      </div>
    </div>
  );
}
