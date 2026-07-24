import { supabase } from '../adapters/supabaseAdapter';

const RESTAURANTE_ID = 'a976db0c-c1df-4b21-a836-3671f1a5bba9';

async function auditRestaurante() {
  console.log('=== AUDITORIA COMPLETA DE PROMPTS DO RESTAURANTE ===\n');

  // 1. Verificar ConfiguracoesGlobais
  const { data: globalConfig, error: e1 } = await supabase.client
    .from('ConfiguracoesGlobais')
    .select('id, prompt_geral, prompt_vendas, prompt_servico')
    .eq('id', 1)
    .single();

  if (e1) {
    console.error('Erro ao ler ConfiguracoesGlobais:', e1);
  } else {
    console.log('--- ConfiguracoesGlobais (id=1) ---');
    for (const field of ['prompt_geral', 'prompt_vendas', 'prompt_servico']) {
      const val = (globalConfig as any)?.[field] || '';
      const hasBraces = /\{[^}]+\}/.test(val);
      console.log(`  ${field}: ${val ? val.length + ' chars' : 'VAZIO'} ${hasBraces ? '⚠️  CONTÉM CHAVES {}!' : '✅ Sem chaves'}`);
      if (hasBraces) {
        const matches = val.match(/\{[^}]+\}/g);
        console.log(`    Chaves encontradas: ${JSON.stringify(matches)}`);
      }
    }
  }

  // 2. Verificar campos do Restaurante (personalidade, exemplos, regras)
  const { data: rest, error: e2 } = await supabase.client
    .from('Restaurantes')
    .select('personalidade_agente, exemplos_conversa, regras_estabelecimento')
    .eq('id', RESTAURANTE_ID)
    .single();

  if (e2) {
    console.error('Erro ao ler Restaurantes:', e2);
  } else {
    console.log('\n--- Restaurantes (San Pio) ---');
    for (const field of ['personalidade_agente', 'exemplos_conversa', 'regras_estabelecimento']) {
      const val = (rest as any)?.[field] || '';
      const hasBraces = /\{[^}]+\}/.test(val);
      console.log(`  ${field}: ${val ? val.length + ' chars' : 'VAZIO'} ${hasBraces ? '⚠️  CONTÉM CHAVES {}!' : '✅ Sem chaves'}`);
      if (hasBraces) {
        const matches = val.match(/\{[^}]+\}/g);
        console.log(`    Chaves encontradas: ${JSON.stringify(matches)}`);
        // Mostrar o contexto ao redor de cada chave
        for (const m of (matches || [])) {
          const idx = val.indexOf(m);
          const start = Math.max(0, idx - 50);
          const end = Math.min(val.length, idx + m.length + 50);
          console.log(`    Contexto: "...${val.slice(start, end)}..."`);
        }
      }
    }
  }

  // 3. Verificar o prompt FINAL montado (simulando o fluxo real)
  console.log('\n--- Simulação do Prompt Final (categoria=servico) ---');
  
  let baseServicoPrompt = (await import('./pedeaiAgent')).SYSTEM_PROMPT_SERVICO;
  
  // Aplicar override do banco se existir
  if (globalConfig && (globalConfig as any).prompt_servico && (globalConfig as any).prompt_servico.trim() !== '') {
    baseServicoPrompt = (globalConfig as any).prompt_servico.trim().replace(/\\n/g, '\n');
    console.log('  ℹ️  Prompt de serviço SOBRESCRITO pelo banco de dados');
  } else {
    console.log('  ℹ️  Usando prompt de serviço do CÓDIGO (constante)');
  }

  let customInstructions = '';
  if (rest) {
    if ((rest as any).personalidade_agente?.trim()) {
      customInstructions += `\n\n### PERSONALIDADE E TOM DE VOZ\n${(rest as any).personalidade_agente.trim()}`;
    }
    if ((rest as any).exemplos_conversa?.trim()) {
      customInstructions += `\n\n### EXEMPLOS DE DIÁLOGOS\n${(rest as any).exemplos_conversa.trim()}`;
    }
    if ((rest as any).regras_estabelecimento?.trim()) {
      customInstructions += `\n\n### REGRAS ESPECÍFICAS\n${(rest as any).regras_estabelecimento.trim()}`;
    }
  }

  const finalPrompt = `${baseServicoPrompt}${customInstructions}`;
  const finalHasBraces = /\{[^}]+\}/.test(finalPrompt);
  console.log(`  Prompt final: ${finalPrompt.length} chars ${finalHasBraces ? '⚠️  CONTÉM CHAVES {}!' : '✅ Sem chaves'}`);
  
  if (finalHasBraces) {
    const matches = finalPrompt.match(/\{[^}]+\}/g);
    console.log(`  ❌ CHAVES PROBLEMÁTICAS ENCONTRADAS: ${JSON.stringify(matches)}`);
    for (const m of (matches || [])) {
      const idx = finalPrompt.indexOf(m);
      const start = Math.max(0, idx - 80);
      const end = Math.min(finalPrompt.length, idx + m.length + 80);
      console.log(`  Contexto: "...${finalPrompt.slice(start, end)}..."`);
    }
  } else {
    console.log('  ✅ Prompt final está SEGURO para uso com Langchain.');
  }
}

auditRestaurante();
