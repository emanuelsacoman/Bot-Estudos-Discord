# ADR 0002 — Privacidade e isolamento do /todo

- **Data:** 2026-11-07 (America/Sao_Paulo).
- **Estado:** aceita na implementação autorizada da P2.2.
- **Escopo:** `/todo`, armazenamento em memória, sem alterar nomes/opções slash.

## Contexto e autorização

Na P2.1, uma lista era global por usuário e suas confirmações/listagem normais eram públicas. Assim, o mesmo usuário podia exibir acidentalmente tarefas de um servidor em outro. O pedido P2.2 determina explicitamente servidor `guildId + userId`, DM `DM + userId`, privacidade e preservação das cotas, sem persistência externa. Esta decisão estabelece esse comportamento e mantém o risco de perda por reinício separado da exposição de contexto.

## Decisão

Cada servidor tem uma lista independente por usuário. Em DM há uma única lista por usuário, independente do canal. Criação, listagem e remoção exigem contexto explícito válido; contexto ausente/inválido é recusado sem consultar uma lista global ou inferir DM. Maps aninhados distinguem usuário, servidor e DM, sem composição ambígua de strings.

Todas as respostas do comando são efêmeras: confirmações de inclusão/remoção, listagem em embed ou anexo, lista vazia, duplicata e demais erros. Erros usam mensagens fixas sem texto de tarefas; diagnósticos não registram tarefas nem erros brutos. O helper compartilhado continua responsável por privacidade após defer/reply e por impedir retry de entrega ambígua.

O tamanho de cada tarefa continua **1967 unidades UTF-16**. As cotas de **100 tarefas** e **64 KiB UTF-8** são agregadas por usuário entre todos os seus servidores e DM; consequentemente cada lista também contém no máximo 100 tarefas. Essa interpretação conserva a capacidade total anterior e impede multiplicá-la pela quantidade de servidores. O processo admite até **8 MiB de texto UTF-8** e **1024 usuários distintos com ao menos uma tarefa**. Os contextos não vazios são limitados pela quantidade de tarefas, sem reservar listas vazias. São políticas de admissão, não limites exatos de heap.

Inserções validam duplicata/cotas antes de alterar o estado; capacidade esgotada recusa o novo item sem expulsar dados. Remoção libera bytes/contagens, apaga contexto vazio e libera a vaga global quando o usuário não possui tarefa em nenhum contexto. Operações locais são síncronas e terminam antes de aguardar a entrega Discord; se a confirmação falhar, o efeito local permanece e não é repetido.

## Alternativas consideradas

- Lista global por usuário: preservaria a exposição entre servidores que motivou R09.
- Lista por canal em servidores ou DM: ampliaria o escopo além do pedido; canais do mesmo servidor compartilham a lista privada daquele usuário, e DM usa apenas o usuário.
- Cotas independentes por servidor: multiplicariam os 100 itens/64 KiB anteriores e permitiriam contornar a capacidade por usuário. A agregação conserva os números da P2.1.
- Copiar automaticamente uma lista global antiga para todos os servidores: não há informação de origem para decidir seu destino; a cópia criaria exposição e duplicaria cotas.
- Banco, arquivo persistente ou sincronização externa: não autorizados nesta fase; exigem decisão específica posterior.

## Consequências, transição e limites

O usuário deve consultar/remover no mesmo servidor em que criou a tarefa, ou em DM para tarefas de DM. Uma tarefa textual igual em outro contexto pode ser adicionada independentemente, consumindo a mesma cota agregada do usuário. Não há transferência/mesclagem implícita entre contextos.

Uma nova instância de armazenamento começa vazia. Reiniciar o bot apaga as tarefas; não há sincronização entre processos nem recuperação após falha de hospedagem. Não se realiza migração em execução do estado global antigo: listas anteriores só vivem no processo antigo e não são copiadas para contextos inferidos. Esta tarefa não reiniciou processos nem leu/apagou dados reais. Antes de um futuro reinício autorizado, listas antigas importantes precisam de preservação manual por procedimento privado explicitamente autorizado; esta decisão não autoriza exportação sensível, reinício ou publicação de tarefas.

R09 permanece **`MITIGATED`**, pois a privacidade/isolamento local reduz a exposição, mas a perda de dados por reinício permanece parte do risco original. Persistência futura depende de requisitos de retenção, privacidade, recuperação e decisão arquitetural próprios.

Implementação em [todo-store.js](../../../lib/todo-store.js) e [todo.js](../../../commands/todo.js). Evidências offline, contratos e limitações são mantidos em [QUALITY_GATES](../QUALITY_GATES.md); operação real continua `NOT_CONFIRMED`.
