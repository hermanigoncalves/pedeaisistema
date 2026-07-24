import { supabase } from '../adapters/supabaseAdapter';

async function deepSearch() {
  console.log('=== BUSCA PROFUNDA POR "divisoes" EM TODOS OS CAMPOS ===\n');

  // 1. Buscar em ConfiguracoesGlobais
  const { data: configs } = await supabase.client
    .from('ConfiguracoesGlobais')
    .select('id, prompt_servico');

  if (configs) {
    for (const row of configs) {
      const prompt = row.prompt_servico || '';
      if (prompt.includes('divisoes')) {
        console.log(`[ConfiguracoesGlobais id=${row.id}] Contém "divisoes":`);
        // Encontrar todas as ocorrências e mostrar contexto
        let idx = 0;
        while ((idx = prompt.indexOf('divisoes', idx)) !== -1) {
          const start = Math.max(0, idx - 60);
          const end = Math.min(prompt.length, idx + 60);
          console.log(`  Posição ${idx}: "...${prompt.slice(start, end)}..."`);
          idx += 8;
        }
      } else {
        console.log(`[ConfiguracoesGlobais id=${row.id}] prompt_servico NÃO contém "divisoes" ✅`);
      }
    }
  }

  // 2. Checar o prompt de serviço completo do banco (dump parcial)
  const { data: gc } = await supabase.client
    .from('ConfiguracoesGlobais')
    .select('prompt_servico')
    .eq('id', 1)
    .single();

  if (gc?.prompt_servico) {
    console.log('\n=== PROMPT_SERVICO COMPLETO (do banco) ===');
    console.log(gc.prompt_servico);
    console.log('\n=== FIM DO PROMPT_SERVICO ===');
  }

  // 3. Verificar se no código a constante SYSTEM_PROMPT_SERVICO contém divisoes entre chaves
  const { SYSTEM_PROMPT_SERVICO } = await import('./pedeaiAgent');
  if (SYSTEM_PROMPT_SERVICO.includes('{ "divisoes"')) {
    console.log('\n❌ SYSTEM_PROMPT_SERVICO (código) CONTÉM { "divisoes" }!');
  } else if (SYSTEM_PROMPT_SERVICO.includes('divisoes')) {
    console.log('\n✅ SYSTEM_PROMPT_SERVICO (código) contém "divisoes" SEM chaves {}');
    // Mostrar contexto
    let idx = 0;
    while ((idx = SYSTEM_PROMPT_SERVICO.indexOf('divisoes', idx)) !== -1) {
      const start = Math.max(0, idx - 40);
      const end = Math.min(SYSTEM_PROMPT_SERVICO.length, idx + 40);
      console.log(`  Contexto: "...${SYSTEM_PROMPT_SERVICO.slice(start, end)}..."`);
      idx += 8;
    }
  } else {
    console.log('\n✅ SYSTEM_PROMPT_SERVICO (código) não contém "divisoes" de nenhuma forma.');
  }
}

deepSearch();
