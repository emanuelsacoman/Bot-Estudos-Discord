# Cérebro do CodeBucket

Base de conhecimento mantida junto do código. Comece por [AGENTS.md](../AGENTS.md) e pelo [ponto de continuidade](brain/CURRENT.md). Auditoria inicial: **2026-11-07**, fuso America/Sao_Paulo, código-base `cea09b90889716b5b05139eaf06f8b0e858f179e`. O cérebro foi commitado na `develop` em `02e22dd408a12b857127ebb1a689a857b6dd8a58` (`Brain`); o ADR 0003 já está commitado em `67c25a3`. A P2.3 está commitada em `da6a413` e a P2.4 em `b76219d`, base da revisão P2.5 na `develop`, em **2026-11-13**.

**P0/P1:** runtime/dependências, SSRF, interações, bootstrap/registro e timers protegidos nos escopos offline registrados. **P2.1:** R10/R11 corrigidos localmente, QR em Buffer e limites de recursos. **P2.2:** isolamento/privacidade/cotas de todo; R09 `MITIGATED`. **Decisão atual:** [ADR 0003](brain/decisions/0003-estado-operacional-temporario.md), estado exclusivamente em memória e perda por reinício aceita, sem persistência como pendência obrigatória. Mantidos os [ADRs anteriores](brain/decisions/README.md). **P2.3 `DONE` no escopo offline:** R14 `RESOLVED`, catálogo único de documentação e roteamento por `codebucket:docs:select`, preservando as 25 opções e os 23 contratos/hash slash; suíte **863/863** e sintaxe **56/56**. Menus antigos com `select` exigem nova execução de `/docs`. **P2.4 `DONE` no escopo offline:** contratos/falhas das seis APIs, builder de `/translate` pela dependência direta e pausas de quota/backoff só em memória, sem retry. R16 `MITIGATED` por riscos externos residuais. Baseline de 2026-11-08: 863/863; conclusão em 2026-11-13: **1097/1097** testes, sintaxe **59/59**, 23 contratos/hash preservados e `/translate` Unicode validado em instalações limpas normal/produção. Resultados em [QUALITY_GATES](brain/QUALITY_GATES.md). **P2.5 `DONE` no escopo offline:** auditoria dos 23 módulos e do catálogo, sem correção de código justificada; R03 permanece `MITIGATED`, com fronteira de confiança e efeitos transitivos conhecidos documentados na [arquitetura](brain/ARCHITECTURE.md#confiança-e-efeitos-na-importação--p25). Baseline e final **1097/1097**, sintaxe **59/59**, 23 contratos/hash preservados e **28 probes** de importação aprovados; evidências em qualidade. Código, testes e dependências preservados. Esta atualização documental está sem commit; login, registro e deploy reais continuam fora da validação. Próxima tarefa recomendada: revisão local de logs/dados de servidores (R17), mediante novo pedido.

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
