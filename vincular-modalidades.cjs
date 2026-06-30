const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://kiifogmalbkcbwalhctc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpaWZvZ21hbGJrY2J3YWxoY3RjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjEzOTk4NiwiZXhwIjoyMDk3NzE1OTg2fQ.aHqLdThV8jKWRO1dPqk_3qS_rzocVv4ZymXYetaOhHk',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const ACADEMIA_ID = '3f239e12-6a92-4af1-9d98-c10ad81d6d3a';

// Mapeamento de modalidades
const MODS = {
  'FUNCIONAL / HIPERTROFIA 5HRS': 'a7e5bd8a-bdea-4b64-895e-e188552518f8',
  'FUNCIONAL / HIPERTROFIA 6HRS': '45954260-8e7b-4f66-b50e-1097671873d7',
  'FUNCIONAL / HIPERTROFIA 7HRS': 'a60ff4f8-44d1-4b1a-b5f7-9c2cc58bdcb0',
  'FUNCIONAL / HIPERTROFIA 16HRS ÀS 20HRS': '927f7e56-d203-4f0a-9f49-6dad2ebe7ed7',
  'FUNCIONAL KIDS': 'a2b3b56d-449b-4226-8e66-2bf50790a8c2',
  'TREINO PERSONALIZADO': '45f732f0-9070-44cd-8b06-04635102b9c0',
  'SPINNING 06HRS': '37075c9a-4dbd-4a4d-b728-f1d50f27f6e7',
  'SPNINNING 07HRS': '65a7ab5c-126b-4b38-81af-418e7d56c510',
  'SPINNING 07HRS': '65a7ab5c-126b-4b38-81af-418e7d56c510',
  'SPNINNING 17:30 HRS': '1abdcb7d-ce80-4202-afde-34c681aa917c',
  'SPINNING 17:30 HRS': '1abdcb7d-ce80-4202-afde-34c681aa917c',
  'SPINNING SEXTOU 17:30 HRS': 'b4b9483c-d604-4288-967e-c4c9201d9f17',
  'SPNINNING SEXTOU 17:30 HRS': 'b4b9483c-d604-4288-967e-c4c9201d9f17',
  'SPINNING 11HRS': 'ea5af4af-c75b-43c2-b2f3-174f39832532',
  'SPNINNING 11HRS': 'ea5af4af-c75b-43c2-b2f3-174f39832532',
  'TREINOS HIPERTROFIA': 'c1497472-a78f-4afc-b126-a1a08d80990e',
};

function parseModalidades(obs) {
  if (!obs) return [];
  const modIds = new Set();
  
  // Extrair a parte "Treinos: ..."
  const treinoMatch = obs.match(/Treinos?:\s*(.+?)(?:\||$)/i);
  if (!treinoMatch) return [];
  
  const treinoText = treinoMatch[1].trim();
  
  // Tentar match de cada modalidade conhecida
  for (const [nome, id] of Object.entries(MODS)) {
    if (treinoText.toUpperCase().includes(nome.toUpperCase())) {
      modIds.add(id);
    }
  }
  
  // Se menciona "FUNCIONAL" e "HIPERTROFIA" mas nenhum horário específico matched
  if (modIds.size === 0 && treinoText.toUpperCase().includes('FUNCIONAL')) {
    // Default para 16HRS
    modIds.add(MODS['FUNCIONAL / HIPERTROFIA 16HRS ÀS 20HRS']);
  }
  
  return [...modIds];
}

async function run() {
  // Buscar todos os alunos da Force Trainning
  const { data: alunos } = await supabase
    .from('alunos')
    .select('id, nome, observacoes')
    .eq('academia_id', ACADEMIA_ID);

  if (!alunos || alunos.length === 0) {
    console.log('Nenhum aluno encontrado.');
    return;
  }

  console.log(`Processando ${alunos.length} alunos...\n`);

  let total = 0;
  let ativouHipertrofia = 0;

  for (const aluno of alunos) {
    const modIds = parseModalidades(aluno.observacoes);
    
    if (modIds.length === 0) {
      console.log(`  ⏭ ${aluno.nome} — sem modalidade identificada (obs: ${aluno.observacoes || '—'})`);
      continue;
    }

    // Verificar quais já estão vinculadas
    const { data: existentes } = await supabase
      .from('aluno_modalidades')
      .select('modalidade_id')
      .eq('aluno_id', aluno.id)
      .eq('status', 'ativa');
    
    const existentesIds = (existentes || []).map(e => e.modalidade_id);
    const novas = modIds.filter(id => !existentesIds.includes(id));

    if (novas.length === 0) {
      continue; // Já tem todas vinculadas
    }

    // Inserir novas modalidades
    const inserts = novas.map(modId => ({
      aluno_id: aluno.id,
      modalidade_id: modId,
      status: 'ativa',
    }));
    await supabase.from('aluno_modalidades').insert(inserts);

    // Se tem HIPERTROFIA, ativar treino_hipertrofia
    const temHipertrofia = modIds.some(id => 
      id === MODS['FUNCIONAL / HIPERTROFIA 5HRS'] ||
      id === MODS['FUNCIONAL / HIPERTROFIA 6HRS'] ||
      id === MODS['FUNCIONAL / HIPERTROFIA 7HRS'] ||
      id === MODS['FUNCIONAL / HIPERTROFIA 16HRS ÀS 20HRS']
    );
    if (temHipertrofia) {
      await supabase.from('alunos').update({ treino_hipertrofia: true }).eq('id', aluno.id);
      ativouHipertrofia++;
    }

    const modNomes = novas.map(id => Object.entries(MODS).find(([_, v]) => v === id)?.[0] || id);
    console.log(`  ✅ ${aluno.nome} → ${modNomes.join(', ')}`);
    total += novas.length;
  }

  console.log(`\n🎉 Concluído! ${total} vínculos criados. ${ativouHipertrofia} alunos com Treino Hipertrofia ativado.`);
}

run();
