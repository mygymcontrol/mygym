import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Service role client — bypasses RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// Anon client — para pegar sessão do usuário
const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    // Pegar o token do header Authorization
    const authHeader = request.headers.get('authorization');
    let userId: string | null = null;
    let userEmail: string | null = null;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const { data: { user } } = await supabaseAnon.auth.getUser(token);
      if (user) {
        userId = user.id;
        userEmail = user.email || null;
      }
    }

    // Fallback: tentar pegar via cookie
    if (!userId) {
      // Tentar buscar a sessão via admin listando por último login
      // Na prática, o frontend vai mandar o token
      return NextResponse.json({ error: 'Não autorizado', isAluno: false }, { status: 401 });
    }

    // 1. Verificar se existe na tabela alunos (por email)
    const { data: aluno } = await supabaseAdmin
      .from('alunos')
      .select('id, nome, email, user_id')
      .eq('email', userEmail)
      .single();

    if (!aluno) {
      // Tentar por user_id caso email não bata
      const { data: alunoById } = await supabaseAdmin
        .from('alunos')
        .select('id, nome, email, user_id')
        .eq('user_id', userId)
        .single();

      if (!alunoById) {
        return NextResponse.json({ isAluno: false, message: 'Não encontrado como aluno' });
      }

      // Aluno existe por user_id — garantir profile
      await ensureProfile(userId, alunoById.email, alunoById.nome);
      return NextResponse.json({ isAluno: true, fixed: true });
    }

    // 2. Vincular user_id se necessário
    if (!aluno.user_id || aluno.user_id !== userId) {
      await supabaseAdmin
        .from('alunos')
        .update({ user_id: userId })
        .eq('id', aluno.id);
    }

    // 3. Garantir profile existe com role aluno
    await ensureProfile(userId, aluno.email, aluno.nome);

    return NextResponse.json({ isAluno: true, fixed: true });
  } catch (err: any) {
    console.error('fix-aluno-profile error:', err);
    return NextResponse.json({ error: err.message, isAluno: false }, { status: 500 });
  }
}

async function ensureProfile(userId: string, email: string, nome: string) {
  const { data: existing } = await supabaseAdmin
    .from('profiles')
    .select('id, role')
    .eq('id', userId)
    .single();

  if (!existing) {
    // Criar profile
    await supabaseAdmin.from('profiles').insert({
      id: userId,
      email,
      nome,
      role: 'aluno',
    });
  } else if (!existing.role || existing.role === '' || existing.role === 'null') {
    // Corrigir role vazio
    await supabaseAdmin.from('profiles').update({ role: 'aluno' }).eq('id', userId);
  }
}
