import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

/**
 * Tool: Calculadora
 * Avalia expressões matemáticas simples.
 * Implementada como DynamicStructuredTool para conformidade com Structured Outputs da OpenAI.
 */
export const calculadoraTool = new DynamicStructuredTool({
  name: 'Calculadora',
  description: 'Calcula expressões matemáticas. Use para somar preços, calcular totais, etc.',
  schema: z.object({
    expressao: z.string().describe('Expressão matemática simples a ser avaliada (ex: "10.50 * 3 + 5.00").'),
  }),
  func: async ({ expressao }) => {
    try {
      // Sanitiza: permite apenas números, operadores e pontos
      const sanitized = expressao.replace(/[^0-9+\-*/().%\s]/g, '');
      if (!sanitized.trim()) {
        return 'Expressão inválida. Use apenas números e operadores (+, -, *, /).';
      }

      // Avalia a expressão
      const result = Function(`"use strict"; return (${sanitized})`)();

      if (typeof result !== 'number' || isNaN(result)) {
        return 'Não foi possível calcular. Verifique a expressão.';
      }

      return result.toString();
    } catch (err: any) {
      return `Erro no cálculo: ${err.message}`;
    }
  },
});
