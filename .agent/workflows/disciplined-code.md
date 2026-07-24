---
description: Processo disciplinado de implementação com 6 passos. Garante entendimento antes do código, critérios de sucesso claros e verificação ao final. Inclui modo /grill-me para entrevista técnica guiada antes de qualquer implementação.
---

# /disciplined-code — Codificação Disciplinada em 6 Passos

$ARGUMENTS

---

## Visão Geral

Este workflow impõe um protocolo rigoroso antes, durante e após qualquer implementação.
Nunca avance para o próximo passo sem concluir o anterior.

---

## Modo /grill-me (Opcional — Ative para requisitos vagos)

Ative **antes** de qualquer implementação quando:
- 🏗️ O projeto é novo e os detalhes não estão definidos
- 🔀 Há várias formas de resolver e trade-offs a decidir
- 🤔 A ideia está vaga (sabe o "quê", não o "como")
- ⚖️ Precisa escolher entre abordagens com implicações diferentes

### Como usar:
```
/grill-me [descrição da ideia ou tarefa]
```

### Protocolo de entrevista:
1. O agente faz **uma pergunta por vez** — estratégica e direta
2. O usuário responde
3. O agente refina o entendimento e faz a próxima pergunta
4. Ao final, gera um plano detalhado com todas as decisões resolvidas
5. Só então avança para o Passo 1

### Formato de abertura:
```
🔥 /grill-me ativado — vou te entrevistar antes de qualquer código.

Pergunta 1/N: [pergunta estratégica]
```

### Formato do plano final:
```
✅ Entrevista concluída.

📐 Plano:
- Tecnologia: [decisão]
- Arquitetura: [decisão]
- Prioridades: [decisão]
- Trade-offs resolvidos: [decisão]

→ Prosseguindo para o Passo 1.
```

---

## Passo 1 — Entender Antes de Codificar

- Releia o pedido do usuário com atenção
- Declare explicitamente o que foi entendido
- Se houver **qualquer ambiguidade**, apresente-a e pergunte
- **Nunca escolha silenciosamente** — dúvidas bloqueiam o avanço

```
📋 Entendimento: [declaração clara do que foi pedido]

❓ Ambiguidade (se houver): [descreva e pergunte]
```

> ⛔ Não avance se houver requisito incerto. Ative `/grill-me` se necessário.

---

## Passo 2 — Definir Critérios de Sucesso

Declare em uma linha o que "feito" significa:

```
✅ Feito = [critério claro e verificável]
```

Para tarefas com múltiplos passos, detalhe cada verificação:

```
✅ Feito quando:
- Passo 1 → verificar: [o que checar]
- Passo 2 → verificar: [o que checar]
- Passo N → verificar: [o que checar]
```

---

## Passo 3 — Planejar a Abordagem Mais Simples

- Descreva a abordagem em **2–3 linhas**
- Se existir alternativa mais simples, mencione
- **Não implemente** features não pedidas
- **Não adicione** abstrações desnecessárias
- **Não crie** "flexibilidade futura" sem pedido explícito (YAGNI)

```
🔧 Abordagem: [2-3 linhas da solução mais simples]
```

---

## Passo 4 — Implementar Cirurgicamente

- Escreva **apenas** o código necessário para o pedido
- Não reformate código adjacente
- Não renomeie o que não precisa ser renomeado
- Não "melhore" código fora do escopo da tarefa
- Mantenha o estilo existente do projeto

> ⚠️ Qualquer linha alterada além do estritamente necessário é violação deste passo.

---

## Passo 5 — Limpar os Próprios Órfãos

Após implementar, verifique se suas mudanças deixaram:

| Tipo | Ação |
|------|------|
| Imports inutilizados | → Remova |
| Variáveis não usadas | → Remova |
| Funções órfãs criadas por você | → Remova |
| Código morto pré-existente | → **Não toque** (fora do escopo) |

```
🧹 Limpeza: [imports/variáveis removidos, ou "nenhum órfão"]
```

---

## Passo 6 — Verificar Critérios de Sucesso

- Confirme que **cada critério** do Passo 2 foi atendido
- Se algo **não foi atendido** → itere antes de declarar concluído
- Se encontrar problema bloqueante → nomeie claramente e pergunte

```
✅ Verificação:
- [critério 1]: ✅ atendido / ❌ não atendido
- [critério 2]: ✅ atendido / ❌ não atendido
```

---

## Formato de Resposta Obrigatório

```
📋 Entendimento: [o que entendi do pedido]

✅ Feito = [critério de sucesso]

🔧 Abordagem: [2-3 linhas da solução mais simples]

[implementação]

🧹 Limpeza: [imports/variáveis removidos, ou "nenhum órfão"]

✅ Verificação: [cada critério confirmado]
```

---

## Anti-Padrões Proibidos

| ❌ Anti-padrão | ✅ Correto |
|---|---|
| Assumir significado ambíguo | Perguntar ao usuário |
| Adicionar "melhorias" não pedidas | Implementar só o pedido |
| Reformatar código adjacente | Tocar só no necessário |
| Criar abstrações "para o futuro" | YAGNI — só o que precisa agora |
| Declarar concluído sem verificar | Checar cada critério do Passo 2 |
| Deixar imports mortos | Limpar após edição |
| Avançar com requisitos vagos | Ativar `/grill-me` antes de codar |

---

## Exemplos de Uso

```
/disciplined-code adicionar validação ao formulário de contato
/disciplined-code refatorar a seção de cursos
/disciplined-code corrigir o bug de overflow no mobile
```

Com entrevista prévia:
```
/grill-me sistema de agendamento online
/grill-me integração com WhatsApp
/grill-me refatoração da navbar
```
