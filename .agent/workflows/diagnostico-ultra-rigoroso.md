---
description: "Protocolo de Veracidade Absoluta para diagnósticos e correções. Exige prova de linha, releitura pós-edição, e rastreabilidade de cobertura entre sessões. Complementa o diagnostico-360."
---

# 🕵️‍♂️ Protocolo Ultra-Rigoroso — Veracidade Absoluta

> **Este protocolo é ativado automaticamente pelo `/diagnostico-360`.**
> Pode também ser invocado standalone para qualquer tarefa de correção de código.

---

## 🛡️ 1. Protocolo Anti-Alucinação (4 Regras de Ferro)

### Regra 1: Evidência Obrigatória

O agente **NÃO PODE** afirmar que existe um problema sem:
- Citar o **arquivo exato** (caminho completo)
- Citar a **linha exata** (número)
- Citar o **trecho exato** do código (copiar, não parafrasear)

```
❌ ERRADO: "O hook useCoordDashboard tem um problema de performance"
✅ CERTO:  "useCoordDashboard.ts:47 — `const stats = { pending: data.filter(...).length }` recalcula sem useMemo"
```

### Regra 2: Validação de Escopo de Variáveis

Antes de referenciar qualquer variável:
1. Confirmar ONDE foi declarada (arquivo, linha, escopo)
2. Confirmar se está dentro de um objeto (ex: `stats.pending` vs `pending`)
3. Confirmar se o escopo de acesso é válido (ex: variável de hook acessível no componente?)

```
❌ ERRADO: usar `notificacoesNaoLidas` direto
✅ CERTO:  verificar que `notificacoesNaoLidas` vem de `const { notificacoesNaoLidas } = useNotificacoes()`
```

### Regra 3: Releitura Pós-Edição (Double-Check)

Após **QUALQUER** edição de arquivo:
1. Executar `view_file` no arquivo editado (região editada ± 10 linhas)
2. Confirmar que o conteúdo salvo corresponde à edição pretendida
3. Se não corresponder → reportar falha e tentar novamente
4. **SÓ marcar como corrigido após releitura confirmada**

```
❌ ERRADO: "Corrigi o arquivo" (sem releitura)
✅ CERTO:  [editar] → [view_file] → "Confirmado: linha 47 agora contém `useMemo(...)`"
```

### Regra 4: Nunca Inventar Achados

Se um arquivo está limpo → está limpo. **NÃO criar problemas fictícios** para justificar a auditoria.
A integridade do relatório depende de ZERO falsos positivos.

---

## 📦 2. Protocolo de Continuidade Entre Sessões

### Problema que este protocolo resolve:
> "Toda vez que rodo o diagnóstico, acham problemas que deveriam ter sido corrigidos."

### Causa raiz:
Sessões anteriores corrigiam **subconjuntos** de arquivos sem rastrear quais arquivos **NÃO** foram tocados.

### Solução: Inventário Persistente

**Ao INICIAR qualquer sessão de diagnóstico/correção:**

1. **Verificar se existe `PLANO_DE_CORRECAO_{MODULO}.md` anterior**
   - Se existe → LER e identificar achados marcados como `⬜ Pendente`
   - Se existe → Verificar com `grep` se os achados "✅ Corrigido" realmente estão corrigidos
   - Se não existe → Criar novo

2. **Usar o inventário como estado compartilhado**

```markdown
## Inventário de Arquivos (Estado Persistente)

| # | Arquivo | Última Auditoria | Status |
|---|---------|:---:|:---:|
| 1 | `hooks/useXxx.ts` | 2026-04-17 | ✅ Limpo |
| 2 | `pages/XxxPage.tsx` | 2026-04-17 | ✅ Corrigido (3 P0) |
| 3 | `pages/YyyPage.tsx` | ❌ NUNCA | ⬜ Pendente |
```

3. **Na próxima sessão**, o inventário mostra imediatamente:
   - Quais arquivos NUNCA foram auditados (⬜)
   - Quais foram auditados e quando
   - Quais precisam de re-verificação (se houve mudanças desde a última auditoria)

---

## 🔒 3. Protocolo de Correção Segura

### 3.1 — Antes de editar

```
1. view_file → Ler estado atual
2. Confirmar que o problema EXISTE no estado atual
3. Se o problema JÁ foi corrigido → NÃO editar, marcar ✅
```

### 3.2 — Durante a edição

```
1. Usar replace_file_content com TargetContent EXATO
2. NÃO substituir blocos grandes desnecessariamente
3. Se múltiplas edições no mesmo arquivo → usar multi_replace_file_content
4. NUNCA editar 2 arquivos em paralelo com o mesmo tool call
```

### 3.3 — Depois de editar

```
1. view_file → Reler região editada (±10 linhas)
2. Confirmar correspondência com a intenção
3. Se OK → Marcar ✅ no inventário
4. Se FALHOU → Reportar e tentar novamente
```

---

## 🚨 4. Protocolo de Sessão Incompleta

> Se o contexto estourar ou a sessão precisar terminar antes de cobrir todos os arquivos:

**OBRIGATÓRIO gerar relatório de handoff:**

```markdown
## ⚠️ SESSÃO INCOMPLETA — Handoff para Próxima Sessão

### Progresso
- Arquivos auditados: X/Y
- P0 corrigidos: X/X
- P1 corrigidos: X/X

### Arquivos NÃO Auditados (próxima sessão deve começar aqui)
1. `pages/NaoAuditado1.tsx` — ⬜ Nunca lido
2. `components/SubComp.tsx` — ⬜ Nunca lido

### Achados NÃO Corrigidos
- P1-03: staleTime em CoordReports (documentado, não aplicado)
- P2-01: NodeJS.Timeout em 4 hooks (documentado, não aplicado)

### Grep Pendente (executar na próxima sessão)
- `grep -r "import.*supabase" src/pages/coordination/`
- `grep -r "select('*')" src/hooks/coordination/`
```

---

## 📋 5. Checklist de Encerramento de Sessão

Antes de encerrar, o agente DEVE responder:

| Pergunta | Resposta Esperada |
|---|---|
| Todos os arquivos do inventário foram lidos? | Sim, X/X |
| Todos os P0 foram corrigidos? | Sim, X/X |
| Todos os P1 foram corrigidos? | Sim, X/X |
| Todos os arquivos editados foram relidos? | Sim |
| Grep final foi executado? | Sim, 0 padrões residuais |
| Build passou? | Sim / Não (motivo) |
| Se incompleto, handoff foi gerado? | Sim |

**Se qualquer resposta for "Não" → a sessão NÃO está completa.**

---

## 🚀 Comando de Ativação

```
/diagnostico-360 [módulo]
```

O `/diagnostico-360` já inclui este protocolo automaticamente.
Para uso standalone em correções pontuais:

```
Aplique o protocolo ultra-rigoroso ao corrigir [arquivo/módulo]
```