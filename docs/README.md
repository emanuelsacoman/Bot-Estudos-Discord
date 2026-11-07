# Cérebro do CodeBucket

Base de conhecimento mantida junto do código. Comece por [AGENTS.md](../AGENTS.md) e pelo [ponto de continuidade](brain/CURRENT.md). Auditoria inicial: **2026-11-07**, fuso America/Sao_Paulo, código-base `cea09b90889716b5b05139eaf06f8b0e858f179e`. O cérebro foi commitado na `develop` em `02e22dd408a12b857127ebb1a689a857b6dd8a58` (`Brain`); a base desta tarefa é `develop` / `49138e6` (`Fase 1/P0`), com o P0 já commitado.

**P0:** Node 24.22.2 definido em [.nvmrc](../.nvmrc), Prettier corrigido como dependência de produção e instalações limpas normal/produção validadas offline. **P1.1:** `/status` passa a validar URLs, IPs e DNS e conectar a um IP aprovado, sem seguir redirecionamentos; `npm test` executa a suíte offline de SSRF e regressão de contratos com `node:test`. Consulte os resultados e limites em [QUALITY_GATES](brain/QUALITY_GATES.md). As alterações P1.1 estão sem commit. Login, registro e deploy continuam fora da validação.

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
