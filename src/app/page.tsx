'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [error, setError] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [nome, setNome] = useState('');
  const [nomeAcademia, setNomeAcademia] = useState('');

  useEffect(() => {
    checkExistingSession();
    loadNomeAcademia();
  }, []);

  const loadNomeAcademia = async () => {
    const { data } = await supabase.from('configuracoes').select('nome_academia').single();
    if (data?.nome_academia) setNomeAcademia(data.nome_academia);
  };

  const checkExistingSession = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await redirectByRole(user.id);
    }
    setCheckingAuth(false);
  };

  const redirectByRole = async (userId: string) => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (profile?.role === 'aluno') {
      window.location.href = '/aluno/';
    } else if (profile?.role === 'professor') {
      window.location.href = '/professor/';
    } else {
      window.location.href = '/dashboard/';
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      if (data.user) {
        await redirectByRole(data.user.id);
      }
    } catch (err: any) {
      setError(err.message === 'Invalid login credentials'
        ? 'E-mail ou senha incorretos.'
        : err.message || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { nome, role: 'admin' },
        },
      });

      if (error) throw error;
      alert('Conta criada com sucesso! Faça login.');
      setIsSignUp(false);
    } catch (err: any) {
      setError(err.message || 'Erro ao criar conta');
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-600 to-primary-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
          <p className="mt-4 text-white/80">Verificando sessão...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-between bg-black px-4 py-8">
      {/* Spacer topo */}
      <div></div>

      {/* Centro: logo + nome academia + form */}
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/IC.png" alt="MyGym" className="w-28 h-28 mx-auto mb-4 rounded-2xl" />
          {nomeAcademia && <h1 className="text-2xl font-bold text-white">{nomeAcademia}</h1>}
        </div>

        {/* Form */}
        <div className="bg-black rounded-2xl shadow-xl border border-dark-700 p-8 w-full">
          <h2 className="text-xl font-semibold text-dark-100 mb-6">Entrar</h2>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="seu@email.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1">Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? 'Carregando...' : 'Entrar'}
            </button>
          </form>

          <p className="text-xs text-dark-400 text-center mt-4">
            Alunos: use o e-mail e senha fornecidos pela academia.
          </p>
        </div>
      </div>

      {/* Rodapé */}
      <div className="text-center mt-8">
        <p className="text-sm text-dark-400">MyGym — Sistema de Gestão para Academias</p>
      </div>
    </div>
  );
}
