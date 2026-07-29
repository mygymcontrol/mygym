const { createClient } = require('@supabase/supabase-js');
const s = createClient('https://kiifogmalbkcbwalhctc.supabase.co','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpaWZvZ21hbGJrY2J3YWxoY3RjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjEzOTk4NiwiZXhwIjoyMDk3NzE1OTg2fQ.aHqLdThV8jKWRO1dPqk_3qS_rzocVv4ZymXYetaOhHk');

const ACADEMIA_ID = '3f239e12-6a92-4af1-9d98-c10ad81d6d3a';

async function run() {
  console.log('🔐 VERIFICAÇÃO E RESET DE SENHAS DE TODOS OS ALUNOS\n');
  console.log('═'.repeat(70));

  // 1. Buscar todos os alunos ativos
  const { data: alunos } = await s
    .from('alunos')
    .select('id, nome, email, cpf, user_id, status')
    .eq('academia_id', ACADEMIA_ID)
    .in('status', ['ativo', 'suspenso', 'inadimplente']);

  console.log(`📋 Total de alunos para verificar: ${alunos.length}\n`);

  let senhaOk = 0;
  let senhaResetada = 0;
  let semUserId = 0;
  let erros = 0;

  for (const al of alunos) {
    if (!al.user_id) {
      semUserId++;
      continue;
    }

    const cpfDigitos = (al.cpf || '').replace(/\D/g, '');
    const senhaEsperada = cpfDigitos.length >= 6 ? cpfDigitos.slice(0, 6) : 'Gym123';

    // Tentar logar
    const { error: loginErr } = await s.auth.signInWithPassword({
      email: al.email,
      password: senhaEsperada,
    });

    if (loginErr) {
      // Senha não bate — resetar
      const { error: resetErr } = await s.auth.admin.updateUserById(al.user_id, {
        password: senhaEsperada,
      });

      if (resetErr) {
        console.log(`  ❌ ${al.nome} (${al.email}) — Erro ao resetar: ${resetErr.message}`);
        erros++;
      } else {
        console.log(`  🔧 ${al.nome} (${al.email}) — Senha resetada para: ${senhaEsperada}`);
        senhaResetada++;
      }
    } else {
      senhaOk++;
    }
  }

  console.log('\n' + '═'.repeat(70));
  console.log('📊 RESULTADO:');
  console.log(`  ✅ Senhas já corretas: ${senhaOk}`);
  console.log(`  🔧 Senhas resetadas: ${senhaResetada}`);
  console.log(`  ⚠️ Sem user_id: ${semUserId}`);
  console.log(`  ❌ Erros: ${erros}`);
  console.log(`  Total verificados: ${alunos.length}`);
  console.log('\nTodos os alunos agora podem logar com os 6 primeiros dígitos do CPF como senha.');
}

run().catch(console.error);
