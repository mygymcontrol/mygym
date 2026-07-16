import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * Sincroniza o email do aluno no Supabase Auth e profiles quando o admin edita.
 * Previne o bug onde o aluno muda o email no cadastro mas não consegue mais logar.
 */
export async function POST(request: Request) {
  try {
    const { aluno_id, new_email } = await request.json();

    if (!aluno_id || !new_email) {
      return NextResponse.json({ success: false, error: 'aluno_id e new_email são obrigatórios' }, { status: 400 });
    }

    // Buscar o user_id do aluno
    const { data: aluno } = await supabaseAdmin
      .from('alunos')
      .select('user_id, nome')
      .eq('id', aluno_id)
      .single();

    if (!aluno?.user_id) {
      return NextResponse.json({ success: false, error: 'Aluno sem user_id vinculado' });
    }

    // Atualizar email no auth
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      aluno.user_id,
      { email: new_email, email_confirm: true }
    );

    if (authError) {
      // Se o email já existe em outra conta, tentar vincular à conta existente
      if (authError.message?.includes('duplicate') || authError.message?.includes('already exists')) {
        // Buscar a conta que já tem esse email
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
        const existing = existingUsers?.users?.find((u: any) => u.email === new_email);
        
        if (existing) {
          // Vincular o aluno à conta existente
          await supabaseAdmin.from('alunos').update({ user_id: existing.id }).eq('id', aluno_id);
          
          // Garantir profile
          await supabaseAdmin.from('profiles').upsert({
            id: existing.id,
            email: new_email,
            nome: aluno.nome,
            role: 'aluno',
          });

          // Deletar a conta auth antiga se não está vinculada a nenhum outro aluno
          const { data: otherAlunos } = await supabaseAdmin
            .from('alunos')
            .select('id')
            .eq('user_id', aluno.user_id)
            .neq('id', aluno_id);

          if (!otherAlunos || otherAlunos.length === 0) {
            await supabaseAdmin.auth.admin.deleteUser(aluno.user_id);
          }

          return NextResponse.json({ success: true, message: 'Vinculado a conta existente' });
        }
      }

      return NextResponse.json({ success: false, error: authError.message });
    }

    // Atualizar email no profile
    await supabaseAdmin.from('profiles').update({ email: new_email }).eq('id', aluno.user_id);

    return NextResponse.json({ success: true, message: 'Email sincronizado' });

  } catch (err: any) {
    console.error('sync-aluno-email error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
