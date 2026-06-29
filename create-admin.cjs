const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://kiifogmalbkcbwalhctc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpaWZvZ21hbGJrY2J3YWxoY3RjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjEzOTk4NiwiZXhwIjoyMDk3NzE1OTg2fQ.aHqLdThV8jKWRO1dPqk_3qS_rzocVv4ZymXYetaOhHk',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function run() {
  const email = 'covalsqui.arrabal@gmail.com';
  const senha = 'Covalsqui10!';

  console.log('Criando usuário admin...');

  // Criar usuário auth
  const { data: authUser, error } = await supabase.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { nome: 'Covalsqui Arrabal', role: 'admin' },
  });

  if (error) {
    console.log('❌ Erro:', error.message);
    return;
  }

  console.log('✅ Usuário criado:', authUser.user.id);

  // Criar profile
  const { error: profError } = await supabase.from('profiles').upsert({
    id: authUser.user.id,
    email,
    nome: 'Covalsqui Arrabal',
    role: 'admin',
  });

  if (profError) {
    console.log('⚠️ Erro no profile:', profError.message);
  } else {
    console.log('✅ Profile admin criado');
  }

  console.log(`\n🔑 Login:\n   E-mail: ${email}\n   Senha: ${senha}`);
}

run();
