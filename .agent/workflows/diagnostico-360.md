---
description: "Auditoria 360° EXAUSTIVA de um módulo. Varredura arquivo-por-arquivo com inventário obrigatório, execução imediata de correções, e prova final de cobertura 100%. NÃO gera apenas relatório — CORRIGE e PROVA."
---

# /diagnostico-360 — Auditoria Exaustiva + Correção Completa

$ARGUMENTS

---

## 🎯 Objetivo

Executar uma varredura **TOTAL** de um módulo, cobrindo TODOS os arquivos sem exceção.
Ao final, TODOS os problemas encontrados devem estar **CORRIGIDOS** e **VERIFICADOS** — não apenas documentados.

> [!CAUTION]
> **REGRA ZERO:** Este workflow NÃO termina até que:
> 1. TODO arquivo do módulo tenha sido LIDO (não apenas mencionado)
> 2. TODO achado P0/P1 tenha sido CORRIGIDO (não apenas documentado)
> 3. TODO arquivo corrigido tenha sido RELIDO para confirmar persistência
> 4. Um `grep` final PROVE que os padrões problemáticos foram eliminados

---

## 🤖 Agentes e Skills Ativados

| Agente | Skill | Foco |
|--------|-------|------|
| `security-auditor` | `vulnerability-scanner` | OWASP, RLS bypass, sanitização, exposição de segredos |
| `debugger` | `systematic-debugging` | Bugs de lógica, race conditions, condições impossíveis |
| `database-architect` | `database-design` | Query ineficiente, filtro ignorado, N+1 |
| `frontend-specialist` | `react-best-practices` | Re-renders, useMemo ausente, componentes dentro de componentes |
| `clean-code` | `clean-code` | Código morto, DRY, imports órfãos |

---

## 🔄 Fases de Execução (5 Fases Obrigatórias)

### FASE 1 — INVENTÁRIO COMPLETO (Obrigatório, NÃO Pular)

> 🔴 **BLOQUEANTE:** A Fase 2 NÃO pode começar sem o inventário completo.

**Passo 1.1 — Gerar inventário de arquivos**

Usar `list_dir` e/ou `grep` para listar TODOS os arquivos do módulo:
- `src/hooks/{módulo}/` — Cada `.ts` / `.tsx`
- `src/pages/{módulo}/` — Cada `.tsx`
- `src/pages/{módulo}/components/` — Cada `.tsx` (incluindo subpastas)
- `src/types/{módulo}*` — Tipos relacionados
- `src/utils/{módulo}*` — Utils relacionados

**Passo 1.2 — Criar tabela de inventário no artefato**

```markdown
## Inventário de Arquivos

| # | Arquivo | Tipo | LOC | Fase 2 (Lido) | Fase 3 (Achados) | Fase 4 (Corrigido) | Fase 5 (Verificado) |
|---|---------|------|-----|:---:|:---:|:---:|:---:|
| 1 | `hooks/useXxx.ts` | Hook | 120 | ⬜ | ⬜ | ⬜ | ⬜ |
| 2 | `pages/XxxPage.tsx` | Page | 340 | ⬜ | ⬜ | ⬜ | ⬜ |
```

> 🔴 **TODOS os ⬜ devem virar ✅ até o final da sessão.** Qualquer ⬜ remanescente = sessão incompleta.

---

### FASE 2 — VARREDURA EXAUSTIVA (Leitura de CADA Arquivo)

> 🔴 **NÃO é leitura seletiva. É leitura de TODO arquivo do inventário, do início ao fim.**

**Para CADA arquivo do inventário, executar `view_file` e aplicar TODOS os checklists abaixo:**

#### 2.1 Checklist de Segurança (`security-auditor`)
- [ ] `import { supabase }` presente em página/componente? → **P0** (deve estar apenas em hooks)
- [ ] `select('*')` sem colunas explícitas? → **P0**
- [ ] Mutations sem guard de `role` / `permissão`? → **P0**
- [ ] Non-null assertions (`!`) em dados de query assíncrona? → **P1**
- [ ] Campos sensíveis expostos (password, token, secret)? → **P0**
- [ ] Filtros RLS dependentes de string matching client-side? → **P0**
- [ ] Queries sem `.eq('user_id', user.id)` quando necessário? → **P1**

#### 2.2 Checklist de Lógica (`debugger`)
- [ ] Race condition: state usado em `queryFn` sem guard de null? → **P0**
- [ ] `.filter()` client-side que poderia ser `.eq()` server-side? → **P1**
- [ ] Componente React declarado DENTRO de outro componente? → **P1**
- [ ] `useCallback` retornando JSX (usado como componente)? → **P1**
- [ ] Condição impossível (ex: `status === 'x' && status === 'y'`)? → **P0**
- [ ] `catch` vazio (erro silenciado)? → **P1**
- [ ] Promise sem `await` (fire-and-forget acidental)? → **P1**

#### 2.3 Checklist de Banco (`database-architect`)
- [ ] Queries sem `staleTime` (refetch desnecessário)? → **P1**
- [ ] Realtime sem debounce em tabela de alto write? → **P1**
- [ ] N+1: query dentro de `.map()` ou loop? → **P0**
- [ ] `queryKey` com valor `undefined`/`null` sem fallback? → **P1**
- [ ] Falta `enabled: !!dep` quando query depende de estado? → **P1**
- [ ] Falta `limit()` ou `range()` em queries de lista? → **P2**

#### 2.4 Checklist de Performance (`frontend-specialist`)
- [ ] Derivação pesada sem `useMemo` (arrays, objetos, maps)? → **P1**
- [ ] `useMemo(() => x, [x])` sem transformação (identity memo)? → **P2**
- [ ] Função chamada N vezes dentro de grid/loop sem memo? → **P1**
- [ ] `O(N²)`: loop aninhado sobre arrays grandes? → **P1**
- [ ] Props recalculadas inline no JSX sem memo? → **P2**
- [ ] `NodeJS.Timeout` em código browser? → **P2**

#### 2.5 Checklist de Qualidade (`clean-code`)
- [ ] Import não utilizado? → **P2**
- [ ] Variável declarada mas nunca referenciada? → **P2**
- [ ] Interface/tipo duplicado (mesmo tipo em múltiplos arquivos)? → **P2**
- [ ] Handler declarado mas não conectado a evento? → **P2**
- [ ] Código comentado (ruído)? → **P2**
- [ ] Constantes mágicas (strings/números sem nome)? → **P2**

**Após ler cada arquivo, marcar ✅ na coluna "Fase 2 (Lido)" do inventário.**

> 🔴 **Se um arquivo NÃO foi `view_file` + checklist aplicado = NÃO conta como auditado.**

---

### FASE 3 — CLASSIFICAÇÃO + PLANO DE CORREÇÃO

**Passo 3.1 — Classificar todos os achados**

| Severidade | Critério | Ação |
|:---:|---|---|
| **P0 — Crítico** | Corrompe dados, crash, KPI errado, vulnerabilidade de segurança | **CORRIGIR IMEDIATAMENTE na Fase 4** |
| **P1 — Alto** | Bug de lógica, UX degradada, performance problemática | **CORRIGIR na Fase 4** |
| **P2 — Médio** | Código morto, manutenibilidade, DRY | **CORRIGIR se tempo permitir, senão documentar para próxima sessão** |
| **P3 — Info** | Sugestão de melhoria, padrão alternativo | **Documentar apenas** |

**Passo 3.2 — Gerar `PLANO_DE_CORRECAO_{MODULO}.md`**

Formato obrigatório para CADA achado:

```markdown
### [ID]: [Título]
- **Arquivo:** `caminho/arquivo.ts` · Linha X-Y
- **Severidade:** P0/P1/P2
- **Evidência:** [trecho exato do código problemático]
- **Impacto:** [o que acontece em produção]
- **Correção:**
  ```diff
  - código errado
  + código correto
  ```
- **Status:** ⬜ Pendente
```

**Marcar ✅ na coluna "Fase 3 (Achados)" para cada arquivo processado.**

---

### FASE 4 — EXECUÇÃO DAS CORREÇÕES (P0 + P1 Obrigatórios)

> 🔴 **REGRA ABSOLUTA:** P0 e P1 são corrigidos NESTA SESSÃO. Não "na próxima".

**Para CADA correção:**

1. **Abrir arquivo** com `view_file` (confirmar estado atual)
2. **Aplicar correção** com `replace_file_content` ou `multi_replace_file_content`
3. **RELER arquivo corrigido** com `view_file` na região editada
4. **Confirmar** que a correção persiste e não quebrou código adjacente
5. **Marcar ✅** na coluna "Fase 4 (Corrigido)" do inventário
6. **Marcar ✅** no `Status` do achado no PLANO_DE_CORRECAO

**Ordem de execução:**
1. Todos os P0 primeiro (ordem do inventário)
2. Todos os P1 em seguida
3. P2 se tempo permitir

> [!WARNING]
> **Protocolo de Veracidade Absoluta:**
> - Após CADA edição, RELER o arquivo editado (mínimo a região alterada ±10 linhas)
> - Se a releitura mostrar que a edição NÃO persistiu → REPORTAR como falha e tentar novamente
> - NÃO marcar ✅ sem releitura confirmada

---

### FASE 5 — VERIFICAÇÃO FINAL (Prova de Cobertura 100%)

> 🔴 **BLOQUEANTE:** A sessão NÃO termina sem esta fase.

**Passo 5.1 — Grep de padrões eliminados**

Executar grep para PROVAR que os padrões problemáticos foram eliminados:

```bash
# Verificar que não há supabase direto em pages
grep -r "import.*supabase" src/pages/{módulo}/ --include="*.tsx"

# Verificar que não há select('*')
grep -r "select\('\\*'\)" src/hooks/{módulo}/ --include="*.ts"

# Verificar que não há NodeJS.Timeout
grep -r "NodeJS.Timeout" src/hooks/{módulo}/ --include="*.ts"
```

**Cada grep deve retornar ZERO resultados.** Se retornar algo → voltar à Fase 4 e corrigir.

**Passo 5.2 — Verificação de Build**

```bash
npm run build 2>&1 | head -50
```

Build DEVE passar sem erros TypeScript. Warnings são aceitáveis mas devem ser documentados.

**Passo 5.3 — Atualizar inventário final**

Marcar ✅ na coluna "Fase 5 (Verificado)" para cada arquivo que passou na verificação.

**Passo 5.4 — Atualizar PLANO_DE_CORRECAO com status final**

```markdown
## Resultado Final

| Métrica | Valor |
|---------|-------|
| Arquivos no inventário | X |
| Arquivos auditados | X (deve ser 100%) |
| Achados P0 encontrados | X |
| Achados P0 corrigidos | X (deve ser 100%) |
| Achados P1 encontrados | X |
| Achados P1 corrigidos | X (deve ser 100%) |
| Achados P2 encontrados | X |
| Achados P2 corrigidos | X / X |
| Build status | ✅ / ❌ |
| Grep residual | 0 padrões encontrados |
```

---

## ⚠️ Regras Absolutas

1. **NUNCA pular a Fase 1.** Sem inventário = sem garantia de cobertura.
2. **NUNCA encerrar na Fase 3.** Gerar plano sem executar = desperdício.
3. **CADA arquivo deve ser `view_file` lido.** Mencionar sem ler NÃO conta.
4. **CADA edição deve ser RELIDA.** Dizer "corrigi" sem releitura = mentira.
5. **Grep final é OBRIGATÓRIO.** Sem prova de eliminação = sessão incompleta.
6. **P0 e P1 são corrigidos NESTA sessão.** Não existe "faço depois".
7. **Se o contexto da sessão estourar antes de terminar** → gerar relatório parcial com lista EXATA de arquivos não auditados e achados não corrigidos, para que a próxima sessão COMECE de onde parou.
8. **NUNCA fabricar achados.** Se um arquivo está limpo → está limpo. Marcar ✅ e seguir.
9. **Evidência = arquivo + linha + trecho.** Achado sem evidência é DESCARTADO.
10. **Supabase Security/Performance Advisors** devem ser consultados como parte da Fase 2 (banco).

---

## 📋 Template de Saída Final no Chat

```markdown
## ✅ Diagnóstico 360° — [Módulo] — COMPLETO

### Cobertura
- Arquivos inventariados: X
- Arquivos auditados: X/X (100%)

### Achados
| Sev. | Encontrados | Corrigidos | Pendentes |
|------|:-----------:|:----------:|:---------:|
| P0   | X           | X          | 0         |
| P1   | X           | X          | 0         |
| P2   | X           | X          | X         |

### Verificação Final
- ✅ Grep: 0 padrões residuais
- ✅ Build: passou sem erros
- ✅ Releitura: todos os arquivos editados confirmados

### Arquivos do Plano
- `PLANO_DE_CORRECAO_{MODULO}.md` — atualizado com status final
```

---

## 🚀 Exemplos de Uso

```
/diagnostico-360 módulo de Coordenação
/diagnostico-360 módulo Financeiro
/diagnostico-360 módulo Logística
```
