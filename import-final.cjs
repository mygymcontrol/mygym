const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://kiifogmalbkcbwalhctc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpaWZvZ21hbGJrY2J3YWxoY3RjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjEzOTk4NiwiZXhwIjoyMDk3NzE1OTg2fQ.aHqLdThV8jKWRO1dPqk_3qS_rzocVv4ZymXYetaOhHk',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const ACADEMIA_ID = '3f239e12-6a92-4af1-9d98-c10ad81d6d3a';

// Mapeamento de modalidades (nome → {id, valor})
const MODS = {
  'FUNCIONAL / HIPERTROFIA 5HRS': { id: 'a7e5bd8a-bdea-4b64-895e-e188552518f8' },
  'FUNCIONAL / HIPERTROFIA 6HRS': { id: '45954260-8e7b-4f66-b50e-1097671873d7' },
  'FUNCIONAL / HIPERTROFIA 7HRS': { id: 'a60ff4f8-44d1-4b1a-b5f7-9c2cc58bdcb0' },
  'FUNCIONAL / HIPERTROFIA 16HRS ÀS 20HRS': { id: '927f7e56-d203-4f0a-9f49-6dad2ebe7ed7' },
  'FUNCIONAL KIDS': { id: 'a2b3b56d-449b-4226-8e66-2bf50790a8c2' },
  'TREINO PERSONALIZADO': { id: '45f732f0-9070-44cd-8b06-04635102b9c0' },
  'SPINNING 06HRS': { id: '37075c9a-4dbd-4a4d-b728-f1d50f27f6e7' },
  'SPNINNING 07HRS': { id: '65a7ab5c-126b-4b38-81af-418e7d56c510' },
  'SPINNING 07HRS': { id: '65a7ab5c-126b-4b38-81af-418e7d56c510' },
  'SPNINNING 17:30 HRS': { id: '1abdcb7d-ce80-4202-afde-34c681aa917c' },
  'SPINNING 17:30 HRS': { id: '1abdcb7d-ce80-4202-afde-34c681aa917c' },
  'SPINNING SEXTOU 17:30 HRS': { id: 'b4b9483c-d604-4288-967e-c4c9201d9f17' },
  'SPNINNING SEXTOU 17:30 HRS': { id: 'b4b9483c-d604-4288-967e-c4c9201d9f17' },
  'SPINNING 11HRS': { id: 'ea5af4af-c75b-43c2-b2f3-174f39832532' },
  'SPNINNING 11HRS': { id: 'ea5af4af-c75b-43c2-b2f3-174f39832532' },
  'FUNCIONAL 10H': { id: 'a60ff4f8-44d1-4b1a-b5f7-9c2cc58bdcb0' }, // mapear para 7HRS como mais próximo
};

function parseModalidades(obs) {
  if (!obs) return [];
  const modIds = new Set();
  const text = obs.toUpperCase();
  
  for (const [nome, mod] of Object.entries(MODS)) {
    if (text.includes(nome.toUpperCase())) {
      modIds.add(mod.id);
    }
  }

  // Fallback: se menciona FUNCIONAL mas nenhum horário bateu
  if (modIds.size === 0 && text.includes('FUNCIONAL') && !text.includes('KIDS')) {
    modIds.add(MODS['FUNCIONAL / HIPERTROFIA 16HRS ÀS 20HRS'].id);
  }
  
  return [...modIds];
}

async function run() {
  // Buscar valores das modalidades
  const { data: modalidades } = await supabase.from('modalidades').select('id, nome, valor').eq('ativo', true);
  const modValor = {};
  modalidades.forEach(m => { modValor[m.id] = Number(m.valor) || 0; });

  // 1. Buscar pré-cadastros pendentes
  console.log('Buscando pré-cadastros pendentes...');
  const { data: pendentes } = await supabase
    .from('pre_cadastros')
    .select('*')
    .eq('status', 'pendente')
    .order('created_at');

  console.log(`Encontrados ${pendentes?.length || 0} pré-cadastros pendentes.\n`);

  let importados = 0;
  for (const pre of (pendentes || [])) {
    // Verificar se já existe aluno com esse e-mail
    const { data: existing } = await supabase.from('alunos').select('id').eq('email', pre.email).single();
    if (existing) {
      console.log(`  ⏭ ${pre.nome} (${pre.email}) — já existe`);
      await supabase.from('pre_cadastros').update({ status: 'importado' }).eq('id', pre.id);
      continue;
    }

    // Criar usuário auth
    const cpfDigitos = (pre.cpf || '').replace(/\D/g, '');
    const senhaTemp = cpfDigitos.length >= 6 ? cpfDigitos.slice(0, 6) : 'Gym123';

    let userId = null;
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: pre.email, password: senhaTemp, email_confirm: true,
      user_metadata: { nome: pre.nome, role: 'aluno' },
    });

    if (!authError && authUser?.user) {
      userId = authUser.user.id;
    } else if (authError?.message?.includes('already been registered')) {
      const { data: users } = await supabase.auth.admin.listUsers();
      const ex = users?.users?.find(u => u.email === pre.email);
      if (ex) { userId = ex.id; }
    } else {
      console.log(`  ❌ ${pre.nome} — erro auth: ${authError?.message}`);
      continue;
    }

    // Determinar modalidades
    const obsText = [pre.observacoes, pre.treino_outro].filter(Boolean).join(' ');
    const modIds = parseModalidades(obsText);
    const temHipertrofia = modIds.some(id =>
      id === MODS['FUNCIONAL / HIPERTROFIA 5HRS'].id ||
      id === MODS['FUNCIONAL / HIPERTROFIA 6HRS'].id ||
      id === MODS['FUNCIONAL / HIPERTROFIA 7HRS'].id ||
      id === MODS['FUNCIONAL / HIPERTROFIA 16HRS ÀS 20HRS'].id
    );

    // Calcular valor da mensalidade (soma das modalidades)
    const valorMensal = modIds.reduce((sum, id) => sum + (modValor[id] || 0), 0);

    // Criar aluno
    const { data: aluno, error: alunoErr } = await supabase.from('alunos').insert({
      user_id: userId,
      nome: pre.nome, email: pre.email, telefone: pre.telefone || '',
      cpf: pre.cpf || null, data_nascimento: pre.data_nascimento || null,
      endereco: pre.endereco || null,
      status: 'ativo', observacoes: pre.observacoes || null,
      academia_id: ACADEMIA_ID,
      treino_hipertrofia: temHipertrofia,
      dia_vencimento: pre.dia_vencimento || 10,
    }).select().single();

    if (alunoErr) { console.log(`  ❌ ${pre.nome} — ${alunoErr.message}`); continue; }

    // Criar profile
    if (userId) {
      await supabase.from('profiles').upsert({ id: userId, email: pre.email, nome: pre.nome, role: 'aluno', academia_id: ACADEMIA_ID });
    }

    // Vincular modalidades
    if (modIds.length > 0) {
      const vinculos = modIds.map(modId => ({ aluno_id: aluno.id, modalidade_id: modId, status: 'ativa' }));
      await supabase.from('aluno_modalidades').insert(vinculos);
    }

    // Gerar primeira mensalidade se há valor
    if (valorMensal > 0) {
      const diaVenc = pre.dia_vencimento || 10;
      const hoje = new Date();
      let mesVenc = hoje.getMonth() + 1;
      let anoVenc = hoje.getFullYear();
      // Se já passou do dia de vencimento, gerar para o próximo mês
      if (hoje.getDate() > diaVenc) { mesVenc++; if (mesVenc > 12) { mesVenc = 1; anoVenc++; } }
      const dataVenc = `${anoVenc}-${String(mesVenc).padStart(2, '0')}-${String(diaVenc).padStart(2, '0')}`;

      await supabase.from('mensalidades').insert({
        aluno_id: aluno.id, valor: valorMensal,
        data_vencimento: dataVenc, status: 'pendente',
        academia_id: ACADEMIA_ID,
      });
    }

    // Marcar como importado
    await supabase.from('pre_cadastros').update({ status: 'importado' }).eq('id', pre.id);

    const modNomes = modIds.map(id => modalidades.find(m => m.id === id)?.nome || '?').join(', ');
    console.log(`  ✅ ${pre.nome} | ${modNomes} | R$ ${valorMensal.toFixed(2)}`);
    importados++;
  }

  // 2. Marcar TODOS os pré-cadastros como importado (incluindo os que já foram importados antes mas ficaram pendente)
  console.log('\nMarcando todos como importado...');
  const { count } = await supabase.from('pre_cadastros').update({ status: 'importado' }).neq('status', 'importado').select('*', { count: 'exact', head: true });
  
  // 3. Gerar mensalidades para alunos antigos que ainda não têm
  console.log('Verificando mensalidades dos alunos antigos...');
  const { data: alunosSemMens } = await supabase
    .from('alunos')
    .select('id, nome, dia_vencimento, aluno_modalidades(modalidade_id)')
    .eq('academia_id', ACADEMIA_ID)
    .eq('status', 'ativo');

  let mensGeradas = 0;
  for (const al of (alunosSemMens || [])) {
    // Verificar se já tem mensalidade pendente
    const { data: menExist } = await supabase.from('mensalidades').select('id').eq('aluno_id', al.id).eq('status', 'pendente').limit(1);
    if (menExist && menExist.length > 0) continue;

    // Calcular valor
    const mods = al.aluno_modalidades || [];
    const valor = mods.reduce((sum, m) => sum + (modValor[m.modalidade_id] || 0), 0);
    if (valor === 0) continue;

    const diaVenc = al.dia_vencimento || 10;
    const hoje = new Date();
    let mesVenc = hoje.getMonth() + 1;
    let anoVenc = hoje.getFullYear();
    if (hoje.getDate() > diaVenc) { mesVenc++; if (mesVenc > 12) { mesVenc = 1; anoVenc++; } }
    const dataVenc = `${anoVenc}-${String(mesVenc).padStart(2, '0')}-${String(diaVenc).padStart(2, '0')}`;

    await supabase.from('mensalidades').insert({
      aluno_id: al.id, valor, data_vencimento: dataVenc, status: 'pendente', academia_id: ACADEMIA_ID,
    });
    mensGeradas++;
  }

  console.log(`\n🎉 Concluído!`);
  console.log(`   ${importados} novos alunos importados`);
  console.log(`   ${mensGeradas} mensalidades geradas para alunos sem mensalidade pendente`);
  console.log(`   Todos os pré-cadastros marcados como "importado"`);
}

run();
