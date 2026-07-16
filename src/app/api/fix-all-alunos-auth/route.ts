import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Service role client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * API para corrigir TODOS os alunos ativos que não possuem conta auth ou profile.
 * Detecta alunos sem user_id ou sem profile e cria/corrige.
 * 
 * GET = lista alunos com problemas (preview)
 * POST = corrige todos
 */
export async function GET() {
  try {
    // Buscar alunos ativos sem user_id
    const { data: semUserId } = await supabaseAdmin
      .from('alunos')
      .select('id, nome, email, cpf, user_id, status')
      .is('user_id', null)
      .in('status', ['ativo', 'inadimplente']);

    // Buscar alunos com user_id mas sem profile
    const { data: comUserId } = await supabaseAdmin
      .from('alunos')
      .select('id, nome, email, cpf, user_id, status')
      .not('user_id', 'is', null)
      .in('status', ['ativo', 'inadimplente']);

    const semProfile: any[] = [];
    for (const aluno of (comUserId || [])) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id, role')
        .eq('id', aluno.user_id)
        .single();
      
      if (!profile || !profile.role || profile.role === '') {
        semProfile.push(aluno);
      }
    }

    return NextResponse.json({
      total_sem_user_id: (semUserId || []).length,
      total_sem_profile: semProfile.length,
      alunos_sem_user_id: (semUserId || []).map(a => ({ id: a.id, nome: a.nome, email: a.email })),
      alunos_sem_profile: semProfile.map(a => ({ id: a.id, nome: a.nome, email: a.email })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST() {
  try {
    const results: any[] = [];

    // 1. Buscar alunos ativos sem user_id
    const { data: semUserId } = await supabaseAdmin
      .from('alunos')
      .select('id, nome, email, cpf, status')
      .is('user_id', null)
      .in('status', ['ativo', 'inadimplente']);

    for (const aluno of (semUserId || [])) {
      if (!aluno.email) {
        results.push({ aluno: aluno.nome, status: 'skip', reason: 'sem email' });
        continue;
      }

      const cpfDigitos = (aluno.cpf || '').replace(/\D/g, '');
      const senha = cpfDigitos.length >= 6 ? cpfDigitos.slice(0, 6) : 'Gym123';

      let userId: string | null = null;

      // Tentar criar conta auth
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: aluno.email,
        password: senha,
        email_confirm: true,
        user_metadata: { nome: aluno.nome, role: 'aluno' },
      });

      if (!authError && authUser?.user) {
        userId = authUser.user.id;
      } else if (authError?.message?.includes('already been registered') || authError?.message?.includes('already exists')) {
        // Buscar user existente
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
        const existing = existingUsers?.users?.find((u: any) => u.email === aluno.email);
        if (existing) {
          userId = existing.id;
          await supabaseAdmin.auth.admin.updateUserById(existing.id, { password: senha });
        }
      }

      if (userId) {
        // Vincular user_id
        await supabaseAdmin.from('alunos').update({ user_id: userId }).eq('id', aluno.id);
        
        // Garantir profile
        const { data: existingProfile } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('id', userId)
          .single();

        if (!existingProfile) {
          await supabaseAdmin.from('profiles').insert({
            id: userId, email: aluno.email, nome: aluno.nome, role: 'aluno',
          });
        } else {
          await supabaseAdmin.from('profiles').update({ role: 'aluno', nome: aluno.nome }).eq('id', userId);
        }

        results.push({ aluno: aluno.nome, status: 'fixed', userId, senha });
      } else {
        results.push({ aluno: aluno.nome, status: 'error', reason: authError?.message || 'userId null' });
      }
    }

    // 2. Corrigir alunos com user_id mas sem profile correto
    const { data: comUserId } = await supabaseAdmin
      .from('alunos')
      .select('id, nome, email, user_id, status')
      .not('user_id', 'is', null)
      .in('status', ['ativo', 'inadimplente']);

    for (const aluno of (comUserId || [])) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id, role')
        .eq('id', aluno.user_id)
        .single();

      if (!profile) {
        await supabaseAdmin.from('profiles').insert({
          id: aluno.user_id, email: aluno.email, nome: aluno.nome, role: 'aluno',
        });
        results.push({ aluno: aluno.nome, status: 'profile_created' });
      } else if (!profile.role || profile.role === '') {
        await supabaseAdmin.from('profiles').update({ role: 'aluno' }).eq('id', aluno.user_id);
        results.push({ aluno: aluno.nome, status: 'profile_fixed' });
      }
    }

    return NextResponse.json({ 
      success: true, 
      total_processados: results.length,
      results 
    });

  } catch (err: any) {
    console.error('fix-all-alunos-auth error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
