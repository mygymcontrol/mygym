import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Service role client — bypasses RLS e pode criar usuários
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * API para criar/vincular conta de autenticação para alunos.
 * Garante que o aluno tenha uma conta auth + profile com role 'aluno'.
 * 
 * Chamada pelo admin ao cadastrar aluno OU para corrigir alunos existentes sem conta.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, nome, cpf, aluno_id } = body;

    if (!email || !nome) {
      return NextResponse.json({ error: 'Email e nome são obrigatórios' }, { status: 400 });
    }

    // Senha = 6 primeiros dígitos do CPF ou padrão
    const cpfDigitos = (cpf || '').replace(/\D/g, '');
    const senha = cpfDigitos.length >= 6 ? cpfDigitos.slice(0, 6) : 'Gym123';

    let userId: string | null = null;

    // 1. Tentar criar o usuário auth
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { nome, role: 'aluno' },
    });

    if (!authError && authUser?.user) {
      userId = authUser.user.id;
    } else if (authError?.message?.includes('already been registered') || authError?.message?.includes('already exists')) {
      // Usuário já existe — buscar ID paginado e atualizar senha
      let allUsers: any[] = [];
      let pg = 1;
      while (true) {
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ page: pg, perPage: 1000 });
        const users = listData?.users || [];
        allUsers.push(...users);
        if (users.length < 1000) break;
        pg++;
      }
      const existing = allUsers.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
      if (existing) {
        userId = existing.id;
        // Resetar senha para o CPF
        await supabaseAdmin.auth.admin.updateUserById(existing.id, { password: senha });
      }
    } else {
      // Erro diferente — retornar para o frontend tratar
      console.error('Erro ao criar auth user:', authError);
      return NextResponse.json({ 
        error: `Erro ao criar conta: ${authError?.message || 'Desconhecido'}`,
        userId: null 
      }, { status: 500 });
    }

    if (!userId) {
      return NextResponse.json({ error: 'Não foi possível criar ou encontrar o usuário', userId: null }, { status: 500 });
    }

    // 2. Vincular user_id ao aluno se aluno_id foi fornecido
    if (aluno_id) {
      await supabaseAdmin.from('alunos').update({ user_id: userId }).eq('id', aluno_id);
    }

    // 3. Garantir profile com role aluno
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, role')
      .eq('id', userId)
      .single();

    if (!existingProfile) {
      await supabaseAdmin.from('profiles').insert({
        id: userId,
        email,
        nome,
        role: 'aluno',
      });
    } else if (!existingProfile.role || existingProfile.role === '') {
      await supabaseAdmin.from('profiles').update({ role: 'aluno' }).eq('id', userId);
    }

    return NextResponse.json({ 
      success: true, 
      userId, 
      senha,
      message: `Conta criada/atualizada com sucesso` 
    });

  } catch (err: any) {
    console.error('create-aluno-auth error:', err);
    return NextResponse.json({ error: err.message, userId: null }, { status: 500 });
  }
}
