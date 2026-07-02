const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://kiifogmalbkcbwalhctc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpaWZvZ21hbGJrY2J3YWxoY3RjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjEzOTk4NiwiZXhwIjoyMDk3NzE1OTg2fQ.aHqLdThV8jKWRO1dPqk_3qS_rzocVv4ZymXYetaOhHk',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const ACADEMIA_ID = '3f239e12-6a92-4af1-9d98-c10ad81d6d3a';

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
  'FUNCIONAL 10H': { id: 'a60ff4f8-44d1-4b1a-b5f7-9c2cc58bdcb0' },
};

const HIPERTROFIA_IDS = [
  'a7e5bd8a-bdea-4b64-895e-e188552518f8',
  '45954260-8e7b-4f66-b50e-1097671873d7',
  'a60ff4f8-44d1-4b1a-b5f7-9c2cc58bdcb0',
  '927f7e56-d203-4f0a-9f49-6dad2ebe7ed7',
];

function parseModalidades(obs) {
  if (!obs) return [];
  const modIds = new Set();
  const text = obs.toUpperCase();
  for (const [nome, mod] of Object.entries(MODS)) {
    if (text.includes(nome.toUpperCase())) modIds.add(mod.id);
  }
  if (modIds.size === 0 && text.includes('FUNCIONAL') && !text.includes('KIDS')) {
    modIds.add(MODS['FUNCIONAL / HIPERTROFIA 16HRS ÀS 20HRS'].id);
  }
  return [...modIds];
}

async function run() {
  // Buscar modalidades e valores
  const { data: modalidades } = await supabase.from('modalidades').select('id, valor').eq('ativo', true);
  const modValor = {};
  modalidades.forEach(m => { modValor[m.id] = Number(m.valor) || 0; });

  // Buscar plano
  const { data: planos } = await supabase.from('planos').select('id').order('duracao_meses').limit(1);
  const planoId = planos?.[0]?.id || null;

  // Buscar pré-cadastros que não foram importados
  const { data: precadastros } = await supabase.from('pre_cadastros').select('*').neq('status', 'importado').order('created_at');
  
  if (!precadastros || precadastros.length === 0) {
    console.log('✅ Todos os pré-cadastros já foram importados!');
    return;
  }

  console.log(`Encontrados ${precadastros.length} pré-cadastros pendentes:\n`);

  let importados = 0;
  for (const pre of precadastros) {
    // Verificar se já existe
    const { data: existing } = await supabase.from('alunos').select('id').eq('email', pre.email).single();
    if (existing) {
      await supabase.from('pre_cadastros').update({ status: 'importado' }).eq('id', pre.id);
      console.log(`  ⏭ ${pre.nome} — já existe`);
      continue;
    }

    // Criar auth user
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
      if (ex) userId = ex.id;
    } else {
      console.log(`  ❌ ${pre.nome} — ${authError?.message}`);
      continue;
    }

    // Parse modalidades
    const obsText = [pre.observacoes, pre.treino_outro].filter(Boolean).join(' ');
    const modIds = parseModalidades(obsText);
    const temHipertrofia = modIds.some(id => HIPERTROFIA_IDS.includes(id));
    const valorMensal = modIds.reduce((sum, id) => sum + (modValor[id] || 0), 0);
    const diaVenc = pre.dia_vencimento || 1;

    // Criar aluno
    const { data: aluno, error: alunoErr } = await supabase.from('alunos').insert({
      user_id: userId, nome: pre.nome, email: pre.email, telefone: pre.telefone || '',
      cpf: pre.cpf || null, data_nascimento: pre.data_nascimento || null,
      endereco: pre.endereco || null, status: 'ativo', observacoes: pre.observacoes || null,
      academia_id: ACADEMIA_ID, treino_hipertrofia: temHipertrofia, dia_vencimento: diaVenc,
    }).select().single();

    if (alunoErr) { console.log(`  ❌ ${pre.nome} — ${alunoErr.message}`); continue; }

    // Profile
    if (userId) {
      await supabase.from('profiles').upsert({ id: userId, email: pre.email, nome: pre.nome, role: 'aluno', academia_id: ACADEMIA_ID });
    }

    // Vincular modalidades
    if (modIds.length > 0) {
      await supabase.from('aluno_modalidades').insert(modIds.map(modId => ({ aluno_id: aluno.id, modalidade_id: modId, status: 'ativa' })));
    }

    // Matrícula
    if (planoId) {
      await supabase.from('matriculas').insert({
        aluno_id: aluno.id, plano_id: planoId,
        data_inicio: '2026-07-01', data_fim: '2027-07-01',
        valor_final: valorMensal, status: 'ativa', academia_id: ACADEMIA_ID,
      });
    }

    // Mensalidade junho (PAGA)
    if (valorMensal > 0) {
      await supabase.from('mensalidades').insert({
        aluno_id: aluno.id, valor: valorMensal,
        data_vencimento: `2026-06-${String(diaVenc).padStart(2, '0')}`,
        status: 'pago', data_pagamento: '2026-06-01', forma_pagamento: 'pix',
        academia_id: ACADEMIA_ID,
      });

      // Mensalidade julho (PENDENTE)
      await supabase.from('mensalidades').insert({
        aluno_id: aluno.id, valor: valorMensal,
        data_vencimento: `2026-07-${String(diaVenc).padStart(2, '0')}`,
        status: 'pendente', academia_id: ACADEMIA_ID,
      });
    }

    // Marcar como importado
    await supabase.from('pre_cadastros').update({ status: 'importado' }).eq('id', pre.id);

    const modNomes = modIds.map(id => modalidades.find(m => m.id === id)?.nome || '?').join(', ');
    console.log(`  ✅ ${pre.nome} | ${modNomes || 'sem mod'} | R$ ${valorMensal.toFixed(2)} | venc dia ${diaVenc} | hipertrofia: ${temHipertrofia}`);
    importados++;
  }

  console.log(`\n🎉 ${importados} novos alunos importados!`);
}

run();
