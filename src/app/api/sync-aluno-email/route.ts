import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * Sincroniza email e senha do aluno no Supabase Auth e profiles quando o admin edita.
 * Garante que após qualquer edição o aluno consegue logar com email + 6 primeiros CPF.
 */
export async function POST(request: Request) {
  try {
    const { aluno_id, new_email, cpf, nome } = await request.json();

    if (!aluno_id || !new_email) {
      return NextResponse.json({ success: false, error: 'aluno_id e new_email são obrigatórios' }, { status: 400 });
    }

    // Calcular senha padrão baseada no CPF
    const cpfDigitos = (cpf || '').replace(/\D/g, '');
    const senhaDefault = cpfDigitos.length >= 6 ? cpfDigitos.slice(0, 6) : 'Gym123';

    // Buscar o aluno com user_id
    const { data: aluno } = await supabaseAdmin
      .from('alunos')
      .select('user_id, nome, email, academia_id')
      .eq('id', aluno_id)
      .single();

    if (!aluno) {
      return NextResponse.json({ success: false, error: 'Aluno não encontrado' }, { status: 404 });
    }

    const nomeAluno = nome || aluno.nome;

    // CASO 1: Aluno não tem user_id — precisa criar conta auth do zero
    if (!aluno.user_id) {
      // Verificar se já existe conta auth com esse email
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existing = existingUsers?.users?.find((u: any) => u.email?.toLowerCase() === new_email.toLowerCase());

      let userId: string;

      if (existing) {
        userId = existing.id;
        // Atualizar senha
        await supabaseAdmin.auth.admin.updateUserById(userId, { 
          password: senhaDefault, 
          email_confirm: true 
        });
      } else {
        // Criar nova conta auth
        const { data: newAuth, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email: new_email,
          password: senhaDefault,
          email_confirm: true,
          user_metadata: { nome: nomeAluno, role: 'aluno' },
        });

        if (createErr) {
          return NextResponse.json({ success: false, error: `Erro ao criar conta: ${createErr.message}` });
        }
        userId = newAuth.user.id;
      }

      // Vincular user_id ao aluno
      await supabaseAdmin.from('alunos').update({ user_id: userId }).eq('id', aluno_id);

      // Garantir profile completo
      await supabaseAdmin.from('profiles').upsert({
        id: userId,
        email: new_email,
        nome: nomeAluno,
        role: 'aluno',
        academia_id: aluno.academia_id,
      });

      return NextResponse.json({ success: true, userId, message: 'Conta criada e vinculada' });
    }

    // CASO 2: Aluno tem user_id — atualizar email e senha no auth
    const updatePayload: any = { password: senhaDefault, email_confirm: true };
    
    // Verificar se o email mudou
    const { data: currentAuth } = await supabaseAdmin.auth.admin.getUserById(aluno.user_id);
    if (currentAuth?.user?.email?.toLowerCase() !== new_email.toLowerCase()) {
      updatePayload.email = new_email;
    }

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      aluno.user_id,
      updatePayload
    );

    if (authError) {
      // Se o email já existe em outra conta, vincular à conta existente
      if (authError.message?.includes('duplicate') || authError.message?.includes('already exists')) {
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
        const existing = existingUsers?.users?.find((u: any) => u.email?.toLowerCase() === new_email.toLowerCase());
        
        if (existing) {
          // Atualizar senha na conta existente
          await supabaseAdmin.auth.admin.updateUserById(existing.id, { 
            password: senhaDefault, 
            email_confirm: true 
          });

          // Vincular o aluno à conta existente
          await supabaseAdmin.from('alunos').update({ user_id: existing.id }).eq('id', aluno_id);
          
          // Garantir profile
          await supabaseAdmin.from('profiles').upsert({
            id: existing.id,
            email: new_email,
            nome: nomeAluno,
            role: 'aluno',
            academia_id: aluno.academia_id,
          });

          // Deletar conta auth antiga se não está vinculada a outro aluno
          const { data: otherAlunos } = await supabaseAdmin
            .from('alunos')
            .select('id')
            .eq('user_id', aluno.user_id)
            .neq('id', aluno_id);

          if (!otherAlunos || otherAlunos.length === 0) {
            await supabaseAdmin.auth.admin.deleteUser(aluno.user_id);
          }

          return NextResponse.json({ success: true, message: 'Vinculado a conta existente, senha atualizada' });
        }
      }

      return NextResponse.json({ success: false, error: authError.message });
    }

    // Atualizar profile
    await supabaseAdmin.from('profiles').upsert({
      id: aluno.user_id,
      email: new_email,
      nome: nomeAluno,
      role: 'aluno',
      academia_id: aluno.academia_id,
    });

    return NextResponse.json({ success: true, message: 'Email e senha sincronizados' });

  } catch (err: any) {
    console.error('sync-aluno-email error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
