# Regras do Projeto - Sistema PedeAí

## Git

- **Push é SEMPRE manual.** O agente NÃO deve executar `git push`. Apenas `git add` e `git commit` são permitidos. O push será feito manualmente pelo desenvolvedor.

## Modo de Operação

- O restaurante San Pio opera no **modo comanda** (`billingMode = 'comanda'`). Cada check-in cria uma comanda individual.
- Ao fechar comandas, cada uma deve ser fechada **individualmente** (conta individual por WhatsApp).
- O botão "Dividir item" (split) aparece em **ambos os modos** (mesa e comanda).
- A pergunta "Quer dividir a conta?" no WhatsApp é feita **SOMENTE no modo mesa**. No modo comanda, a conta já é individual.
