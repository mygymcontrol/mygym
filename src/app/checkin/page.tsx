'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getHoje } from '@/lib/utils';

export default function CheckinPublicPage() {
  const [step, setStep] = useState<'login' | 'success' | 'error'>('login');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [nomeAluno, setNomeAluno] = useState('');

  const handleCheckin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Buscar aluno pelo email
      const { data: aluno, error } = await supabase
        .from('alunos')
        .select('id, nome, status')
        .eq('email', email)
        .single();

      if (error || !aluno) {
        setMessage('E-mail não encontrado. Verifique com a recepção.');
        setStep('error');
        return;
      }

      if (aluno.status !== 'ativo') {
        setMessage(`Sua matrícula está com status: ${aluno.status}. Procure a recepção.`);
        setStep('error');
        return;
      }

      // Verificar se já fez check-in hoje
      const hoje = getHoje();
      const { data: checkinExistente } = await supabase
        .from('checkins')
        .select('id')
        .eq('aluno_id', aluno.id)
        .eq('data', hoje)
        .single();

      if (checkinExistente) {
        setNomeAluno(aluno.nome);
        setMessage('Você já fez check-in hoje! Bom treino! 💪');
        setStep('success');
        return;
      }

      // Registrar check-in
      const agora = new Date();
      const horario = agora.toTimeString().slice(0, 8);

      const { error: insertError } = await supabase
        .from('checkins')
        .insert({
          aluno_id: aluno.id,
          data: hoje,
          horario: horario,
        });

      if (insertError) throw insertError;

      setNomeAluno(aluno.nome);
      setMessage('Check-in realizado com sucesso! Bom treino! 💪');
      setStep('success');
    } catch (err) {
      setMessage('Erro ao fazer check-in. Tente novamente.');
      setStep('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-600 to-primary-800 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <img src="/IC.png" alt="MyGym" className="w-16 h-16 mx-auto rounded" />
          <h1 className="text-2xl font-bold text-white mt-2">MyGym Check-in</h1>
        </div>

        <div className="bg-dark-800 rounded-2xl shadow-xl p-8">
          {step === 'login' && (
            <>
              <h2 className="text-lg font-semibold text-dark-100 mb-2 text-center">
                Marcar Presença
              </h2>
              <p className="text-sm text-dark-400 text-center mb-6">
                Informe seu e-mail para registrar o check-in.
              </p>
              <form onSubmit={handleCheckin} className="space-y-4">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field"
                  placeholder="seu@email.com"
                  required
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full py-3"
                >
                  {loading ? 'Verificando...' : '✓ Fazer Check-in'}
                </button>
              </form>
            </>
          )}

          {step === 'success' && (
            <div className="text-center py-4">
              <span className="text-6xl block mb-4">✅</span>
              <h2 className="text-xl font-bold text-dark-100 mb-2">
                Olá, {nomeAluno}!
              </h2>
              <p className="text-dark-400">{message}</p>
              <p className="text-sm text-dark-400 mt-4">
                {new Date().toLocaleDateString('pt-BR')} às{' '}
                {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </p>
              <button
                onClick={() => { setStep('login'); setEmail(''); }}
                className="btn-secondary mt-6"
              >
                Novo Check-in
              </button>
            </div>
          )}

          {step === 'error' && (
            <div className="text-center py-4">
              <span className="text-6xl block mb-4">⚠️</span>
              <p className="text-dark-200 mb-4">{message}</p>
              <button
                onClick={() => { setStep('login'); setMessage(''); }}
                className="btn-secondary"
              >
                Tentar Novamente
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
