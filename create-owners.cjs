const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://kiifogmalbkcbwalhctc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpaWZvZ21hbGJrY2J3YWxoY3RjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjEzOTk4NiwiZXhwIjoyMDk3NzE1OTg2fQ.aHqLdThV8jKWRO1dPqk_3qS_rzocVv4ZymXYetaOhHk',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const ACADEMIA_ID = '3f239e12-6a92-4af1-9d98-c10ad81d6d3a'; // Force Trainning

const owners = [
  { nome: 'Bruna Gomes Silva de Brito', email: 'brunaamuniz10@gmail.com', senha: 'Force2026!' },
  { nome: 'Valéria Cristina de Melo Araújo', email: 'treinamentofuncional.valpa@gmail.com', senha: 'Force2026!' },
];

async function run() {
  for (const owner of owners) {
    console.log(`Criando: ${owner.nome}...`);

    // Criar auth user
    const { data: authUser, error } = await supabase.auth.admin.createUser({
      email: owner.email,
      password: owner.senha,
      email_confirm: true,
      user_metadata: { nome: owner.nome, role: 'admin' },
    });

    if (error) {
      console.log(`  ❌ ${error.message}`);
      continue;
    }

    const userId = authUser.user.id;

    // Criar profile
    await supabase.from('profiles').upsert({
      id: userId,
      email: owner.email,
      nome: owner.nome,
      role: 'admin',
      academia_id: ACADEMIA_ID,
    });

    console.log(`  ✅ ${owner.nome}`);
    console.log(`     E-mail: ${owner.email}`);
    console.log(`     Senha: ${owner.senha}\n`);
  }
}

run();
