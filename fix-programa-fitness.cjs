const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ijvedpvkdvwrercnlcth.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqdmVkcHZrZHZ3cmVyY25sY3RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxMTEyOTQsImV4cCI6MjA5NTY4NzI5NH0.cRQmESefZCdo13pBDeNhhV6Yvqi4A7f8vUkI5eg-SMU';

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  const email = 'covalsqui.arrabal1@gmail.com';
  
  console.log(`🔍 Verificando e-mail: ${email}\n`);

  // 1. Buscar se existe na tabela alunos
  const { data, error } = await db
    .from('alunos')
    .select('*')
    .eq('email', email);

  if (error) {
    console.log('❌ Erro ao consultar:', error.message);
    console.log('   Detalhes:', JSON.stringify(error));
    return;
  }

  console.log(`📋 Resultados encontrados: ${data?.length || 0}`);
  if (data && data.length > 0) {
    data.forEach(a => {
      console.log(`  - Email: ${a.email}`);
      console.log(`    Ativo: ${a.ativo}`);
      console.log(`    Todos os campos:`, JSON.stringify(a, null, 2));
    });
  } else {
    console.log('  ❌ E-mail NÃO encontrado na tabela alunos');
    
    // Tentar buscar qualquer registro para ver a estrutura
    console.log('\n📊 Verificando estrutura da tabela...');
    const { data: sample, error: sErr } = await db.from('alunos').select('*').limit(3);
    if (sErr) {
      console.log('  Erro:', sErr.message);
    } else if (sample && sample.length > 0) {
      console.log(`  Colunas: ${Object.keys(sample[0]).join(', ')}`);
      console.log(`  Exemplos:`);
      sample.forEach(s => console.log(`    - ${s.email} | ativo: ${s.ativo}`));
    } else {
      console.log('  Tabela está VAZIA!');
    }

    // Tentar inserir
    console.log('\n🔧 Inserindo e-mail na tabela...');
    const { data: inserted, error: iErr } = await db
      .from('alunos')
      .insert({ email: email, ativo: true })
      .select();

    if (iErr) {
      console.log(`  ❌ Erro ao inserir: ${iErr.message}`);
      console.log(`     Código: ${iErr.code}`);
      console.log(`     Detalhes: ${iErr.details || iErr.hint || ''}`);
    } else {
      console.log(`  ✅ Inserido com sucesso!`, inserted);
    }
  }
}

run().catch(console.error);
