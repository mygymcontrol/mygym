const { createClient } = require('@supabase/supabase-js');
const s = createClient('https://kiifogmalbkcbwalhctc.supabase.co','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpaWZvZ21hbGJrY2J3YWxoY3RjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjEzOTk4NiwiZXhwIjoyMDk3NzE1OTg2fQ.aHqLdThV8jKWRO1dPqk_3qS_rzocVv4ZymXYetaOhHk');

async function run() {
  console.log('🔍 Diagnóstico Marcia Cristiane\n');

  // Buscar aluno
  const { data: aluno } = await s.from('alunos').select('*').ilike('nome', '%marcia cristiane%').single();
  console.log('CPF:', aluno.cpf);
  console.log('Email:', aluno.email);
  console.log('user_id:', aluno.user_id);

  // Calcular qual deveria ser a senha
  const cpfDigitos = (aluno.cpf || '').replace(/\D/g, '');
  const senhaEsperada = cpfDigitos.length >= 6 ? cpfDigitos.slice(0, 6) : 'Gym123';
  console.log('Senha esperada (6 primeiros CPF):', senhaEsperada);

  // Tentar logar com essa senha
  const { data: loginTest, error: loginErr } = await s.auth.signInWithPassword({
    email: aluno.email,
    password: senhaEsperada,
  });
  
  if (loginErr) {
    console.log('\n❌ LOGIN FALHOU com senha do CPF:', loginErr.message);
    
    // Resetar a senha para os 6 primeiros digitos do CPF
    console.log('\n🔧 Resetando senha para:', senhaEsperada);
    const { error: resetErr } = await s.auth.admin.updateUserById(aluno.user_id, {
      password: senhaEsperada,
    });
    if (resetErr) {
      console.log('❌ Erro ao resetar:', resetErr.message);
    } else {
      console.log('✅ Senha resetada com sucesso!');
      
      // Testar login de novo
      const { data: retry, error: retryErr } = await s.auth.signInWithPassword({
        email: aluno.email,
        password: senhaEsperada,
      });
      console.log('Teste login após reset:', retryErr ? `❌ ${retryErr.message}` : '✅ OK');
    }
  } else {
    console.log('\n✅ LOGIN OK com senha do CPF');
  }
}

run().catch(console.error);
