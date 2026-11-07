# Estado atual do projeto

Auditoria: **2026-11-07**, America/Sao_Paulo. Branch `main`; commit analisado `cea09b90889716b5b05139eaf06f8b0e858f179e` (`teste`, 2025-04-30). O Git tinha 94 commits alcançáveis em `HEAD` e a árvore estava limpa antes da tarefa. Os documentos desta entrega ainda não pertencem a um novo commit; nenhum commit/push foi realizado.

## Identidade e escopo comprovados

CodeBucket é um bot de estudos de programação para Discord. [O comando autor](../../commands/autor.js) declara a origem acadêmica/TCC de Emanuel Vinícius Sacoman. O manifest identifica o pacote como `bot-discord`, versão `1.0.0`, licença declarada ISC; não há arquivo LICENSE separado rastreado. Há 23 módulos de comandos, dois pontos de entrada JavaScript, três imagens e os manifests npm. Consulte [arquitetura](ARCHITECTURE.md) e [catálogo](COMMANDS.md).

| Estado | Constatação e evidência |
| --- | --- |
| `DONE` | Auditoria dos 31 arquivos rastreados: código, manifests/lock, ignore e inventário dos três assets; histórico/estado Git inspecionados. Não houve auditoria completa de segredos em todos os blobs históricos. |
| `DONE` | Cérebro documental, protocolo de agentes e `.env.example` criados; código e manifests preexistentes preservados. |
| `DONE` | 25/25 arquivos JavaScript passaram na análise sintática local. |
| `DONE` | 23/23 módulos carregados offline com função `execute`, builder serializável por `data.toJSON()` e nomes únicos. Isso comprova o contrato local; não a execução dos handlers no Discord. |
| `DONE` | `package.json` e lock JSON válidos; ranges raiz coincidem. Lock v3 com 85 entradas de pacotes além da raiz; as 85 versões instaladas coincidem com o lock. |
| `DONE` | Quatro variáveis identificadas no código: `TOKEN`, `CLIENT_ID`, `INVITE_URL`, `LOFIRADIO_URL`. `.env` local existe com valores não vazios; valores não expostos. `.env` e `node_modules` ignorados; `.env` não rastreado. |
| `DONE` | Links internos, inventário documental, ausência de credenciais/valores sensíveis do `.env` nos novos arquivos e preservação dos arquivos rastreados verificados; resultados em [QUALITY_GATES](QUALITY_GATES.md). |
| `IN_PROGRESS` | Nenhuma implementação adicional em andamento ao fechar a inicialização documental. |
| `MISSING` | Suíte automatizada útil: `npm test` contém somente placeholder que retorna erro. Não há script `start`, `engines`, pin de Node, configuração de CI ou hospedagem versionada identificada. |
| `MISSING` | Persistência de `/todo`, `/timer` e cooldowns; limites de entrada/saída e política uniforme de erros/timeouts/adiamento de respostas. São limitações, não trabalho autorizado nesta entrega. |
| `BLOCKED` | Uso normal de `node`/`npm` pelo PATH: o shim NVM informa que não há versão ativa. Um executável já instalado permitiu a auditoria sem alterar a configuração global. |
| `NOT_CONFIRMED` | Login real, validade do token, correspondência TOKEN/CLIENT_ID, comandos registrados remotamente, permissões, disponibilidade de APIs/links, hospedagem, uptime e recuperação prática. |

## Dependências efetivas

| Pacote | Declarado | Travado/instalado | Uso |
| --- | --- | --- | --- |
| discord.js | `^14.14.1` | `14.18.0` | Gateway, REST, builders e interações |
| axios | `^1.6.8` | `1.8.4` | Consultas HTTP |
| dotenv | `^16.3.1` | `16.4.7` | Carrega `.env` nos dois pontos de entrada |
| node-fetch | `^3.3.2` | `3.3.2` | Declarado; não foi encontrada importação no código da aplicação |
| qrcode | `^1.5.3` | `1.5.4` | PNG de QR code |
| prettier | `^3.5.3` (devDependency) | `3.5.3` | Importado em runtime por `/formatar`; necessário para carregar todos os comandos |

`@discordjs/builders` `1.10.1` é transitivo e importado diretamente por `/translate`. `/github` usa `fetch` global. O mínimo efetivo declarado pelas dependências do lock é Node **18.17**, devido ao `undici` `6.21.1`; isso não é uma recomendação de produção. Veja a escolha de LTS em [operações](OPERATIONS.md).

## Métodos e limites

Foram usados leitura integral dos fontes, busca de `process.env`/imports/URLs, análise dos manifests de todas as entradas do lock, metadados Git/ignore e verificações locais offline. Executável existente: Node **v20.20.0**, usado apenas para a auditoria. Nenhuma instalação nem troca da versão ativa foi feita.

O sandbox impediu `lstat` de um diretório ancestral quando Node recebeu caminhos de arquivos. A sintaxe foi verificada com `node --check` recebendo os fontes via stdin; o carregamento real funcionou com `--preserve-symlinks --preserve-symlinks-main`. As falhas iniciais de resolução foram ambientais, não falhas sintáticas do código.

Não foram iniciados `index.js` ou `deploy-commands.js`, executados handlers contra Discord/APIs, feitos deploys ou alteradas credenciais. Instalação limpa, atualização de dependências e auditoria de vulnerabilidades continuam `NOT_CONFIRMED`. Os riscos comprovados por leitura estão em [KNOWN_RISKS](KNOWN_RISKS.md); o registro distingue evidência estática de consequência reproduzida.
