# Critérios de qualidade

Use verificações proporcionais à alteração. Uma mudança documental pede revisão de conteúdo, links, diff e segredos; uma mudança em carregamento/contratos pede também sintaxe e serialização de todos os comandos. Uma mudança em API, interação ou estado pede casos de sucesso e falha relevantes. Não use registro global ou login de produção como teste local.

## Resultado da inicialização — 2026-11-07

Base `cea09b90889716b5b05139eaf06f8b0e858f179e`; runtime de auditoria Node v20.20.0 existente, por caminho explícito. Ele satisfaz os engines do lock, mas está EOL e não constitui recomendação de produção; [operações](OPERATIONS.md) propõe validar uma LTS suportada.

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

Depois de corrigir o runtime local, os exemplos abaixo usam `node` pelo PATH. No sandbox auditado foi necessário substituir `node` pelo caminho do binário existente; as flags do segundo bloco contornam a resolução de ancestrais e não são requisito da arquitetura.

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

`NOT_CONFIRMED`: instalação limpa com Node LTS proposto, `npm ci`, auditoria de vulnerabilidades, testes automatizados de handlers, testes de respostas/falhas HTTP, recuperação integral, login Discord, registro remoto e permissões reais. Nenhuma dessas verificações foi marcada como aprovada.

Quando uma mudança de comportamento for autorizada, proponha testes focados no risco alterado: erro após reply/defer, timer com limite/cancelamento/envio rejeitado, cleanup de QR após falha ou resposta de API inválida. Não é necessário criar CI complexo para manter esta base documental.
