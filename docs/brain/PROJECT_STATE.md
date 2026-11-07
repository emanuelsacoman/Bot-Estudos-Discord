# Estado atual do projeto

Atualizado na **Fase P1.1, 2026-11-07**, America/Sao_Paulo. Base da tarefa: branch `develop`, commit `49138e616e02cfc86b6241f93694812994b0cbd6` (`Fase 1/P0`), árvore inicialmente limpa. O cérebro e P0 já estão commitados. Não houve fetch, merge, commit ou push nesta tarefa; as alterações P1.1 estão no diretório de trabalho. O estado remoto atual não foi consultado.

A auditoria inicial usou o código-base `cea09b90889716b5b05139eaf06f8b0e858f179e`, então na `main`; esse é um registro histórico, não a branch de trabalho atual.

## Identidade e escopo comprovados

CodeBucket é um bot de estudos de programação para Discord. [O comando autor](../../commands/autor.js) declara a origem acadêmica/TCC de Emanuel Vinícius Sacoman. O manifest identifica o pacote como `bot-discord`, versão `1.0.0`, licença declarada ISC; não há arquivo LICENSE separado rastreado. Há 23 módulos de comandos, dois pontos de entrada JavaScript, três imagens e os manifests npm. Consulte [arquitetura](ARCHITECTURE.md) e [catálogo](COMMANDS.md).

| Estado | Constatação e evidência |
| --- | --- |
| `DONE` | Auditoria inicial dos 31 arquivos então rastreados; preparação P0 releu o cérebro e comparou com Git/configuração efetiva. O commit `Brain` adicionou 12 arquivos, totalizando 43; P0 adicionou `.nvmrc`, totalizando 44 rastreados na base P1.1 (`49138e6`). Não houve auditoria completa de segredos em todos os blobs históricos. |
| `DONE` | Cérebro documental commitado na `develop` (`02e22dd`), corrigidas referências desatualizadas sobre ausência de commit. Os 25 fontes JS, três imagens e `.env` foram preservados na Fase 1. |
| `DONE` | Node 24.22.2 LTS/npm 11.19.1 funcionais por runtime portátil local, com ZIP oficial e SHA-256 conferido. `.nvmrc` fixa `24.22.2` e manifest/lock declaram `engines.node: "24.x"`. |
| `DONE` | Prettier `^3.5.3` movido para `dependencies` e flag `dev` removido da entrada do lock; versão `3.5.3`, resolved, integrity e outros metadados preservados. Nenhum outro pacote removido/atualizado. |
| `DONE` | Instalações limpas `npm ci` e `npm ci --omit=dev`, com `--engine-strict`, em duas cópias sem `.env`/node_modules prévios e caches/configuração npm isolados: exit 0, 85 pacotes em cada. |
| `DONE` | Em **ambas** as instalações: 25/25 fontes com sintaxe válida, 23/23 módulos com função `execute`, builder serializável e nomes únicos. Payloads JSON iguais à baseline anterior à mudança. Isso não é execução remota dos handlers. |
| `DONE` | `/formatar` executado offline com interação simulada para os cinco parsers: babel, html, css, json e markdown; saída formatada e embed verificados em ambos os modos, sem rede. |
| `DONE` | Manifest/lock consistentes; lock v3 com 85 pacotes além da raiz, 85 versões conferidas em cada instalação; 63 engines de dependências mais o do projeto compatíveis. Resolver impediu dependências fora de cada cópia limpa. |
| `DONE` | Quatro variáveis identificadas no código: `TOKEN`, `CLIENT_ID`, `INVITE_URL`, `LOFIRADIO_URL`. `.env` local existe com valores não vazios; valores não expostos. `.env` e `node_modules` ignorados; `.env` não rastreado. |
| `DONE` | Links internos, diff, ausência de credenciais nos arquivos alterados, integridade dos arquivos preservados e `.env` ignorado/não rastreado verificados; resultados em [QUALITY_GATES](QUALITY_GATES.md). |
| `DONE` | P1.1: `/status` usa [consulta HTTP segura](../../lib/status-http.js), com validação de URL/IP/DNS, conexão numérica presa ao destino aprovado, Host/SNI e validação TLS preservados, sem redirects/proxy global. Prazo total de 5 s, corpo de 1 MiB, cabeçalhos de 16 KiB e entrada de 2048 caracteres; conteúdo remoto descartado e erros sanitizados. R06 `RESOLVED` no escopo offline testado. |
| `DONE` | P1.1: suíte permanente [HTTP/SSRF](../../tests/status-http.test.js) e [comandos](../../tests/commands.test.js), usando Node:test via `npm test`: **146/146** passaram na raiz e em duas instalações limpas normal/produção (85 pacotes em cada, cache P0 reutilizado offline). Transporte nativo com sockets em memória prova IP conectado, Host/SNI/TLS, redirects e limites; guardas bloqueiam DNS e sockets reais. Sintaxe 28/28 e contratos 23/23 preservados, sem novas dependências ou alteração do lock. |
| `IN_PROGRESS` | Nenhuma implementação adicional em andamento ao fechar P1.1 offline. |
| `MISSING` | Cobertura permanente dos demais handlers e integrações. R15 está `MITIGATED` pela suíte focada; não há script `start`, CI ou hospedagem versionada. |
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

O sandbox impediu `lstat` de um diretório ancestral na auditoria inicial. A sintaxe foi verificada com `node --check` via stdin e o carregamento com `--preserve-symlinks --preserve-symlinks-main`; o procedimento foi mantido em P0 e P1.1. Houve em P0 uma comparação inicial inadequada de objetos com propriedades `undefined` contra baseline salva em JSON; o verificador foi corrigido para comparar o payload serializado efetivamente enviado à API. Não foi alteração de contrato ou defeito do bot.

Em P1.1, somente o script `test` do manifest mudou; dependências, engines e lock são iguais à base. As cópias em `node_modules/.codebucket-p1/ci-development` e `ci-production` foram criadas sem `.env`/node_modules prévios e instaladas com `npm ci --offline --engine-strict` (produção também `--omit=dev`), usando os caches P0 já existentes. Os 85 manifests instalados foram conferidos contra o lock e o resolver recusou dependências fora de cada cópia (711 arquivos resolvidos dentro de cada uma). O hash JSON público continua `e50cb9e0df937132bf0381b136a80cab6e46bdd0186f69490a825961b9d53f15`.

Limitações P1.1: a política de IP é conservadora e precisa acompanhar mudanças dos registros; IPv4-mapped IPv6, tradução/transição e alguns blocos especiais globalmente roteáveis são recusados. Não há fallback para outro IP público nem redirects; os limites também podem recusar um site online. R07 permanece aberto (5 s sem defer), R05 permanece no tratamento global. Rede real, roteamento da hospedagem e eficácia operacional não foram validados por estes mocks.

Não foram iniciados `index.js` ou `deploy-commands.js`, executados handlers contra Discord/APIs, feitos deploys ou alteradas credenciais/configurações globais. Instalação limpa e compatibilidade offline de Node/Prettier foram comprovadas; auditoria de vulnerabilidades, operação remota e recuperação integral continuam `NOT_CONFIRMED`. Os demais riscos permanecem em [KNOWN_RISKS](KNOWN_RISKS.md).
