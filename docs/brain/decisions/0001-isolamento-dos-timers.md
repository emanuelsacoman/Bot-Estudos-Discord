# ADR 0001 — Isolamento dos timers por contexto

- **Data:** 2026-11-07 (America/Sao_Paulo).
- **Estado:** aceita na implementação autorizada da P1.3.
- **Escopo:** `/timer`, sem persistência e sem alterar nomes/opções slash.

## Contexto e autorização

O timer anterior usava somente o ID do usuário. Assim, definir ou cancelar um timer em um servidor podia substituir/cancelar o timer desse usuário em outro servidor. O pedido P1.3, seção R08, determina priorizar isolamento entre servidores quando for necessário escolher o escopo. Esta decisão estabelece o comportamento a partir dessa tarefa; não descreve uma intenção histórica.

## Decisão

Cada usuário tem no máximo um timer agendado por servidor. A chave identifica explicitamente servidor e usuário; em mensagens diretas, identifica canal e usuário. Dentro do mesmo servidor, definir outro timer substitui o anterior, mesmo em outro canal, e a notificação usa o canal da nova definição. Cancelar atua somente no contexto atual.

A representação da chave distingue servidor de DM e evita colisões entre seus componentes. Contexto insuficiente é recusado, sem recorrer a uma chave global. O callback conserva somente o canal e o conteúdo da notificação, sem reter a interação e seu token.

## Alternativas consideradas

- Usuário global: manteria a interferência entre servidores que motivou a correção.
- Canal e usuário em todos os contextos: permitiria vários timers do mesmo usuário no mesmo servidor, ampliando o comportamento além do isolamento solicitado.
- Persistência: não autorizada nesta etapa; o estado continua em memória.

## Consequências e evidências

O usuário precisa cancelar no mesmo servidor ou canal de DM em que definiu o timer. Reiniciar perde os timers. Uma notificação cujo envio já começou não é cancelada retroativamente por um novo timer ou por `stop`. A conclusão remove o agendamento antes de enviar; callbacks antigos não podem remover um agendamento novo.

O agendamento local ocorre antes da confirmação Discord; uma falha de entrega da confirmação não desfaz automaticamente o timer, pois a entrega pode ter ocorrido. Esse limite não representa atomicidade entre memória local e Discord.

Implementação em [timers.js](../../../lib/timers.js) e [comando](../../../commands/timer.js); isolamento, substituição e limpeza são verificados em [testes](../../../tests/timers.test.js). Comandos, ambiente, resultados e limites da validação estão em [QUALITY_GATES](../QUALITY_GATES.md).
