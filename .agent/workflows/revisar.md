---
description: Realiza a revisão de código/mudanças recentes com base em escopo, simplicidade e correção.
---

# /revisar

Revise a última mudança ou o código selecionado com base nestes critérios:

**Escopo**
- Toda linha alterada rastreia diretamente à solicitação?
- Arquivos, comentários ou formatação não relacionados foram tocados? Se sim, aponte.
- Imports/funções desnecessários preexistentes foram removidos sem pedido? Aponte.

**Simplicidade**
- Isso poderia ser escrito em significativamente menos linhas sem perder clareza?
- Há abstrações, configurações ou tratamentos de erro que não foram solicitados?

**Correção**
- Há premissas assumidas que deveriam ter sido perguntas?
- Os critérios de sucesso estão definidos e verificáveis?

Formato de saída:
- ✅ O que está bom
- ⚠️ O que reconsiderar (com sugestão específica)
- ❌ O que viola as regras (com correção)
