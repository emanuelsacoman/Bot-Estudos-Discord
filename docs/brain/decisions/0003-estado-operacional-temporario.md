# ADR 0003 — Estado operacional temporário, exclusivamente em memória

- **Data:** 2026-11-07 (America/Sao_Paulo).
- **Estado:** aceita por decisão explícita do responsável pelo CodeBucket.
- **Escopo:** todo estado operacional do bot, incluindo tarefas, timers e cooldowns; sem alteração de código ou dos 23 contratos públicos nesta entrega.

## Contexto e autorização

O pedido “Decisão Arquitetural: Estado Temporário” estabelece que o CodeBucket deve funcionar sem persistência de dados, priorizando simplicidade e compatibilidade com hospedagens gratuitas. Essa motivação não comprova disponibilidade, uptime ou compatibilidade de um provedor específico, que continuam `NOT_CONFIRMED`.

O código atual já mantém tarefas em Maps por usuário/contexto, timers em Map e cooldowns em Collections/timeouts. Os ADRs [0001](0001-isolamento-dos-timers.md) e [0002](0002-privacidade-e-isolamento-do-todo.md) registram isolamento e privacidade sem persistência nas respectivas fases. A expectativa de decidir futuramente sobre persistência deixa de ser uma pendência técnica obrigatória: o responsável aceita agora a volatilidade como política do produto.

## Decisão

1. Todo estado operacional permanece exclusivamente na memória do processo. Tarefas, timers e cooldowns não sobrevivem ao encerramento/reinício.
2. Não implementar SQLite, Firebase, Firestore, Redis ou qualquer outro banco de dados para esse estado.
3. Não utilizar arquivos locais, snapshots, dumps, backups ou mecanismos equivalentes para persistir/restaurar tarefas, timers ou cooldowns. Logs não são armazenamento alternativo desse estado.
4. A perda desses dados após reinicializações, encerramentos ou falhas de hospedagem é conhecida e aceita deliberadamente. Não existe restauração automática, replay ou sincronização entre processos.
5. Preservar os limites de memória, os escopos de isolamento e as proteções de privacidade existentes. Manter os ADRs 0001/0002: timer por servidor+usuário ou canal de DM+usuário; todo por servidor+usuário ou DM+usuário, com respostas efêmeras e cotas agregadas por usuário.
6. Não adicionar dependências ou infraestrutura de persistência. Preservar os 23 contratos públicos, nomes, opções e interfaces `data`/`execute(interaction)`.

Os tetos atuais de todo permanecem: 1967 unidades UTF-16 por tarefa; 100 tarefas e 64 KiB UTF-8 somados por usuário entre todos os contextos; 8 MiB de texto e 1024 usuários distintos por processo. Timers conservam a duração de 1–1440 minutos, substituição/cancelamento e limpeza existentes. Cooldowns conservam o controle e a expiração em memória já implementados. Esta decisão não cria nem amplia cotas.

Fontes, documentação, assets e configuração/credenciais de operação não são o estado temporário acima. Seus procedimentos de distribuição e proteção continuam válidos. Anexos em Buffer não constituem persistência de estado; não se cria recurso de exportação, arquivamento ou restauração de listas nesta tarefa.

## Alternativas consideradas

- Banco local/externo ou arquivos de estado: rejeitados pela decisão do responsável, devido à simplicidade e ausência de infraestrutura de persistência pretendidas.
- Persistência como pendência obrigatória: rejeitada; a volatilidade é um comportamento aceito, não um requisito de armazenamento ainda por implementar.
- Isolamento/privacidade mais fracos para simplificar: rejeitados; limites e proteções existentes continuam obrigatórios.

## Consequências e evolução

Após reinício, tarefas começam vazias, timers anteriores não são retomados e cooldowns anteriores deixam de existir. Falha de hospedagem não permite recuperar esse estado. Instâncias distintas têm estados e cotas independentes; não se promete continuidade entre processos, nem se introduz coordenação externa.

R09 permanece **`MITIGATED`**: isolamento e privacidade foram tratados na P2.2, mas a volatilidade continua sendo uma consequência real, agora aceita deliberadamente. A aceitação não altera o risco para `RESOLVED`, nem certifica operação remota.

Os ADRs 0001/0002 permanecem válidos para seus escopos. Este ADR complementa suas decisões e substitui somente a expectativa de tratar persistência como escolha técnica futura pendente. Seus textos históricos são preservados. Alterar a política exigiria nova decisão explícita do responsável e um ADR que substitua esta restrição; não é um item de implementação autorizado ou obrigatório do roadmap atual.

Nenhum processo foi reiniciado, dado operacional foi lido/apagado, mensagem remota foi alterada ou funcionalidade foi implementada nesta entrega documental. Próximos incrementos recomendados seguem [ROADMAP](../ROADMAP.md), com prioridade para R14, R16 e revisão do risco residual de R03. Evidências locais em [QUALITY_GATES](../QUALITY_GATES.md).
