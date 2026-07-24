---
description: Coordinate multiple agents for complex tasks. Use for multi-perspective analysis, comprehensive reviews, or tasks requiring different domain expertise.
---

# Multi-Agent Orchestration

You are now in **ORCHESTRATION MODE**. Your task: coordinate specialized agents to solve this complex problem.

## Task to Orchestrate
$ARGUMENTS

---

## 🔴 CRITICAL: Minimum Agent Requirement

> ⚠️ **ORCHESTRATION = MINIMUM 3 DIFFERENT AGENTS**
> 
> If you use fewer than 3 agents, you are NOT orchestrating - you're just delegating.
> 
> **Validation before completion:**
> - Count invoked agents
> - If `agent_count < 3` → STOP and invoke more agents
> - Single agent = FAILURE of orchestration

### Agent Selection Matrix

| Task Type | REQUIRED Agents (minimum) |
|-----------|---------------------------|
| **Web App** | frontend-specialist, backend-specialist, test-engineer |
| **API** | backend-specialist, security-auditor, test-engineer |
| **UI/Design** | frontend-specialist, seo-specialist, performance-optimizer |
| **Database** | database-architect, backend-specialist, security-auditor |
| **Full Stack** | project-planner, frontend-specialist, backend-specialist, devops-engineer |
| **Debug** | debugger, explorer-agent, test-engineer |
| **Security** | security-auditor, penetration-tester, devops-engineer |
| **Auditoria de Módulo** | `/diagnostico-360` + `/diagnostico-ultra-rigoroso` + security-auditor |
| **Implementação Disciplinada** | `/disciplined-code` + test-engineer + debugger |
| **Conformidade LGPD** | `/lgpd-compliance-checker` + security-auditor + database-architect |

---

## Pre-Flight: Mode Check

| Current Mode | Task Type | Action |
|--------------|-----------|--------|
| **plan** | Any | ✅ Proceed with planning-first approach |
| **edit** | Simple execution | ✅ Proceed directly |
| **edit** | Complex/multi-file | ⚠️ Ask: "This task requires planning. Switch to plan mode?" |
| **ask** | Any | ⚠️ Ask: "Ready to orchestrate. Switch to edit or plan mode?" |

---

## 🔴 STRICT 2-PHASE ORCHESTRATION

### PHASE 1: PLANNING (Sequential - NO parallel agents)

| Step | Agent | Action |
|------|-------|--------|
| 1 | `project-planner` | Create docs/PLAN.md |
| 2 | (optional) `explorer-agent` | Codebase discovery if needed |

> 🔴 **NO OTHER AGENTS during planning!** Only project-planner and explorer-agent.

### ⏸️ CHECKPOINT: User Approval

```
After PLAN.md is complete, ASK:

"✅ Plan created: docs/PLAN.md

Do you approve? (Y/N)
- Y: Start implementation
- N: I'll revise the plan"
```

> 🔴 **DO NOT proceed to Phase 2 without explicit user approval!**

### PHASE 2: IMPLEMENTATION (Parallel agents after approval)

| Parallel Group | Agents |
|----------------|--------|
| Foundation | `database-architect`, `security-auditor` |
| Core | `backend-specialist`, `frontend-specialist` |
| Polish | `test-engineer`, `devops-engineer` |

> ✅ After user approval, invoke multiple agents in PARALLEL.

## 🔧 Workflows Especializados (Integrados ao Orchestrator)

Os workflows abaixo são **ativados diretamente pelo Orchestrator** quando o tipo de tarefa exige protocolos mais rigorosos do que agentes simples. Cada workflow é um processo completo com fases, checklists e saída obrigatória.

---

### `/diagnostico-360` — Auditoria Exaustiva + Correção Completa

> **Quando usar:** O módulo tem bugs recorrentes, qualidade degradada, ou nunca foi auditado formalmente.

**O que faz:** Varredura TOTAL de um módulo — lê TODOS os arquivos, classifica achados por severidade (P0–P3), corrige P0/P1 na sessão e prova via `grep` e `build` que os problemas foram eliminados.

**Fluxo de 5 fases obrigatórias:**
1. **INVENTÁRIO** — `list_dir` + tabela com todos os arquivos
2. **VARREDURA** — `view_file` em cada arquivo + 5 checklists (segurança, lógica, banco, performance, qualidade)
3. **CLASSIFICAÇÃO** — Gera `PLANO_DE_CORRECAO_{MODULO}.md`
4. **CORREÇÃO** — Corrige P0/P1 com releitura pós-edição obrigatória
5. **VERIFICAÇÃO** — Grep final + `npm run build` + inventário 100% ✅

**Ativar via Orchestrator:**
```
/diagnostico-360 módulo Comercial
/diagnostico-360 módulo Financeiro
```

---

### `/diagnostico-ultra-rigoroso` — Protocolo de Veracidade Absoluta

> **Quando usar:** Complemento automático do `/diagnostico-360` — ativado sempre que se fizer diagnóstico ou correção pontual para garantir rastreabilidade entre sessões.

**O que faz:** Protocolo anti-alucinação com 4 regras de ferro — toda evidência exige arquivo + linha + trecho; toda edição exige releitura pós-edição; inventário persistente entre sessões via `PLANO_DE_CORRECAO_{MODULO}.md`.

**Regras críticas:**
- **Evidência obrigatória:** `arquivo:linha — trecho exato`
- **Releitura pós-edição:** `view_file` na região ±10 linhas após cada `replace`
- **Continuidade entre sessões:** Inventário persistente com data de auditoria por arquivo
- **Sessão incompleta:** Gera handoff obrigatório com lista de arquivos não auditados

**Ativar via Orchestrator:**
```
Aplique o protocolo ultra-rigoroso ao corrigir [arquivo/módulo]
```

---

### `/disciplined-code` — Codificação Disciplinada em 6 Passos

> **Quando usar:** Qualquer nova implementação, refatoração ou correção de bug — especialmente em código com impacto em múltiplos módulos.

**O que faz:** Protocolo de 6 passos que garante entendimento antes do código, critérios de sucesso claros, implementação cirúrgica e verificação final obrigatória.

**6 Passos obrigatórios:**
1. **Entender** — Declarar o que foi entendido; bloquear se houver ambiguidade
2. **Critérios de Sucesso** — Definir `✅ Feito = [critério verificável]`
3. **Planejar** — Abordagem mais simples (2–3 linhas, YAGNI)
4. **Implementar** — Só o código necessário, sem reformatar adjacente
5. **Limpar** — Remover imports/variáveis órfãos criados na edição
6. **Verificar** — Confirmar cada critério do Passo 2

**Modo `/grill-me` (pré-implementação):** Entrevista Socrática antes do código para requisitos vagos ou com trade-offs.

**Ativar via Orchestrator:**
```
/disciplined-code adicionar validação ao formulário de contato
/grill-me sistema de agendamento online
```

---

### `/lgpd-compliance-checker` — DPO Técnico — Conformidade LGPD

> **Quando usar:** Qualquer código que trate dados pessoais, financeiros ou sensíveis de pessoas físicas/jurídicas — antes de merge ou deploy.

**O que faz:** Atua como DPO Técnico. Verifica 9 eixos de conformidade com a Lei 13.709/2018, classifica não-conformidades por criticidade e gera/atualiza `privacidade.md` na raiz do projeto.

**9 eixos de verificação:**
1. **Hardcoded Data** — CPF, tokens, API keys literais no código
2. **Base Legal** — Art. 7º/11 — toda coleta precisa de base legal documentada
3. **Consentimento** — Art. 8º — granular, registrado, revogável
4. **Minimização** — Art. 6º — só o campo necessário para a finalidade
5. **Segurança Técnica** — Art. 46/49 — TLS, bcrypt, AES-256, menor privilégio
6. **Direitos dos Titulares** — Art. 17–22 — endpoints de acesso, portabilidade, exclusão
7. **Compartilhamento** — Art. 37/39 — DPA com operadores, transferência internacional
8. **Notificação de Incidentes** — Art. 48 — detecção + PRI + 72h para ANPD
9. **RIPD** — Art. 38 — para sistemas de alto risco

**Níveis de criticidade:**
| Nível | Ação |
|-------|------|
| 🔴 CRÍTICO | Bloquear merge/deploy imediatamente |
| 🟠 ALTO | Corrigir antes do próximo release |
| 🟡 MÉDIO | Corrigir no sprint corrente |
| 🟢 BAIXO | Registrar e planejar |

**Ativar via Orchestrator:**
```
/lgpd-compliance-checker módulo de cadastro de clientes
/lgpd-compliance-checker antes do deploy v2.0
```

---

## Available Agents (17 total)

| Agent | Domain | Use When |
|-------|--------|----------|
| `project-planner` | Planning | Task breakdown, PLAN.md |
| `explorer-agent` | Discovery | Codebase mapping |
| `frontend-specialist` | UI/UX | React, Vue, CSS, HTML |
| `backend-specialist` | Server | API, Node.js, Python |
| `database-architect` | Data | SQL, NoSQL, Schema |
| `security-auditor` | Security | Vulnerabilities, Auth |
| `penetration-tester` | Security | Active testing |
| `test-engineer` | Testing | Unit, E2E, Coverage |
| `devops-engineer` | Ops | CI/CD, Docker, Deploy |
| `mobile-developer` | Mobile | React Native, Flutter |
| `performance-optimizer` | Speed | Lighthouse, Profiling |
| `seo-specialist` | SEO | Meta, Schema, Rankings |
| `documentation-writer` | Docs | README, API docs |
| `debugger` | Debug | Error analysis |
| `game-developer` | Games | Unity, Godot |
| `orchestrator` | Meta | Coordination |

---

## Orchestration Protocol

### Step 1: Analyze Task Domains
Identify ALL domains this task touches:
```
□ Security     → security-auditor, penetration-tester
□ Backend/API  → backend-specialist
□ Frontend/UI  → frontend-specialist
□ Database     → database-architect
□ Testing      → test-engineer
□ DevOps       → devops-engineer
□ Mobile       → mobile-developer
□ Performance  → performance-optimizer
□ SEO          → seo-specialist
□ Planning     → project-planner
```

### Step 2: Phase Detection

| If Plan Exists | Action |
|----------------|--------|
| NO `docs/PLAN.md` | → Go to PHASE 1 (planning only) |
| YES `docs/PLAN.md` + user approved | → Go to PHASE 2 (implementation) |

### Step 3: Execute Based on Phase

**PHASE 1 (Planning):**
```
Use the project-planner agent to create PLAN.md
→ STOP after plan is created
→ ASK user for approval
```

**PHASE 2 (Implementation - after approval):**
```
Invoke agents in PARALLEL:
Use the frontend-specialist agent to [task]
Use the backend-specialist agent to [task]
Use the test-engineer agent to [task]
```

**🔴 CRITICAL: Context Passing (MANDATORY)**

When invoking ANY subagent, you MUST include:

1. **Original User Request:** Full text of what user asked
2. **Decisions Made:** All user answers to Socratic questions
3. **Previous Agent Work:** Summary of what previous agents did
4. **Current Plan State:** If plan files exist in workspace, include them

**Example with FULL context:**
```
Use the project-planner agent to create PLAN.md:

**CONTEXT:**
- User Request: "A social platform for students, using mock data"
- Decisions: Tech=Vue 3, Layout=Grid Widgets, Auth=Mock, Design=Youthful & dynamic
- Previous Work: Orchestrator asked 6 questions, user chose all options
- Current Plan: playful-roaming-dream.md exists in workspace with initial structure

**TASK:** Create detailed PLAN.md based on ABOVE decisions. Do NOT infer from folder name.
```

> ⚠️ **VIOLATION:** Invoking subagent without full context = subagent will make wrong assumptions!


### Step 4: Verification (MANDATORY)
The LAST agent must run appropriate verification scripts:
```bash
python .agent/skills/vulnerability-scanner/scripts/security_scan.py .
python .agent/skills/lint-and-validate/scripts/lint_runner.py .
```

### Step 5: Synthesize Results
Combine all agent outputs into unified report.

---

## Output Format

```markdown
## 🎼 Orchestration Report

### Task
[Original task summary]

### Mode
[Current AG Kit Agent mode: plan/edit/ask]

### Agents Invoked (MINIMUM 3)
| # | Agent | Focus Area | Status |
|---|-------|------------|--------|
| 1 | project-planner | Task breakdown | ✅ |
| 2 | frontend-specialist | UI implementation | ✅ |
| 3 | test-engineer | Verification scripts | ✅ |

### Verification Scripts Executed
- [x] security_scan.py → Pass/Fail
- [x] lint_runner.py → Pass/Fail

### Key Findings
1. **[Agent 1]**: Finding
2. **[Agent 2]**: Finding
3. **[Agent 3]**: Finding

### Deliverables
- [ ] PLAN.md created
- [ ] Code implemented
- [ ] Tests passing
- [ ] Scripts verified

### Summary
[One paragraph synthesis of all agent work]
```

---

## 🔴 EXIT GATE

Before completing orchestration, verify:

1. ✅ **Agent Count:** `invoked_agents >= 3`
2. ✅ **Scripts Executed:** At least `security_scan.py` ran
3. ✅ **Report Generated:** Orchestration Report with all agents listed

> **If any check fails → DO NOT mark orchestration complete. Invoke more agents or run scripts.**

---

**Begin orchestration now. Select 3+ agents, execute sequentially, run verification scripts, synthesize results.**
