# Estado atual do projeto

Atualizado na **Fase 1 / P0, 2026-11-07**, America/Sao_Paulo. Base da tarefa: branch `develop`, commit `02e22dd408a12b857127ebb1a689a857b6dd8a58` (`Brain`), com 95 commits alcançáveis e árvore inicialmente limpa. O cérebro já foi commitado nesse commit; a referência local `origin/develop` coincide com ele e o usuário informou sua publicação. Não houve fetch, merge, commit ou push nesta fase; as alterações P0 abaixo ainda estão no diretório de trabalho.

A auditoria inicial usou o código-base `cea09b90889716b5b05139eaf06f8b0e858f179e`, então na `main`; esse é um registro histórico, não a branch de trabalho atual.

## Identidade e escopo comprovados

CodeBucket é um bot de estudos de programação para Discord. [O comando autor](../../commands/autor.js) declara a origem acadêmica/TCC de Emanuel Vinícius Sacoman. O manifest identifica o pacote como `bot-discord`, versão `1.0.0`, licença declarada ISC; não há arquivo LICENSE separado rastreado. Há 23 módulos de comandos, dois pontos de entrada JavaScript, três imagens e os manifests npm. Consulte [arquitetura](ARCHITECTURE.md) e [catálogo](COMMANDS.md).

| Estado | Constatação e evidência |
| --- | --- |
| `DONE` | Auditoria inicial dos 31 arquivos então rastreados; preparação P0 releu o cérebro e comparou com Git/configuração efetiva. O commit `Brain` adicionou 12 arquivos, totalizando 43 rastreados na base desta fase. Não houve auditoria completa de segredos em todos os blobs históricos. |
| `DONE` | Cérebro documental commitado na `develop` (`02e22dd`), corrigidas referências desatualizadas sobre ausência de commit. Os 25 fontes JS, três imagens e `.env` foram preservados na Fase 1. |
| `DONE` | Node 24.22.2 LTS/npm 11.19.1 funcionais por runtime portátil local, com ZIP oficial e SHA-256 conferido. `.nvmrc` fixa `24.22.2` e manifest/lock declaram `engines.node: "24.x"`. |
| `DONE` | Prettier `^3.5.3` movido para `dependencies` e flag `dev` removido da entrada do lock; versão `3.5.3`, resolved, integrity e outros metadados preservados. Nenhum outro pacote removido/atualizado. |
| `DONE` | Instalações limpas `npm ci` e `npm ci --omit=dev`, com `--engine-strict`, em duas cópias sem `.env`/node_modules prévios e caches/configuração npm isolados: exit 0, 85 pacotes em cada. |
| `DONE` | Em **ambas** as instalações: 25/25 fontes com sintaxe válida, 23/23 módulos com função `execute`, builder serializável e nomes únicos. Payloads JSON iguais à baseline anterior à mudança. Isso não é execução remota dos handlers. |
| `DONE` | `/formatar` executado offline com interação simulada para os cinco parsers: babel, html, css, json e markdown; saída formatada e embed verificados em ambos os modos, sem rede. |
| `DONE` | Manifest/lock consistentes; lock v3 com 85 pacotes além da raiz, 85 versões conferidas em cada instalação; 63 engines de dependências mais o do projeto compatíveis. Resolver impediu dependências fora de cada cópia limpa. |
| `DONE` | Quatro variáveis identificadas no código: `TOKEN`, `CLIENT_ID`, `INVITE_URL`, `LOFIRADIO_URL`. `.env` local existe com valores não vazios; valores não expostos. `.env` e `node_modules` ignorados; `.env` não rastreado. |
| `DONE` | Links internos, diff, ausência de credenciais nos arquivos alterados, integridade dos arquivos preservados e `.env` ignorado/não rastreado verificados; resultados em [QUALITY_GATES](QUALITY_GATES.md). |
| `IN_PROGRESS` | Nenhuma implementação adicional em andamento ao fechar o P0 offline. |
| `MISSING` | Suíte automatizada permanente útil: `npm test` continua placeholder. Não há script `start`, configuração de CI ou hospedagem versionada identificada. As verificações pontuais não foram transformadas em sistema de CI. |
| `MISSING` | Persistência de `/todo`, `/timer` e cooldowns; limites de entrada/saída e política uniforme de erros/timeouts/adiamento de respostas. São limitações, não trabalho autorizado nesta entrega. |
| `BLOCKED` | Shim NVM global sem padrão instalado correspondente à `.nvmrc`; somente Node 20 está no gerenciador, com `auto_install=false`. Uso do runtime portátil explícito resolveu os testes locais sem alterar o padrão global; o shim não foi reparado globalmente. |
| `NOT_CONFIRMED` | Login real, validade do token, correspondência TOKEN/CLIENT_ID, comandos registrados remotamente, permissões, disponibilidade de APIs/links, hospedagem, uptime e recuperação prática. |

## Dependências efetivas

| Pacote | Declarado | Travado/instalado | Uso |
| --- | --- | --- | --- |
| discord.js | `^14.14.1` | `14.18.0` | Gateway, REST, builders e interações |
| axios | `^1.6.8` | `1.8.4` | Consultas HTTP |
| dotenv | `^16.3.1` | `16.4.7` | Carrega `.env` nos dois pontos de entrada |
| node-fetch | `^3.3.2` | `3.3.2` | Declarado; não foi encontrada importação no código da aplicação |
| qrcode | `^1.5.3` | `1.5.4` | PNG de QR code |
| prettier | `^3.5.3` (dependency de produção) | `3.5.3` | Importado em runtime por `/formatar`; carregamento de produção validado após corrigir R02 |

`@discordjs/builders` `1.10.1` é transitivo e importado diretamente por `/translate`; `node-fetch` permanece sem importação encontrada. Ambos foram preservados, para evitar mudanças desnecessárias nesta fase. `/github` usa `fetch` global. O mínimo legado das dependências é Node **18.17**, via `undici` `6.21.1`; a política atual do projeto é Node **24.x**, com patch **24.22.2** validado. Veja justificativa e instalação em [operações](OPERATIONS.md).

## Métodos e limites

Na auditoria inicial foi usado Node **v20.20.0**, sem instalação. Na Fase 1 foi baixado o runtime oficial **v24.22.2**, com npm **11.19.1**, para área local ignorada. Duas instalações npm independentes baixaram somente o grafo travado no lock, sem cache antigo ou `.env`. Foram comparados os 85 pacotes do lock anterior/atual para garantir ausência de atualizações e os payloads dos comandos para preservar seus contratos públicos.

O sandbox impediu `lstat` de um diretório ancestral na auditoria inicial. A sintaxe foi verificada com `node --check` via stdin e o carregamento com `--preserve-symlinks --preserve-symlinks-main`; o procedimento foi mantido na Fase 1. Houve uma comparação inicial inadequada de objetos com propriedades `undefined` contra baseline salva em JSON; o verificador foi corrigido para comparar o payload serializado efetivamente enviado à API. Não foi alteração de contrato ou defeito do bot.

Não foram iniciados `index.js` ou `deploy-commands.js`, executados handlers contra Discord/APIs, feitos deploys ou alteradas credenciais/configurações globais. Instalação limpa e compatibilidade offline de Node/Prettier foram comprovadas; auditoria de vulnerabilidades, operação remota e recuperação integral continuam `NOT_CONFIRMED`. Os demais riscos permanecem em [KNOWN_RISKS](KNOWN_RISKS.md).
