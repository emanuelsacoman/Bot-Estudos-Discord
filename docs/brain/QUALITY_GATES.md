# Critérios de qualidade

Use verificações proporcionais à alteração. Uma mudança documental pede revisão de conteúdo, links, diff e segredos; uma mudança em carregamento/contratos pede também sintaxe e serialização de todos os comandos. Uma mudança em API, interação ou estado pede casos de sucesso e falha relevantes. Não use registro global ou login de produção como teste local.

## Resultado da Fase 1 / P0 — 2026-11-07

Base `develop` / `02e22dd408a12b857127ebb1a689a857b6dd8a58`; árvore inicialmente limpa. O cérebro já estava commitado e a referência local `origin/develop` coincidia com a branch. As alterações P0 ainda não foram commitadas por este agente.

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

As evidências locais auxiliares estão na área ignorada `node_modules/.codebucket-p0/`, incluindo baseline e resumos JSON por instalação; podem desaparecer ao recriar o node_modules original. O registro versionado dos resultados é esta tabela. Não foram adicionados framework, script permanente de auditoria ou CI. `npm test` continua o placeholder conhecido, sem alteração nesta fase.

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

Com Node da `.nvmrc` preparado, os exemplos abaixo usam `node` pelo PATH. No ambiente desta fase foi usado o binário portátil explícito, conforme [operações](OPERATIONS.md); as flags do segundo bloco contornam resolução de ancestrais e não são requisito da arquitetura. Para provar isolamento, repita os checks na instalação limpa, nunca substitua suas dependências pelas antigas.

Análise sintática com entrada por stdin, sem login nem registro:

```powershell
$sourceFiles = @(Get-Item -LiteralPath index.js,deploy-commands.js) + @(Get-ChildItem -LiteralPath commands -Filter '*.js')
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

Revise antes qualquer módulo novo: importar JavaScript pode executar efeitos no topo do arquivo. Nos fontes auditados, importar os módulos de comandos não iniciou conexões ou registro. Os exemplos são verificações pontuais; não foi criado framework nem script de auditoria permanente.

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
| Regressão | Comparar contrato/visibilidade/mensagens afetadas, preservar alterações alheias, revisar diff e atualizar cérebro. | Não há suíte automatizada; não confundir checks do parser com testes funcionais. |

## Pendências explícitas

`NOT_CONFIRMED`: auditoria de vulnerabilidades (`npm audit` desativado nas instalações), suíte permanente de handlers, testes de respostas/falhas HTTP, recuperação integral, login Discord, registro remoto e permissões reais. Essas verificações não foram marcadas como aprovadas. Instalações limpas normal/produção e os cinco casos locais de `/formatar` foram comprovados na Fase 1, sem equivaler a aprovação de operação remota.

Quando uma mudança de comportamento for autorizada, proponha testes focados no risco alterado: erro após reply/defer, timer com limite/cancelamento/envio rejeitado, cleanup de QR após falha ou resposta de API inválida. Não é necessário criar CI complexo para manter esta base documental.
