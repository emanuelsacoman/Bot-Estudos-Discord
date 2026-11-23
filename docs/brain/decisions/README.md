# Índice de decisões arquiteturais

Inicializado em 2026-11-07. Nenhum ADR histórico foi encontrado na auditoria inicial; a P1.3 estabelece a primeira decisão de execução abaixo e a P2.2 registra o escopo/privacidade de `/todo`, dentro dos respectivos pedidos autorizados. A arquitetura observada está em [ARCHITECTURE](../ARCHITECTURE.md); sugestões estão no [ROADMAP](../ROADMAP.md).

O usuário estabeleceu nesta tarefa que o contexto persistente deve viver em `AGENTS.md` e `docs/brain/`, ser atualizado junto do código e respeitar a prioridade das fontes de verdade. Este índice registra essa orientação documental; ela não comprova decisões históricas sobre a arquitetura de execução do bot.

| ADR | Título | Estado |
| --- | --- | --- |
| [0001](0001-isolamento-dos-timers.md) | Isolamento dos timers por contexto | Aceita na P1.3 |
| [0002](0002-privacidade-e-isolamento-do-todo.md) | Privacidade e isolamento do /todo, com cotas agregadas por usuário | Aceita na P2.2 |
| [0003](0003-estado-operacional-temporario.md) | Estado operacional temporário, exclusivamente em memória; volatilidade aceita | Aceita pelo responsável em 2026-11-07 |

O ADR 0003 mantém o isolamento/privacidade dos ADRs 0001/0002 e substitui a expectativa anterior de decidir persistência como pendência técnica. Esses registros históricos continuam preservados.

Quando uma decisão relevante for realmente estabelecida/aprovada, criar `NNNN-titulo-curto.md` e adicionar link a este índice. Registrar: título, data, estado (proposta/aceita/substituída), contexto e evidências, decisão, alternativas consideradas, consequências e referência à aprovação quando aplicável. Uma proposta nunca deve aparecer como aceita sem base.

Documente restrições e consequências com precisão, sem reconstruir intenções passadas a partir de uma escolha de biblioteca. Se uma decisão mudar, preserve o registro anterior e indique o ADR que o substituiu. Atualize [PROJECT_STATE](../PROJECT_STATE.md) e [CURRENT](../CURRENT.md) quando a decisão afetar o estado/continuidade.
