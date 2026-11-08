# Critérios de qualidade

Use verificações proporcionais à alteração. Uma mudança documental pede revisão de conteúdo, links, diff e segredos; uma mudança em carregamento/contratos pede também sintaxe e serialização de todos os comandos. Uma mudança em API, interação ou estado pede casos de sucesso e falha relevantes. Não use registro global ou login de produção como teste local.

## Resultado P2.2 — privacidade e estado de todo — 2026-11-07

Base **develop / cf65c1411c422b57d083aaffa659627b0d5ba5bb** (P2.1 já commitada), árvore inicialmente limpa. Windows x64/PowerShell, Node **24.22.2**, npm **11.19.1**, runtime portátil P0. P2.2 sem commit/push; instalação existente, sem alteração de dependências/manifest/lock. Não se executou login, registro remoto, reinício, deploy ou leitura de tarefas reais.

| Verificação executada | Resultado e limite |
| --- | --- |
| Baseline antes de editar | `PASS`: `npm test -- --test-reporter=tap`, **739/739**, zero falhas/cancelamentos/skips/todo. |
| Suíte final | `PASS`: mesmo comando, **765/765**, zero falhas/cancelamentos/skips/todo; **26 casos adicionais** em [todo-isolation.test.js](../../tests/todo-isolation.test.js). Os 16 casos de [todo.test.js](../../tests/todo.test.js) foram mantidos e adaptados ao contexto explícito, privacidade e duplicata sem eco. Demais suítes anteriores inalteradas. |
| Casos focais | `PASS`: `node --test --test-reporter=tap tests/todo-isolation.test.js tests/todo.test.js tests/commands.test.js`, **50/50**. Sem Discord, APIs, arquivos de tarefas, credenciais ou serviços externos; guardas recusam rede e interações são simuladas. |
| Isolamento | `PASS`: usuários distintos no mesmo servidor, mesmo usuário em servidores diferentes/DM, criação/listagem/remoção no mesmo contexto, canais do mesmo servidor e canais DM conforme escopo aprovado. Maps aninhados distinguem DM null de strings de guild, delimitadores e chaves de protótipo. Contexto inválido/ausente ou guildId/inGuild contraditórios são recusados sem acessar DM ou chave global. |
| Privacidade | `PASS`: confirmações, listas, anexos e erros com flag efêmera 64. Duplicata não ecoa tarefa; falha inesperada/options/validação recebe texto fixo sem conteúdo sensível. Logs não contêm sentinelas de tarefas/erros. Se existir defer público anterior, somente placeholder neutro vai à edição pública; o resultado pessoal segue em follow-up privado, com helper anterior preservado. |
| Cotas / integridade | `PASS`: teto P2.1 de 1967 UTF-16 por tarefa; 100 tarefas e 64 KiB UTF-8 agregados por usuário entre servidores/DM, sem multiplicação por servidor. 8 MiB globais e 1024 usuários distintos mantidos. Fronteiras, rejeição sem mutação/expulsão, duplicata apenas no próprio escopo e liberação parcial/final de bytes/usuários cobertas. Limites globais são exercitados também com budgets reduzidos injetados; constantes produtivas são conferidas na suíte anterior. |
| Concorrência / entrega | `PASS`: inserções concorrentes no teto não excedem cota, dupla remoção final libera apenas uma vez, confirmação pendente não duplica tarefa nem mistura escopos. Mutação síncrona termina antes do await de envio; falha de confirmação mantém efeito local e helper impede retry de entrega ambígua, sem log bruto. |
| Volatilidade | `PASS` no escopo simulado: nova instância de store e recarga do comando começam vazias e não copiam listas do módulo anterior; instâncias permanecem independentes. Não houve reinicialização do bot real nem descarte/migração de suas tarefas. Reinício perde dados, sem sincronização multiprocesso ou recuperação após falha de hospedagem. |
| Sintaxe / runtime | `PASS`: `node --check` via stdin em **53/53** fontes JavaScript (entradas, comandos, helpers e testes), Node **24.22.2** igual à .nvmrc e compatível com engines 24.x. Gate de sintaxe não inicia os pontos de entrada. |
| Contratos / regressões | `PASS`: **23/23** comandos, builders/nome/opções/descrições e funções execute preservados; hash público **e50cb9e0df937132bf0381b136a80cab6e46bdd0186f69490a825961b9d53f15**, igual ao snapshot anterior e à cópia dos builders de HEAD. Suíte completa mantém R04/R05/R06/R07/R08/R10/R11/R13. Helpers de interações/HTTP/SSRF, bootstrap, registro, timers e demais comandos/testes anteriores inalterados. |
| Revisão local | `PASS`: diff e novos arquivos revisados, `git -c core.autocrlf=false diff --check`, links locais, padrões de credenciais nos arquivos alterados/novos, .env/node_modules ignorados e .env não rastreado. Nenhum valor do .env lido, texto de tarefa real consultado ou dependência adicionada. |

Execuções usam o Node/npm portátil em `node_modules/.codebucket-p0/runtime/node-v24.22.2-win-x64`, com PATH somente no PowerShell filho e `NODE_OPTIONS=--preserve-symlinks --preserve-symlinks-main`. TAPs baseline/focal/final, resumo de sintaxe/contratos e auditoria ficam em `node_modules/.codebucket-p22/`, ignorado pelo Git. Instalações limpas não foram repetidas: manifest, lock e dependências não mudaram. Testes CLI anteriores usam somente modos bloqueados/dry-run sob guardas, sem credenciais ou envio REST real.

**Conclusão:** R09 **MITIGATED**, não resolvido integralmente: exposição entre servidores/usuários e respostas públicas do todo foram tratadas localmente, mas a perda de estado por reinício continua. [ADR 0002](decisions/0002-privacidade-e-isolamento-do-todo.md) registra escopo/privacidade/cotas. Não existe migração automática da lista global anterior, cujo servidor de origem é desconhecido; não se copia para todos os contextos nem se adota arbitrariamente em DM. Qualquer transição operacional exige tarefa própria: preservar manualmente dados importantes com autorização antes de um reinício autorizado. Esta entrega não reiniciou ou alterou o estado de um bot em execução. Persistência e recuperação futuras exigem decisão arquitetural específica; entrega/permissões reais continuam `NOT_CONFIRMED`. Budgets limitam texto e cardinalidade, não heap exato; consistência é de um único processo/event loop, sem transação com Discord.

## Resultado P2.1 — arquivos e limites — 2026-11-07

Base **develop / e23374279da78591219adf15547eadb10bfe3a24** (`P1.3 concluída`), árvore inicialmente limpa; P1.3 já commitada. Windows x64/PowerShell, Node **24.22.2**, npm **11.19.1**, runtime portátil P0, instalação existente. P2.1 sem commit/push. Nenhuma dependência, manifest ou lock alterados; instalações limpas não foram repetidas nesta fase.

| Verificação executada | Resultado e limite |
| --- | --- |
| Baseline antes de editar | Primeira `npm test -- --test-reporter=tap`: **536/537**, um `unhandledRejection` em teste de API lenta de /github, cuja interação criada antes do carregamento expirou sob execução paralela (7,2 s). Repetição `npm test -- --test-concurrency=1 --test-reporter=tap`: **537/537**, zero falhas, antes das edições. Não se alterou o prazo produtivo nem se ocultou a primeira falha. |
| Suíte final | `PASS`: **739/739** tanto em `npm test -- --test-concurrency=1 --test-reporter=tap` quanto em `npm test -- --test-reporter=tap` (paralelismo padrão), zero falhas/cancelamentos/skips/todo. **202 casos adicionais**: conteúdo/QR 25, todo 16, HTTP body 22 e demais comandos 139. Casos anteriores preservados; mocks QR adaptados de toFile/cleanup para toBuffer/ausência de arquivo, mocks fetch agora usam fluxo limitado. O teste de ordem/visibilidade HTTP fixa Date.now por caso para não medir tempo de carregamento/escalonamento; os testes separados de expiração continuam intactos. [QR/conteúdo](../../tests/file-content.test.js), [todo](../../tests/todo.test.js), [comandos](../../tests/content-commands.test.js), [corpo HTTP](../../tests/http-body.test.js). |
| QR e arquivos | `PASS`: PNG real em Buffer (assinatura PNG conferida), texto inválido/vazio/malformado, teto numérico M de 5596 e capacidade Unicode real, rejeição de geração e envio após defer, concorrência com Buffers separados. Guardas recusam gravação/toFile/unlink; não há caminho temporário para abandonar. Inventário final sem PNG temporário residual. |
| Discord / Unicode | `PASS`: texto 2000/2001; título 256/257; descrição 4096/excesso; campo nome 256/257 e valor 1024/1025; 25/26 campos; rodapé 2048/2049; autor 256/257; soma de embed 6000/excesso. Conta UTF-16 conservadoramente conforme builders instalados, preserva emojis/combinações, rejeita surrogates isolados e nunca corta strings. Anexo contém texto completo e tem teto de 1 MiB UTF-8. |
| Formatação | `PASS`: vazio/6000/6001, parser fora das choices recusado antes do Prettier, campo com cercas exatamente 1024 e excesso em anexo. Código Markdown contendo cercas recebe arquivo integral; saída acima de 1 MiB recebe aviso específico privado. Falhas de envio fora do catch sem retry. |
| Todo / memória | `PASS`: tarefa de 1967 e aviso duplicata exatamente 2000; 100 itens, budgets UTF-8 individuais/globais e cardinalidade de usuários; leitura/entrada inválida não aloca; remoção final libera Map e bytes; índices não inteiros/NaN recusados. Listas extensas em anexo completo, Unicode, duplicação exata, isolamento por usuário, escopo entre servidores preservado e efeito local mantido após falha de confirmação. Budgets são admissão de texto/cardinalidade, não medição exata de heap. |
| APIs e demais comandos | `PASS`: /translate une todos segmentos; idioma e consulta codificados; /repositorys conserva até cinco resultados, valida tipos e codifica linguagem. /github, /question e /http validam campos/URLs e preservam resultados extensos em anexo; /moeda valida códigos e números/taxas/produto finitos; /count preserva contagens anteriores; /exercise e /help usam fallback integral. Dados inesperados, vazio, fronteiras e falha após defer com privacidade/sem retry cobertos. |
| Corpo HTTP | `PASS`: 1 MiB antes do parse; axios adapter **1.8.4** exercitado com transport em memória, incluindo gzip e excesso após descompressão antes de transformResponse. Fetch conta bytes do reader, valida Content-Length, cancela/libera ao falhar e não usa response.json ilimitado. Exato/excesso, UTF-8, chunks pequenos, JSON inválido, timeout/cancelamento e respostas/rejeições tardias cobertos; prazo de 5000 ms e erro sanitizado preservados. |
| Sintaxe / Node | `PASS`: **52/52** fontes JavaScript por `node --check` via stdin (entradas, comandos, helpers e testes), em Node **24.22.2**, igual à .nvmrc e compatível com engines 24.x. Entradas não iniciadas por esse gate. |
| Contratos / regressões | `PASS`: **23/23**, hash público **e50cb9e0df937132bf0381b136a80cab6e46bdd0186f69490a825961b9d53f15**, igual ao P0 e HEAD. Builders, opções, nomes e descrições preservados. Configuração/bootstrap/registro/timers, helpers de interações/SSRF e seus respectivos testes permanecem inalterados; suíte completa confirma R04/R05/R06/R07/R08/R13. Mocks dos testes HTTP/QR foram adaptados conforme a linha Suíte final. |
| Revisão | `PASS`: diff e novos fontes revisados, `git -c core.autocrlf=false diff --check`, links locais do cérebro, padrões de credenciais nos 31 arquivos alterados/novos, .env/node_modules ignorados e .env não rastreado. Comparação executável dos builders de HEAD copiados para área ignorada confirma o mesmo hash. Nenhum valor do .env lido ou erro real bruto registrado. Sem nova dependência. |

Comandos npm executados pelo Node portátil com PATH apenas no subprocesso PowerShell e `NODE_OPTIONS=--preserve-symlinks --preserve-symlinks-main`, sem alterar configurações globais. TAPs de baseline/execuções focais e final, inventário/sintaxe/hash e resumo ficam em `node_modules/.codebucket-p21/`, ignorado. Testes CLI anteriores executam apenas modos bloqueados/dry-run com guardas; nenhum login/PUT real foi usado.

**Limites da conclusão:** R10/R11 `RESOLVED` no escopo local descrito. Limites de Discord vêm da [documentação oficial de mensagens](https://docs.discord.com/developers/resources/message#embed-object-embed-limits) e [opções string](https://docs.discord.com/developers/interactions/application-commands#application-command-object-application-command-option-structure); conferidos contra builders instalados. QR usa `toBuffer` do qrcode **1.5.4** instalado, PNG/correção M padrão, com [capacidades por modo](https://github.com/soldair/node-qrcode#qr-code-capacity). Políticas locais de todo/HTTP/anexo e rejeições novas estão em [COMMANDS](COMMANDS.md). Budget de 1 MiB é por resposta, não teto global de concorrência/heap. JavaScript síncrono/JSON e Prettier não são preemptados pelo timeout; não há worker ou quota global de CPU. Dados inválidos ou corpos HTTP excessivos são recusados com erros sanitizados, não parcialmente publicados. Validade de idiomas/repositórios/URLs/APIs não é comprovada por formato. Permissões para anexos e entregas reais continuam `NOT_CONFIRMED`. R09 (volatilidade/escopo todo), R12/R14/R16/R17 e recuperação operacional permanecem pendentes. Nenhuma credencial, infraestrutura ou persistência alterada.

## Resultado P1.3 — inicialização, registro e timers — 2026-11-07

Base `develop` / `a79f13a7a0059be8aa465433ef81f784b482940c` (`P1.2 Concluída`), árvore inicialmente limpa. Windows x64/PowerShell, Node **24.22.2**, npm **11.19.1**, runtime portátil P0 explícito. Alterações desta fase sem commit/push. Nenhum login ou registro real foi executado.

| Verificação executada | Resultado e limite |
| --- | --- |
| Baseline | `PASS`: `npm test -- --test-reporter=dot`, **308/308** testes antes das alterações. |
| Suíte final | `PASS`: `npm test -- --test-reporter=tap`, **537/537**, zero falhas/cancelamentos/skips/todo. TAP/resumo auxiliar em `node_modules/.codebucket-p13/`. Sem credenciais reais, Discord, APIs ou esperas de timer/login reais. Relógios desses casos e serviços são simulados. |
| Configuração pura | `PASS`: TOKEN ausente, tipos inválidos, caracteres/espaços, limites 20–512 e placeholders (inclusive `.env.example`) recusados sem ecoar valores. Prefixos convencionais Bot/Bearer normalizados, sem exigir três partes ou decodificar identidade. CLIENT_ID obrigatório só no registro, decimal canônico de 17–20 dígitos dentro de uint64; inválidos recusados. [config.test.js](../../tests/config.test.js). |
| Bootstrap e login | `PASS`: ambiente antes de catálogo/Client, setup antes de login, falhas de leitura/carregamento/construção/setup/login capturadas com log fixo e exitCode 1. Login síncrono/rejeitado/nunca resolvido, deadline de 30 s e rejeição tardia tratados. Sucesso não imprime/devolve o retorno sensível do login. [startup.test.js](../../tests/startup.test.js). |
| Limpeza após falha | `PASS`: cleanup app e destroy são tentados mesmo se outro falhar; throw/reject/hang limitados a 2 s. Fallback de saída 1 em 5 s após falha usa unref; não mantém um processo limpo vivo. `process.exit` real é bloqueado nos testes. SDK travado/tardio não cria rejeição solta. |
| Integração da entrada | `PASS`: index importado inerte; main com DI integral e Client falso instala handlers antes do login. Presença/cooldowns rastreados e limpos; apenas um listener Error sanitizado permanece após cleanup idempotente para erro tardio do transporte. Listener de interação, documentação/cooldown e erros antes/depois da resposta preservados. [runtime-entry.test.js](../../tests/runtime-entry.test.js). |
| Catálogo offline | `PASS`: real com 23 módulos; vazio, duplicatas, contrato/data/execute ausentes, divergência entre nome do builder e payload, falha de importação/serialização, opções/choices inválidos, ciclos/valores JSON inseguros e campos fora do perfil recusados. Snapshot imutável e mesma validação para runtime e registro. [command-catalog.test.js](../../tests/command-catalog.test.js). |
| Registro simulado | `PASS`: gate de confirmação strict true antes de REST; configuração/payload revalidados no envio; argumentos ausentes/desconhecidos/combinados bloqueados. Dry-run não chama dotenv/config de credenciais/REST. Falha REST retorna 1, sucesso simulado 0, mensagens sanitizadas. PUT único com timeout de 15 s, zero retries e rejeição de rate limit; limpeza local best-effort não repete envio. [registration.test.js](../../tests/registration.test.js). |
| CLI real somente offline | `PASS`: quatro subprocessos com TOKEN/CLIENT_ID vazios e preload bloqueando `.env`, dotenv, login, REST, DNS, TCP/TLS e fetch. Sem argumento → **exit 1**; `--dry-run` → **exit 0**, catálogo real de 23 comandos; `--confirm-global-replacement=false` e flags conflitantes → **exit 1**. O argumento de confirmação nunca foi usado sozinho no CLI real. [registration-cli.test.js](../../tests/registration-cli.test.js). |
| Duração e isolamento | `PASS`: minutos inteiros de **1 a 1440**, fronteiras e conversões inválidas/zero/negativos/excessivos recusados antes de coerção/interpolação ou substituição. Servidor+usuário e DM canal+usuário isolados; contexto/canal ausente recusado. Builders e opções slash não mudaram. [timers.test.js](../../tests/timers.test.js). |
| Estado e callbacks | `PASS`: substituir cancela o anterior, falha de scheduler preserva o anterior, callbacks obsoletos não enviam nem apagam timer novo; stop/clearAll/expiração limpam estado. Expiração remove antes de await; envio pendente/resolvido/rejeitado não interfere em novo timer. Falha síncrona/assíncrona e de diagnóstico é capturada, sem retry ou rejeição não tratada. Confirmação falha mantém efeito local documentado. |
| Contagem das novas coberturas | **229** casos adicionados: **86** configuração/startup/runtime, **95** catálogo/registro, **4** CLI offline e **44** timers; total com baseline **537**. O teste antigo de timer em secondary recebeu somente contexto explícito de servidor/canal. |
| Sintaxe e dependências | `PASS`: **46/46** JS (2 entradas, 23 comandos, 8 helpers e 13 arquivos de teste), `node --check` recebendo bytes dos fontes por stdin. Manifest, lock e `.nvmrc` inalterados; nenhuma dependência nova. Instalação existente utilizada; instalações limpas não foram repetidas nesta fase. |
| Contratos públicos | `PASS`: **23/23** módulos, execute função, builders serializáveis e nomes únicos; hash JSON público **`e50cb9e0df937132bf0381b136a80cab6e46bdd0186f69490a825961b9d53f15`**, igual a P0/P1.1/P1.2. Catálogo real e comparação do builder timer com HEAD confirmam nomes/opções/descrições preservados. |
| Regressões R05/R06/R07 | `PASS`: helpers `interactions.js`, `http-client.js`, `status-http.js` e testes de SSRF/HTTP/interações anteriores inalterados; suíte completa mantém os 138 testes SSRF e os fluxos de defer/visibilidade/timeout. Nenhum ponto de rede foi consultado pelos checks. |
| Revisão final | `PASS`: diff, ausência de padrões de credenciais nos arquivos/logs alterados, `.env` ignorado/não rastreado, links internos e `git -c core.autocrlf=false diff --check`. Novos helpers/testes e entradas formatados; não foram lidos valores do `.env`. |

As verificações usaram `NODE_OPTIONS=--preserve-symlinks --preserve-symlinks-main` e PATH temporário para os filhos npm, sem alterar NVM/PATH persistentes. O verificador auxiliar invocou o npm CLI pelo Node portátil, salvou TAP e analisou sintaxe via `execFileSync(node, ['--check'], {input: fonte})`; não iniciou o bot. O teste do CLI executou a entrada de registro somente nos modos bloqueado/dry-run sob preload de guardas, sem credenciais ou modo remoto. Funções exportadas das entradas foram exercitadas com dependências simuladas.

**Limites:** R04/R08/R13 `RESOLVED` no escopo local comprovado; autenticação, associação token/aplicação, registro e entrega reais continuam `NOT_CONFIRMED`. A validação do catálogo cobre o perfil dos 23 contratos atuais (incluindo nomes ASCII); campos/API novos exigem revisão explícita, sem alegar suporte ao esquema Discord inteiro. Um registro cuja resposta falha pode ter sido aplicado remotamente; não há retry ou rollback automático. Cleanup de REST é best-effort, e falhas definitivas de bootstrap podem encerrar o processo pelo fallback. Timers são voláteis, sem retry, não cancelam envio já iniciado e podem existir sem confirmação entregue; precisão sob carga/event loop não é garantida. O [ADR 0001](decisions/0001-isolamento-dos-timers.md) registra o escopo duradouro; persistência/supervisor/shutdown por sinais não foram implementados. R10/R11 e demais pendências permanecem em [riscos](KNOWN_RISKS.md).

Fontes técnicas: código instalado de discord.js **14.18.0** e REST **2.4.3**, [Client/login/destroy](https://discord.js.org/docs/packages/discord.js/14.18.0/Client:Class), [registro global substitutivo](https://docs.discord.com/developers/interactions/application-commands#bulk-overwrite-global-application-commands) e [timers Node 24](https://raw.githubusercontent.com/nodejs/node/v24.x/doc/api/timers.md). Não houve consulta de validade de credenciais ou API autenticada.

## Resultado P1.2 — estabilidade de interações — 2026-11-07

Registro histórico P1.2: base `develop` / `234f01b1a2bf4f5785dab25a1b63459a8e886661` (`P1.1` já commitada), árvore inicialmente limpa. Windows x64/PowerShell, Node **24.22.2**, npm **11.19.1**, runtime portátil P0 explícito. P1.2 foi posteriormente commitada em `a79f13a`, base da P1.3. Na P1.2 não houve execução dos pontos de entrada nem operação remota.

| Verificação executada | Resultado e limite |
| --- | --- |
| Baseline anterior à edição | `PASS`: `npm test -- --test-reporter=dot`, **146/146** testes na base P1.1. |
| Suíte final | `PASS`: `npm test -- --test-reporter=tap`, **308/308**, **0** falhas/cancelamentos/skips/todo. Execução real com a instalação existente, sem Discord, APIs, DNS ou sockets reais. TAP e resumo auxiliar em `node_modules/.codebucket-p12/`; não foram refeitas instalações limpas nesta fase, pois manifest/lock não mudaram. |
| Estados e falhas de resposta | `PASS`: helper seleciona reply/edit/followUp conforme estado; erro antes da resposta, depois do defer ou depois da conclusão recebe continuação adequada. Falha no próprio reply/edit/followUp/defer, concorrência e entrega ambígua impedem outra tentativa. Falhas da resposta de erro são capturadas, sem rejeição solta. [interactions.test.js](../../tests/interactions.test.js). |
| Expiração e terminalidade | `PASS`: prazos locais de 3 s sem reconhecimento e 15 min com reconhecimento; códigos 10062/10015/50027/40060, rawError/string e erros locais de estado impedem novos envios. Prazo é revalidado entre edição neutra, follow-up e remoção do placeholder; dois testes envelhecem a interação entre chamadas e comprovam que a próxima não ocorre. |
| Visibilidade | `PASS`: resultados públicos, erros efêmeros existentes e `/ping` privado preservados. Depois de defer público, resultado privado usa edição neutra U+200B, follow-up com flag 64 e remoção do placeholder; o conteúdo privado nunca vai à edição pública. Cada falha nessa sequência encerra o envio. Primeiro follow-up após defer não é usado diretamente para tentar trocar visibilidade. |
| Sete comandos HTTP | `PASS`: defer antes da consulta, inclusive com API lenta; falha do defer não inicia HTTP. Sucesso, timeout, 4xx/5xx, corpos inesperados e ramos vazios/validação mantêm mensagens e visibilidade. `/question` vazio e `/http` 1xx respondem rápido, sem defer/API. Falha no envio final não cai no catch da API nem gera outra resposta. [http-commands.test.js](../../tests/http-commands.test.js). |
| Prazos HTTP | `PASS`: axios recebe timeout e AbortSignal; deadline de **5000 ms** cobre consulta completa e fetch + `response.json()`. Mock de corpo lento é abortado; `Promise.race` trata também rejeição tardia após timeout. Apenas status numérico necessário atravessa a normalização do erro; corpo/configuração/URL/headers/cause não são retidos. `/http` conserva `validateStatus` e `/moeda` conserva a distinção 404. [http-client.test.js](../../tests/http-client.test.js). |
| Operações secundárias e lentas | `PASS`: reações em autor/invite/vote/playlist não provocam resposta genérica após sucesso. Falha de follow-up principal ou edit do ping não é repetida. Prettier/QR/upload Lofi reconhecem antes do trabalho; falha do defer impede iniciar a operação. Timer com envio tardio rejeitado e cleanup QR pós-sucesso são capturados; QR nos testes usa mocks, sem arquivos reais. [secondary-commands.test.js](../../tests/secondary-commands.test.js). |
| Regressão SSRF | `PASS`: `lib/status-http.js` e seus **138** testes não mudaram. Suíte completa preserva pinning, DNS misto/rebinding, TLS, zero redirects e limites P1.1; testes adicionais executam `/status` com o helper real e recusam três destinos internos depois do defer, sem abrir rede. |
| Contratos e carregamento | `PASS`: **23/23** módulos carregados, execute função, builder serializável e nomes únicos. SHA-256 JSON **`e50cb9e0df937132bf0381b136a80cab6e46bdd0186f69490a825961b9d53f15`**, igual às bases P0/P1.1: nomes, descrições, opções e contratos `data`/`execute(interaction)` preservados. [commands.test.js](../../tests/commands.test.js). |
| Sintaxe | `PASS`: **34/34** JS (pontos de entrada, comandos, helpers e seis arquivos de teste), `node --check` recebendo os bytes dos fontes por stdin. Nenhum entrypoint foi executado. |
| Dependências e escopo | `PASS`: `git diff --exit-code -- lib/status-http.js tests/status-http.test.js package.json package-lock.json .nvmrc` sem diferenças; nenhuma dependência adicionada/atualizada. Mudanças nos comandos rápidos limitadas ao helper de envio; estado/cooldowns e nomes públicos preservados. |
| Logs/segredos/diff | `PASS`: testes verificam ausência de dados de erro bruto em logs e mensagens, e usam guardas de rede. Revisão do diff, padrões de credenciais, `.env` ignorado/não rastreado, links internos e `git -c core.autocrlf=false diff --check` concluídos. Não houve leitura de valores do `.env` nem logs de erros reais. |

O helper de respostas foi revisado contra o código instalado de discord.js **14.18.0**, incluindo quando `deferred`/`replied` são atualizados após sucesso REST. Fontes técnicas: [prazo/visibilidade/follow-ups do Discord](https://docs.discord.com/developers/interactions/receiving-and-responding) e [interface discord.js 14.18.0](https://discord.js.org/docs/packages/discord.js/14.18.0/ChatInputCommandInteraction:Class); cancelamento axios também foi conferido no adapter HTTP instalado **1.8.4**.

**Limites da conclusão P1.2:** R05/R07 corrigidos localmente. Reconhecimento ainda depende de rede/carga/event loop/permissões; relógio local e estado do SDK orientam a prevenção de expiração. Sem retry após entrega ambígua, pode não haver resposta confirmada; placeholder neutro pode permanecer. Timeout não preempta JavaScript síncrono bloqueante. R04/R08/R13 ainda estavam abertos naquele momento e foram tratados na P1.3 acima; R10 e operação real/permissões/APIs/hospedagem/recuperação permanecem pendentes conforme [riscos](KNOWN_RISKS.md).

## Resultado P1.1 — SSRF de `/status` — 2026-11-07

Registro histórico P1.1: base `develop` / `49138e616e02cfc86b6241f93694812994b0cbd6` (`Fase 1/P0`), árvore inicialmente limpa. Node **24.22.2**, npm **11.19.1**, Windows x64/PowerShell; runtime portátil P0 por caminho explícito. Nenhum ponto de entrada foi executado. P1.1 foi posteriormente commitada em `234f01b`, base da P1.2.

| Verificação executada | Resultado e limite |
| --- | --- |
| Suíte permanente | `PASS`: `npm test -- --test-reporter=dot` executa `node --test`; **146/146** testes (incluindo subtestes), zero falhas na raiz e em **ambas** as cópias limpas. [HTTP/SSRF](../../tests/status-http.test.js): 138; [comandos](../../tests/commands.test.js): 8. |
| URL/IP/DNS | `PASS`: HTTP(S) público/domínio sem esquema/porta/IDN; recusa protocolos externos, URL inválida, userinfo inclusive vazio, localhost, loopback, privados, link-local, metadata, reservados, multicast, mapped IPv6 e IPv4 alternativo. DNS privado, misto, vazio, inválido e falho bloqueado antes da conexão. |
| Destino efetivo e rebinding | `PASS`: HTTP/HTTPS nativos do Node com `Agent.createConnection` e `Duplex` em memória verificam **IP numérico aprovado** entregue à conexão (IPv4 e IPv6), Host original, SNI original e `rejectUnauthorized: true`. DNS de rebinding é chamado uma única vez; agente global com proxy ativo não desvia o destino. Isto demonstra a vinculação entre validação e transporte e permite marcar R06 `RESOLVED` no escopo local. Nenhum handshake TLS ou roteamento real foi exercitado. |
| Redirects/status | `PASS`: respostas 2xx/3xx/4xx/5xx; redirect nativo para metadata produz somente um socket simulado e devolve 302. `Location`, corpo e cabeçalhos remotos não são retornados. Upgrade 101 é rejeitado e o socket é destruído. |
| Prazo, limites e erros | `PASS`: timeout de DNS com resultado tardio não inicia transporte; timeout de conexão/corpo destrói requisição/resposta. Corpo contado em bytes, limite exato aceito, excesso sem Content-Length/chunked abortado, Content-Length excessivo recusado. Parser nativo rejeita cabeçalhos >16 KiB. Erros DNS/conexão/TLS, resposta abortada e falha síncrona são sanitizados. |
| Interface/privacidade | `PASS`: `/status` 200/204/302/404/503 com um reply, embed serializável, título/rodapé/cores e semântica antiga 2xx/não 2xx preservados; falhas genéricas sem input, dados internos ou log. Falha no reply não provoca segunda tentativa local. Caminho/query/fragmento não aparecem na saída. |
| Instalações limpas | `PASS`: `npm ci --offline --engine-strict` e `npm ci --omit=dev --offline --engine-strict`, exit **0**, **85 pacotes** cada; caches P0 reutilizados somente offline, cópias inicialmente sem node_modules e sem `.env`, userconfig/globalconfig vazios por modo. Todas as 85 versões conferidas contra o lock. Não houve download novo nem auditoria npm. |
| Isolamento/carregamento | `PASS`: resolver recusou dependências fora de cada cópia; **711** arquivos de dependências resolvidos dentro de cada uma. **23/23** módulos com `execute`, builder serializável e nomes únicos, sem login ou execução dos pontos de entrada. |
| Contratos públicos | `PASS`: JSON dos 23 comandos mantém SHA-256 **`e50cb9e0df937132bf0381b136a80cab6e46bdd0186f69490a825961b9d53f15`**, igual à base P0. Nome `/status`, opção obrigatória `url`, descrições e contrato `data`/`execute(interaction)` preservados. |
| Sintaxe | `PASS`: `node --check` via stdin em **28/28** JS (25 anteriores, helper e dois arquivos de teste), na raiz e nas duas cópias limpas. |
| Manifest/dependências | `PASS`: só `scripts.test` mudou no manifest; dependências e engines iguais ao HEAD, manifest/raiz do lock coerentes e **package-lock.json inalterado**. Nenhuma nova dependência. |
| Rede/segredos/diff | `PASS`: guardas dos testes bloqueiam DNS, sockets TCP/TLS e chamadas reais; testes controlados não consultam Internet nem serviços internos. Revisão de arquivos alterados sem padrões de credenciais, `.env` ignorado/não rastreado, links internos e `git -c core.autocrlf=false diff --check` verificados. Sem leitura de valores do `.env` ou dumps de erros reais. |

As cópias/validadores auxiliares ficam em `node_modules/.codebucket-p1/` (ignorado); o runtime e caches continuam em `node_modules/.codebucket-p0/`. Instalações usaram `NODE_ENV=development`/`production`, `--prefix` para a cópia correspondente, `--cache` para o cache P0 de cada modo, `--no-audit --no-fund --logs-max=0 --update-notifier=false`, registry público npm e configurações vazias por modo. `PATH` e `NODE_OPTIONS=--preserve-symlinks --preserve-symlinks-main` foram definidos somente nos processos de verificação. A primeira checagem de espaços com `core.autocrlf=false` sinalizou CRLF nos dois arquivos antigos alterados; esses arquivos foram normalizados para LF e a checagem final passou.

**Limites da conclusão P1.1:** R06 corrigido no código e nos testes locais, sem certificação de produção. IPv6 aceita somente `2000::/3`, excluindo `2001::/23`, `2001:db8::/32`, `2002::/16` e `3fff::/20`; mapped/tradução e alguns blocos especiais globalmente roteáveis são recusados conservadoramente. IPv4 recusa faixas especiais e o IP virtual Azure. Primeiro IP aprovado sem fallback, zero redirects e limites de 5 s/1 MiB/16 KiB podem recusar sites online. Consulta DNS já submetida ao sistema não é cancelada pelo deadline; seu resultado tardio é ignorado e nunca abre conexão. R05/R07 ainda estavam abertos ao concluir P1.1 e foram tratados na P1.2 acima. R15 continua `MITIGATED`, sem cobertura funcional integral. Discord real, permissões, APIs, roteamento da hospedagem, auditoria de vulnerabilidades e recuperação integral são `NOT_CONFIRMED`.

Referências técnicas verificadas nesta fase: [IANA IPv4](https://www.iana.org/assignments/iana-ipv4-special-registry/), [IANA IPv6](https://www.iana.org/assignments/iana-ipv6-special-registry/), [Node 24 HTTP/Agent/proxies](https://nodejs.org/docs/latest-v24.x/api/http.html) e [IP virtual Azure](https://learn.microsoft.com/en-us/azure/virtual-network/what-is-ip-address-168-63-129-16). A política é estática e deve ser revista quando esses registros mudarem; não há allowlist fixa de domínios.

## Resultado da Fase 1 / P0 — 2026-11-07

Registro histórico: base `develop` / `02e22dd408a12b857127ebb1a689a857b6dd8a58`; árvore inicialmente limpa. O cérebro já estava commitado e a referência local `origin/develop` coincidia com a branch. Posteriormente, o P0 foi commitado em `49138e6`, base da tarefa P1.1.

| Verificação executada | Resultado e limite |
| --- | --- |
| Runtime e procedência | `PASS`: ZIP oficial Windows x64 Node **24.22.2**, SHA-256 igual ao `SHASUMS256.txt` da mesma distribuição, Node `--version` e npm CLI `--version` confirmam **24.22.2 / 11.19.1**. `.nvmrc` exata e `engines.node: 24.x` coerentes. |
| Instalação limpa normal | `PASS`: `NODE_ENV=development`, `npm ci --engine-strict` com opções de isolamento descritas em [OPERATIONS](OPERATIONS.md), exit **0**, **85 pacotes**. |
| Instalação limpa de produção | `PASS`: `NODE_ENV=production`, `npm ci --omit=dev --engine-strict`, mesmas opções, exit **0**, **85 pacotes**, incluindo Prettier 3.5.3. |
| Isolamento | `PASS`: duas cópias inicialmente sem node_modules e sem `.env`, caches npm distintos inicialmente vazios e userconfig/globalconfig vazios. A resolução dos módulos foi interceptada e recusava caminhos fora da cópia; 687 arquivos de dependências resolvidos localmente em cada instalação. Nenhum fallback para o node_modules antigo. |
| Sintaxe em ambos os modos | `PASS`: **25/25** arquivos JS por instalação, `node --check` recebendo fonte via stdin. Os pontos de entrada foram apenas analisados, nunca executados. |
| Comandos em ambos os modos | `PASS`: **23/23** módulos com `execute` função, `data.toJSON()` executado e nomes únicos; nenhum nome duplicado. |
| Contratos públicos preservados | `PASS`: JSON dos 23 comandos comparado com baseline anterior à mudança. Ambos os modos produziram SHA-256 `e50cb9e0df937132bf0381b136a80cab6e46bdd0186f69490a825961b9d53f15`; fonte dos comandos inalterado. |
| Prettier de produção | `PASS`: execução real de `/formatar` com interação/reply simulados para **babel, html, css, json e markdown**, em ambos os modos; um reply, embed serializável e conteúdo formatado esperado por caso. Sem Discord/API. |
| Manifest, lock e engines | `PASS`: dependências/engines da raiz iguais; 85/85 versões instaladas iguais ao lock por cópia. As **63** declarações de engine Node das dependências mais a do projeto (**64**) aceitam o runtime; requisitos npm presentes também aceitam 11.19.1. |
| Ausência de atualização de pacotes | `PASS`: comparação das 85 entradas do lock contra `HEAD`: versões, resolved, integrity e demais metadados iguais, exceto remoção intencional de `prettier.dev`. Manifest/raiz do lock refletem somente a movimentação do Prettier e engines. |
| Rede durante checks offline | `PASS`: `http`/`https` e `fetch` guardados pelo verificador, **0 tentativas**; somente downloads oficiais Node/registry npm foram necessários na preparação/instalação. Não houve login, PUT Discord nem chamada das APIs dos comandos. |
| Preservação e segurança | `PASS`: `.env` e fontes/assets preservados, `.env` ignorado/não rastreado; exemplo mantém os quatro nomes da aplicação e nenhum segredo foi acrescentado ao diff. Links internos e espaços revisados. |
| Shim global NVM | `BLOCKED` somente para ativação pelo proxy: padrão `vnone`, só Node 20 instalado, auto-install desativado. Runtime portátil explícito funcional; não foram alterados NVM, PATH persistente ou Registro. Não há bloqueio restante para os testes P0 offline. |

Os checks usaram `--preserve-symlinks --preserve-symlinks-main` no Node por causa da restrição de resolução de ancestrais documentada na auditoria inicial. Uma primeira comparação do verificador falhou porque confrontou objetos com propriedades `undefined` e baseline já salva em JSON; foi corrigida para comparar o **JSON serializado**, que é o contrato REST relevante. As execuções finais acima passaram; não houve correção de código do bot por esse falso alarme.

As evidências locais auxiliares estão na área ignorada `node_modules/.codebucket-p0/`, incluindo baseline e resumos JSON por instalação; podem desaparecer ao recriar o node_modules original. O registro versionado dos resultados é esta tabela. Em P0 não foram adicionados framework, script permanente de auditoria ou CI; `npm test` ainda era placeholder naquele momento. P1.1 acrescentou a suíte focada descrita acima.

## Resultado da inicialização — 2026-11-07

Registro histórico da base `cea09b90889716b5b05139eaf06f8b0e858f179e`: a auditoria inicial usou Node v20.20.0 existente por caminho explícito, que satisfazia os engines então vigentes do lock. Essa versão está EOL e não é recomendação de produção. A validação posterior de Node 24 está na seção Fase 1 acima e em [operações](OPERATIONS.md); o engines atual do projeto é `24.x`.

| Verificação executada | Resultado e limite |
| --- | --- |
| Git, inventário e fontes | `PASS`: árvore inicialmente limpa; 31 arquivos rastreados; leitura dos 25 JS e dos manifests/ignore, inventário dos três assets, consulta de histórico/branch/HEAD. |
| JSON e consistência do lock | `PASS`: manifest/lock parseados; lock v3; ranges raiz de dependencies/devDependencies iguais. |
| Instalação existente | `PASS`: 85/85 manifests de pacotes instalados com versões iguais às do lock; não comprova integridade binária nem instalação limpa. |
| Sintaxe | `PASS`: 25/25 fontes analisados pelo parser Node com `--check` via stdin, sem executar os pontos de entrada. |
| Contrato de comandos | `PASS`: 23/23 módulos importados; `execute` função, `data.toJSON()` executado e nomes únicos. Validação real dos builders de discord.js instalado, sem requisição REST. |
| Node/npm pelo PATH | `BLOCKED`: shims NVM sem versão ativa. Contornado somente para auditoria com executável já instalado, sem mudar configuração global. |
| Resolução padrão de caminhos no sandbox | `BLOCKED` na tentativa inicial: `EPERM ... lstat` em ancestral. `--preserve-symlinks --preserve-symlinks-main` permitiu carregar módulos; stdin permitiu a análise sintática. Não foi falha de sintaxe. |
| `npm test` | `FAIL` esperado: CLI npm existente chamada pelo Node explícito, com flags de symlinks e sem auditoria/logs/notificador; retornou exit 1 e `Error: no test specified`. Não há suíte real. |
| Configuração e ignore | `PASS`: busca em todos os fontes encontrou quatro env names; `.env`/`node_modules` ignorados; `.env` não rastreado. Presença de valores não comprova validade. |
| Documentação e proteção de dados | `PASS`: 12 arquivos exigidos presentes, 23 comandos catalogados, 166 links internos resolvidos e novos arquivos sem token local nem padrões evidentes de segredo; arquivos rastreados anteriores preservados. `git diff --no-index --check` aplicado aos novos arquivos, com `core.autocrlf=false` somente no comando, não encontrou erros de espaços. |

Os gates de documentação foram executados ao fechar esta entrega. O resultado do carregamento não prova autorização de permissões, resposta no prazo ou execução funcional de todos os handlers.

## Reproduzir verificações offline

Com Node da `.nvmrc` preparado, os exemplos abaixo usam `node` pelo PATH. No ambiente desta fase foi usado o binário portátil explícito, conforme [operações](OPERATIONS.md); as flags dos exemplos de runtime portátil e carregamento contornam resolução de ancestrais e não são requisito da arquitetura. Para provar isolamento, repita os checks na instalação limpa, nunca substitua suas dependências pelas antigas.

Suíte permanente, sem Internet, DNS ou sockets reais:

```powershell
npm test
# Alternativa usada para o runtime portátil no ambiente atual:
$p1Runtime = (Resolve-Path 'node_modules/.codebucket-p0/runtime/node-v24.22.2-win-x64').Path
$env:PATH = "$p1Runtime;$env:PATH"
$env:NODE_OPTIONS = '--preserve-symlinks --preserve-symlinks-main'
& "$p1Runtime/node.exe" "$p1Runtime/node_modules/npm/bin/npm-cli.js" test -- --test-reporter=dot
if ($LASTEXITCODE -ne 0) { throw 'Falha na suite offline' }
```

Análise sintática com entrada por stdin, sem login nem registro:

```powershell
$sourceFiles = @(Get-Item -LiteralPath index.js,deploy-commands.js) + @(Get-ChildItem -LiteralPath commands,lib,tests -Filter '*.js')
foreach ($sourceFile in $sourceFiles) {
    Get-Content -LiteralPath $sourceFile.FullName -Encoding UTF8 -Raw | node --check
    if ($LASTEXITCODE -ne 0) { throw "Falha de sintaxe em $($sourceFile.Name)" }
}
```

Contrato local, sem importar `index.js` ou `deploy-commands.js`, sem ler `.env` e sem chamar `execute`:

```powershell
@'
const fs = require('node:fs');
const path = require('node:path');
const names = new Set();
for (const file of fs.readdirSync('commands').filter(f => f.endsWith('.js'))) {
  const command = require(path.resolve('commands', file));
  if (typeof command.execute !== 'function' || typeof command.data?.toJSON !== 'function') {
    throw new Error(`Contrato invalido: ${file}`);
  }
  const data = command.data.toJSON();
  if (names.has(data.name)) throw new Error(`Nome duplicado: ${data.name}`);
  names.add(data.name);
}
console.log(`${names.size} comandos validos localmente`);
'@ | node --preserve-symlinks --preserve-symlinks-main -
if ($LASTEXITCODE -ne 0) { throw 'Falha no contrato dos comandos' }
```

Revise antes qualquer módulo novo: importar JavaScript pode executar efeitos no topo do arquivo. Nos fontes auditados, importar os módulos de comandos não iniciou conexões ou registro. Os exemplos de sintaxe/contrato são verificações pontuais; P1.1 adicionou testes permanentes de contrato e SSRF com Node:test, sem dependência de framework ou CI.

## Gates por tipo de alteração

| Área | Critério a cumprir | Situação atual |
| --- | --- | --- |
| Carregamento/registro | Cada módulo tem builder serializável e `execute` função, nomes únicos, opções válidas e mesmo conjunto no runtime e no payload global. Revisar adição/remoção/renomeação antes de qualquer PUT remoto. | Catálogo validado compartilhado e confirmação CLI presentes; 23 contratos passam offline. Importar módulos continua operação de código confiável, sem isolamento por processo. |
| discord.js | Usar a API da versão efetiva no lock, não pressupor comportamento da última versão. Validar serialização e fluxos de reply/defer/edit/followUp pertinentes. | Builders 14.18.0 carregam; login/permissões/eventos reais `NOT_CONFIRMED`. |
| Erros de interação | Responder uma vez; depois de defer/reply usar a continuação correta; erro útil ao usuário sem segredo. Aguardar/capturar callbacks e reações que podem falhar. | R05 corrigido localmente em P1.2; estados, falhas de envio, privacidade, expiração e efeitos secundários testados. Operação real não confirmada. |
| Parâmetros/saídas | Tipos, limites numéricos, comprimentos, Unicode, URL/destino, enum e limites de mensagens/embeds; validar o caso extremo relevante à mudança. | P2.1 valida os comandos com entrada livre e campos externos consumidos; fronteiras Discord/Unicode, corpo HTTP e budgets de todo cobertos. Conteúdo extenso segue em anexo completo. Formato não comprova suporte/existência remota. |
| Credenciais | `.env` ignorado e não rastreado, exemplo seguro, nenhuma credencial no diff/log. Comparações de valores devem imprimir somente resultado, nunca o valor. | Verificações locais passaram; histórico completo de segredos e credenciais remotas `NOT_CONFIRMED`. |
| APIs externas | Timeout explícito, prazo da interação, schema inesperado, sem resultados, 4xx/5xx, quota/backoff e destino seguro quando aplicável. Preferir mocks em testes locais. | Sete comandos HTTP deferem e têm prazo de 5 s; `/status` mantém política própria SSRF. P2.1 limita corpos a 1 MiB antes do parse e valida a forma dos dados consumidos; quota/backoff e contratos/endpoints reais permanecem limitados/não confirmados. |
| Estado/timers | Isolamento por usuário/servidor conforme contrato, reinício, cancelamento, expiração e falha no envio. Persistência só se aprovada como requisito. | Timer mantém escopo próprio; P2.2 isola todo por guild+usuário ou DM+usuário, respostas privadas, cotas agregadas entre contextos e liberação ao remover. Concorrência/reset simulados; R09 mitigado, estado volátil e sem sincronização/recuperação. |
| Arquivos/assets | Caminhos corretos, anexos presentes, escrita temporária controlada e limpeza inclusive após erro; validar concorrência quando afetada. | Assets preservados; P2.1 gera QR/texto em Buffer sem escrita/cwd/temporários. PNG real em memória, concorrência e falhas de envio testados com guardas de filesystem. |
| Regressão | Comparar contrato/visibilidade/mensagens afetadas, preservar alterações alheias, revisar diff e atualizar cérebro. | Suíte P2.2: 765/765, incluindo coberturas anteriores de SSRF/interações/configuração/bootstrap/registro/timers/arquivos/limites. Contratos/hash preservados; privacidade/isolamento de todo alterados intencionalmente e documentados; cobertura funcional/operacional integral permanece pendente. |

## Pendências explícitas

`NOT_CONFIRMED`: auditoria de vulnerabilidades (`npm audit` desativado nas instalações anteriores), cobertura funcional integral de handlers/integrações, recuperação integral, login Discord, registro remoto e permissões reais. Essas verificações não foram marcadas como aprovadas. Instalações limpas P0/P1.1, cinco casos locais de `/formatar` em P0 e suítes offline P1.1/P1.2/P1.3/P2.1/P2.2 foram comprovados, sem equivaler a aprovação de operação remota.

Quando uma mudança de comportamento for autorizada, mantenha testes focados no risco alterado: erro após reply/defer, timer com limite/cancelamento/envio rejeitado, QR em Buffer sem escrita ou resposta de API inválida/excessiva. Não é necessário criar CI complexo para manter esta base documental.
