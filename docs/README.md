# Cérebro do CodeBucket

Base de conhecimento mantida junto do código. Comece por [AGENTS.md](../AGENTS.md) e pelo [ponto de continuidade](brain/CURRENT.md). Auditoria inicial: **2026-11-07**, fuso America/Sao_Paulo, código-base `cea09b90889716b5b05139eaf06f8b0e858f179e`. O cérebro foi commitado na `develop` em `02e22dd408a12b857127ebb1a689a857b6dd8a58` (`Brain`); a base da P2.2 é `develop/cf65c14` (P2.1 já commitada).

**P0:** ambiente e dependências de produção. **P1.1:** proteção SSRF. **P1.2:** estabilidade de interações e prazos HTTP. **P1.3:** ambiente/bootstrap, registro protegido e timers limitados/isolados. **P2.1:** R10/R11 corrigidos offline, QR em Buffer, anexos integrais e limites de recursos. **P2.2:** isolamento/privacidade de `/todo` por servidor+usuário e DM+usuário, com cotas agregadas por usuário; R09 permanece `MITIGATED` pela volatilidade. Consulte [QUALITY_GATES](brain/QUALITY_GATES.md), [ADR 0001](brain/decisions/0001-isolamento-dos-timers.md) e [ADR 0002](brain/decisions/0002-privacidade-e-isolamento-do-todo.md). P2.1 já commitada em `cf65c14`; alterações P2.2 sem commit. Login, registro e deploy reais continuam fora da validação.

| Documento | Quando consultar |
| --- | --- |
| [PROJECT_STATE](brain/PROJECT_STATE.md) | Estado comprovado, ambiente e limites da validação |
| [ARCHITECTURE](brain/ARCHITECTURE.md) | Componentes, eventos, carregamento e integrações |
| [COMMANDS](brain/COMMANDS.md) | Contrato e limitações de cada um dos 23 comandos |
| [OPERATIONS](brain/OPERATIONS.md) | Preparação, configuração, execução e recuperação |
| [QUALITY_GATES](brain/QUALITY_GATES.md) | Verificações reproduzíveis e resultados da auditoria |
| [KNOWN_RISKS](brain/KNOWN_RISKS.md) | Evidências, impacto e possíveis correções |
| [ROADMAP](brain/ROADMAP.md) | Propostas priorizadas, sem autorização automática |
| [CURRENT](brain/CURRENT.md) | Última entrega, pendências e próxima ação segura |
| [Decisões](brain/decisions/README.md) | Índice e protocolo de futuros ADRs |
| [.env.example](../.env.example) | Quatro variáveis reconhecidas e placeholders seguros |

`DONE` significa conclusão dentro do escopo descrito; não certifica produção. `IN_PROGRESS` é trabalho efetivamente iniciado e ainda aberto; `MISSING` é um recurso/configuração ausente; `BLOCKED` é uma verificação impedida por condição explícita; `NOT_CONFIRMED` é algo ainda não comprovado. `KNOWN_RISK` identifica um problema com evidência, sem implicar que sua consequência foi reproduzida.

O código e a configuração efetiva prevalecem sobre esta documentação. Atualize os documentos afetados quando o código mudar; mantenha `CURRENT` pequeno e o estado datado. Não transforme sugestões do roadmap em funcionalidades implementadas nem invente decisões históricas.

A estrutura foi criada na raiz do repositório existente `Bot-Estudos-Discord`; não foi criada uma segunda pasta `CodeBucket/`, para preservar os caminhos e a organização atuais.
