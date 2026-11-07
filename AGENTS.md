# CodeBucket — instruções permanentes

CodeBucket é um bot acadêmico de estudos de programação no Discord. Usa JavaScript CommonJS, Node.js, discord.js 14, dotenv, axios, qrcode e Prettier. A arquitetura real é um processo com módulos em `commands/`; consulte [a arquitetura](docs/brain/ARCHITECTURE.md).

## Antes de qualquer tarefa

1. Leia este `AGENTS.md`, verifique `git status` e preserve todas as alterações locais alheias à tarefa.
2. Leia [CURRENT.md](docs/brain/CURRENT.md) e somente os [documentos relevantes](docs/README.md); inspecione também o código envolvido.
3. Identifique riscos e dependências e faça um plano proporcional ao pedido.

## Desenvolvimento e fontes de verdade

- Prioridade: código/configuração efetivos → testes reproduzíveis → contratos/interfaces → documentação verificada → decisões registradas → inferências/propostas. Corrija a compreensão documental antes de mudar código para atender documentação antiga.
- Preserve os contratos `data`/`execute(interaction)` e os nomes públicos dos comandos. Runtime e registro global carregam todos os módulos; uma dependência ausente pode afetar o bot inteiro.
- Faça mudanças pequenas e reversíveis, preserve comportamentos e evite duplicar responsabilidades. Justifique novas dependências. Não implemente recursos fora do pedido nem use dados fictícios em produção.
- Use `NOT_CONFIRMED` para fatos não verificados e `KNOWN_RISK` para riscos com evidência. Código implementado não equivale a operação remota validada.
- Siga [QUALITY_GATES.md](docs/brain/QUALITY_GATES.md); registre comandos, ambiente, resultados e limitações. Nunca marque uma verificação como aprovada sem executá-la.

## Segurança e escopo

- Nunca revele, registre ou versione tokens, chaves, valores do `.env` ou dados sensíveis. `.env.example` contém somente placeholders seguros/valores públicos; mantenha `.env` e `node_modules` ignorados.
- Não faça deploy, registro/remoção de comandos Discord, alterações remotas, reinícios de produção, mudanças de credenciais, exclusões, commits ou push sem autorização explícita para a ação. `deploy-commands.js` substitui o conjunto global de comandos e não é teste local.
- A inicialização documental de 2026-11-07 autoriza somente inspeção, documentação, `.env.example` e verificações locais não destrutivas. O [roadmap](docs/brain/ROADMAP.md) contém propostas e não autoriza implementação.

## Ao concluir

1. Execute as verificações pertinentes, inspecione o diff e procure regressões; informe o que não foi testado.
2. Atualize os documentos afetados junto do código; atualize [PROJECT_STATE.md](docs/brain/PROJECT_STATE.md) quando o estado mudar e sempre atualize [CURRENT.md](docs/brain/CURRENT.md).
3. Registre ADRs em [decisions/](docs/brain/decisions/README.md) somente para decisões realmente estabelecidas ou aprovadas, com contexto e consequências.
4. Comunique resultados, limitações, pendências e próxima ação segura. A documentação evolui incrementalmente, sem recriação a cada sessão.
