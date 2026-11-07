# Critérios de qualidade

Use verificações proporcionais à alteração. Uma mudança documental pede revisão de conteúdo, links, diff e segredos; uma mudança em carregamento/contratos pede também sintaxe e serialização de todos os comandos. Uma mudança em API, interação ou estado pede casos de sucesso e falha relevantes. Não use registro global ou login de produção como teste local.

## Resultado P1.1 — SSRF de `/status` — 2026-11-07

Base `develop` / `49138e616e02cfc86b6241f93694812994b0cbd6` (`Fase 1/P0`), árvore inicialmente limpa. Node **24.22.2**, npm **11.19.1**, Windows x64/PowerShell; runtime portátil P0 por caminho explícito. Nenhum ponto de entrada foi executado. Alterações desta tarefa ainda sem commit/push.

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

**Limites da conclusão:** R06 corrigido no código e nos testes locais, sem certificação de produção. IPv6 aceita somente `2000::/3`, excluindo `2001::/23`, `2001:db8::/32`, `2002::/16` e `3fff::/20`; mapped/tradução e alguns blocos especiais globalmente roteáveis são recusados conservadoramente. IPv4 recusa faixas especiais e o IP virtual Azure. Primeiro IP aprovado sem fallback, zero redirects e limites de 5 s/1 MiB/16 KiB podem recusar sites online. Consulta DNS já submetida ao sistema não é cancelada pelo deadline; seu resultado tardio é ignorado e nunca abre conexão. R07 permanece (sem defer) e R05 permanece no handler global; R15 está `MITIGATED`, pois demais handlers ainda não têm cobertura permanente. Discord real, permissões, APIs, roteamento da hospedagem, auditoria de vulnerabilidades e recuperação integral são `NOT_CONFIRMED`.

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
| Carregamento/registro | Cada módulo tem builder serializável e `execute` função, nomes únicos, opções válidas e mesmo conjunto no runtime e no payload global. Revisar adição/remoção/renomeação antes de qualquer PUT remoto. | 23 contratos passam offline; validadores permanentes nos pontos de entrada ausentes. |
| discord.js | Usar a API da versão efetiva no lock, não pressupor comportamento da última versão. Validar serialização e fluxos de reply/defer/edit/followUp pertinentes. | Builders 14.18.0 carregam; login/permissões/eventos reais `NOT_CONFIRMED`. |
| Erros de interação | Responder uma vez; depois de defer/reply usar a continuação correta; erro útil ao usuário sem segredo. Aguardar/capturar callbacks e reações que podem falhar. | `KNOWN_RISK`: reply genérico e timer assíncrono sem proteção adequada. |
| Parâmetros/saídas | Tipos, limites numéricos, comprimentos, Unicode, URL/destino, enum e limites de mensagens/embeds; validar o caso extremo relevante à mudança. | Tipos/required existem; várias validações semânticas e limites estão ausentes. |
| Credenciais | `.env` ignorado e não rastreado, exemplo seguro, nenhuma credencial no diff/log. Comparações de valores devem imprimir somente resultado, nunca o valor. | Verificações locais passaram; histórico completo de segredos e credenciais remotas `NOT_CONFIRMED`. |
| APIs externas | Timeout explícito, prazo da interação, schema inesperado, sem resultados, 4xx/5xx, quota/backoff e destino seguro quando aplicável. Preferir mocks em testes locais. | Só `/status` define timeout; não há defer/política central; endpoints não exercitados. |
| Estado/timers | Isolamento por usuário/servidor conforme contrato, reinício, cancelamento, expiração e falha no envio. Persistência só se aprovada como requisito. | Memória volátil, compartilhada entre servidores por userId; limites/callback são riscos. |
| Arquivos/assets | Caminhos corretos, anexos presentes, escrita temporária controlada e limpeza inclusive após erro; validar concorrência quando afetada. | Assets existem; QR depende do cwd e não usa finally. |
| Regressão | Comparar contrato/visibilidade/mensagens afetadas, preservar alterações alheias, revisar diff e atualizar cérebro. | Suíte focada P1.1 cobre SSRF/status, interface simulada e contratos dos 23 comandos; demais handlers ainda carecem de cobertura. |

## Pendências explícitas

`NOT_CONFIRMED`: auditoria de vulnerabilidades (`npm audit` desativado nas instalações), cobertura permanente dos demais handlers/integrações, recuperação integral, login Discord, registro remoto e permissões reais. Essas verificações não foram marcadas como aprovadas. Instalações limpas normal/produção, cinco casos locais de `/formatar` em P0 e testes HTTP/SSRF/interface de `/status` em P1.1 foram comprovados, sem equivaler a aprovação de operação remota.

Quando uma mudança de comportamento for autorizada, proponha testes focados no risco alterado: erro após reply/defer, timer com limite/cancelamento/envio rejeitado, cleanup de QR após falha ou resposta de API inválida. Não é necessário criar CI complexo para manter esta base documental.
