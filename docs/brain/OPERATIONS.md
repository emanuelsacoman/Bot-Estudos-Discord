# Operação e recuperação

## Fechamento P3.3 e preparação P3.4

Atualizado em **2026-11-23**, America/Sao_Paulo, base **develop/6478dabf9ed565136d079e06bacfae65f8f6bc2a**, inicialmente limpa. A preparação P3.3 está commitada e enviada nessa revisão; comparação somente leitura com `develop` remoto confirmou **ahead 0 / behind 0**. Este fechamento documental é posterior à revisão e permanece local, sem commit, push ou merge executado pelo assistente nesta tarefa.

**P3.3 DONE no escopo manual relatado:** em relato recebido em **2026-11-23**, o responsável confirmou configuração validada, login real bem-sucedido, contagem pontual de **134 servidores**, funcionamento manual dos **23 comandos** e que não foi necessário registrar novamente os comandos globais. A data de recebimento não estabelece a data da operação nem o commit executado. O assistente não acompanhou essa sessão e não recebeu coleta individual dos comandos, entradas, mensagens ou logs. Não se presume o valor atual de `INVITE_URL`, o estado do processo ou seu encerramento.

**Evidências distintas:** os gates automatizados verificam o checkout offline; o funcionamento real acima é informação fornecida pelo responsável. A suíte foi repetida neste fechamento com **1266/1266** testes aprovados. Neste fechamento também foram repetidos sintaxe **63/63**, **23 contratos/hash**, **85 versões** e dry-run **23 comandos/exit 0**; os resultados atuais e seus limites são registrados em [QUALITY_GATES](QUALITY_GATES.md). Nenhum login, comando Discord, consulta funcional a APIs, registro global, deploy, reinício, mudança de credencial ou permissão foi executado pelo assistente neste fechamento; o acesso remoto foi somente leitura no GitHub.

**Histórico do checkpoint anterior:** a preparação em `9d1b863` encontrou `INVITE_URL` inválida, o responsável adiou seu ajuste e o assistente encerrou antes do login. Esse bloqueio é um registro histórico, superado pelo relato atual de configuração validada e funcionamento. Nesta tarefa, `.env` não foi alterado nem revalidado. O relato não autoriza nova conexão, reinício, registro global ou outra operação remota.

### Processo único e encerramento

A instância usada pelo responsável e seu estado atual **não foram inspecionados pelo assistente**. Na preparação anterior, a consulta WMI foi negada; esse resultado não identifica o processo do ensaio nem comprova ausência de concorrência. Antes de uma nova execução autorizada, confirmar com o responsável se há instância em outro terminal, serviço ou hospedagem e identificar o processo próprio; não interromper produção ou encerrar todos os processos Node.

O código não tem trava de instância ou sincronização. Duas instâncias podem disputar respostas às mesmas interações, enquanto todo, timers, cooldowns e pausas de APIs ficam independentes em cada memória. Usar uma única instância no escopo confirmado. Esclarecer a existência de outra instância antes de iniciar uma nova.

Em nova execução explicitamente autorizada, usar o runtime validado e executar **em primeiro plano no terminal de origem**, a partir da raiz, `& $nodeRuntime index.js`. Não registrar comandos para diagnosticar conexão. Ao terminar a instância autorizada, usar `Ctrl+C` nesse mesmo terminal e confirmar que o processo específico encerrou. Não há handler geral de desligamento gracioso SIGINT/SIGTERM; parar perde estado temporário conforme o ADR 0003. O cleanup limitado do bootstrap trata falha de inicialização e não equivale a um mecanismo geral de parada. Não encerrar instância anterior nem repetir login automaticamente após uma falha.

### Roteiro individual dos 23 comandos — sem coleta individual

O responsável relatou os **23/23 comandos funcionais em conjunto**. A tabela preserva os cenários propostos antes dessa operação, sem afirmar que essas entradas ou saídas específicas foram exercitadas. A coluna final indica a ausência de coleta individual do cenário; isso não invalida o relato agregado nem transforma o comportamento esperado em resultado observado.

Para eventual ensaio complementar autorizado, usar canal/servidor de teste controlado e entradas sem dados pessoais; aguardar mais de cinco segundos entre chamadas do mesmo comando, inclusive subcomandos. As saídas públicas abaixo são as esperadas no caminho normal. Registrar falhas, quotas e indisponibilidade como observadas, sem loops de retry; não concluir instalações ou efetuar voto apenas para conferir um botão.

As entradas indicam os **valores do contrato**. Em `/formatar`, `linguagem:babel` corresponde à escolha visual **JavaScript** no cliente Discord; `markdown` corresponde a Markdown. As permissões da [matriz](COMMANDS.md#matriz-de-recursos-e-permissões--p32) são requisitos esperados, ainda **NOT_CONFIRMED**: convite com scopes `bot applications.commands` e bitfield 117824 não comprova cargos/sobrescritas do canal. DM e threads precisam de ensaio específico quando incluídos no escopo; não ampliar intents nem conceder Administrator por conveniência.

| Comando | Entrada segura planejada | Resultado esperado pelo código | Coleta individual do cenário |
| --- | --- | --- | --- |
| `/autor` | Sem opções | Embed público, botão GitHub e três reações Unicode | Sem coleta individual |
| `/count` | `texto:abc 123` | Embed público: 7 caracteres, 2 palavras, 3 letras e 3 números | Sem coleta individual |
| `/docs` | Sem opções; selecionar JavaScript no menu novo | Embed/menu público; seleção responde link da documentação | Sem coleta individual |
| `/exercise` | `linguagem:javascript` | Embed público com um exercício aleatório da linguagem | Sem coleta individual |
| `/formatar` | `linguagem:babel`, `codigo:const x={a:1}` | Embed público com código formatado, sem executar o código; anexo no caso complementar abaixo | Sem coleta individual |
| `/git` | Sem opções | Embed público com referências Git; nenhum comando Git é executado | Sem coleta individual |
| `/github` | `repositorio:nodejs/node` | Embed público do repositório; falha pública sanitizada se a consulta não concluir | Sem coleta individual |
| `/help` | Sem opções | Embed público listando os 23 comandos locais | Sem coleta individual |
| `/http` | Primeiro `codigo:100`; depois, se incluída consulta externa, `codigo:200` | Embed público local para 100; resultado público ou falha efêmera sanitizada para consulta 200 | Sem coleta individual |
| `/invite` | Sem opções | Embed/botão público e coração; conferir ID da aplicação, scopes e 117824 sem concluir instalação; divergência gera aviso efêmero sem botão | Sem coleta individual |
| `/lofiradio` | Sem opções | Embed/botão público e dois anexos locais (thumbnail/imagem); sem áudio ou voz | Sem coleta individual |
| `/moeda` | `valor:1`, `origem:USD`, `destino:BRL` | Embed público com resultado recebido; falha efêmera sanitizada | Sem coleta individual |
| `/ping` | Sem opções | Texto efêmero, editado com a latência da resposta inicial | Sem coleta individual |
| `/playlist` | Sem opções | Embed e follow-up público com link Spotify; reação Unicode no follow-up | Sem coleta individual |
| `/qrcode` | `link:https://lofiradio.web.app` | Embed público e PNG anexado, sem consultar o endereço informado | Sem coleta individual |
| `/question` | `pergunta:javascript array map` | Embed público se encontrado; ausência ou falha efêmera sanitizada | Sem coleta individual |
| `/repositorys` | `linguagem:javascript` | Lista pública de até cinco repositórios; ausência/falha pública sanitizada | Sem coleta individual |
| `/servercount` | Sem opções | Embed público com total do cache atual; não pressupor um número previamente | Sem coleta individual |
| `/status` | `url:https://example.com` | Embed público com status observado ou falha genérica; disponibilidade não presumida | Sem coleta individual |
| `/timer` | `set tempo:1`; após observar vencimento, `set tempo:2` e `stop` | Confirmação pública e aviso público no canal após cerca de um minuto; novo timer cancelado sem aviso posterior | Sem coleta individual |
| `/todo` | `list`, `add tarefa:Ensaio P3.3`, `list`, `remove numero:<índice do item criado>` | Todas as respostas efêmeras; remover somente após confirmar inclusão e índice da tarefa do ensaio, sem tocar em itens preexistentes | Sem coleta individual |
| `/translate` | `idioma:pt`, `texto:Hello world` | Tradução pública com menção; falha efêmera sanitizada | Sem coleta individual |
| `/vote` | Sem opções | Embed/botão top.gg público e estrela; página externa independente do ID da instância | Sem coleta individual |

Complementos proporcionais **sem coleta individual no relato**: uma segunda chamada de `/formatar` com `linguagem:markdown` e um bloco Markdown cercado de código deve devolver anexo integral; QR e Lofi permitem conferir upload de imagem. Conferir o ID do botão de convite com a aplicação esperada, sem publicar credenciais. Verificar privacidade de `/todo` e `/ping` com outro participante autorizado; isolamento de servidor/DM e envio em threads permanecem **NOT_CONFIRMED**. Para `/status`, uma entrada loopback como `url:http://127.0.0.1` deve ser recusada localmente, sem acesso ao destino. Falhas deliberadas de permissões dependem de autorização para a mudança remota. O relato agregado não comprova a execução desses complementos.

O fechamento aceita a confirmação manual do responsável no escopo informado e mantém R12 **MITIGATED**: identidade detalhada, cargos/sobrescritas, permissões negativas, destinos finais de links, DM/threads e os cenários complementares não foram demonstrados individualmente. Hospedagem, uptime, reinício/recuperação e retenção/acesso a logs seguem **NOT_CONFIRMED**. A volatilidade de tarefas/timers/cooldowns após interrupção continua aceita no [ADR 0003](decisions/0003-estado-operacional-temporario.md), sem introduzir persistência.

### Preparação P3.4 — integração de develop em main

Na comparação realizada para este fechamento, `main` local/remoto está em `cea09b90889716b5b05139eaf06f8b0e858f179e` e `develop` local/remoto em `6478dabf9ed565136d079e06bacfae65f8f6bc2a`. `main` é ancestral de `develop`: **0 commits exclusivos de main / 14 de develop**, com **81 arquivos** no delta acumulado. Uma integração por fast-forward é tecnicamente possível nesse grafo; nenhum merge foi executado. Esse delta inclui as entregas P0–P3.3, não apenas o fechamento documental. A movimentação do Prettier para dependência de produção e a política Node 24 integram o delta, sem atualização das versões travadas dos pacotes.

Antes de uma integração explicitamente autorizada, conferir o snapshot final incluindo este fechamento, os gates atuais em QUALITY_GATES, os 23 contratos/hash contra HEAD e main, o diff acumulado e a ausência de segredos. Reconfirmar referências remotas e regras da branch quando a operação for autorizada, pois o estado pode mudar. A possibilidade de fast-forward não comprova permissões ou proteções remotas. Commit, merge e push dependem de autorização própria; não implicam registro de comandos, deploy, início, interrupção ou reinício do bot. O estado da instância do responsável precisa ser confirmado antes de qualquer ação operacional sobre ela.

## Registro histórico — preparação P3.2

Atualizado na **P3.2 — R12, 2026-11-23**, base `develop/3ecdd7cca90344f1bb0d5eb4cf072c4ce6516d18`, árvore limpa no início. P3.1 já está commitada nessa base; resultados anteriores são históricos em [QUALITY_GATES](QUALITY_GATES.md). A P3.2 valida identidade/convites/URLs e prepara o procedimento Windows sem login, registro global ou alterações remotas. R12 permanece **MITIGATED** pelas verificações Discord ainda pendentes. O [ADR 0003](decisions/0003-estado-operacional-temporario.md) mantém estado exclusivamente em memória e perda após reinício aceita; R17 preserva diagnósticos mínimos e retenção externa `NOT_CONFIRMED`. Os exemplos usam PowerShell na raiz; a execução do bot e o registro continuam ações separadas que exigem autorização explícita.

Evidências P3.2: suíte **1266/1266**, focais R12 **77/77**, dry-run com **23 comandos/exit 0**, instalações limpas normal/produção **85 pacotes/exit 0** cada e 23 contratos/hash preservados em ambas. Esses resultados offline não verificam login, aplicação/token associados, permissões, páginas externas ou disponibilidade da hospedagem; detalhes e limites em qualidade.

## Preparar Node.js e dependências

O runtime de referência é **Node 24.22.2 LTS (Krypton)**, com **npm 11.19.1** da distribuição oficial. [.nvmrc](../../.nvmrc) fixa o patch reproduzível; `engines.node: "24.x"` no manifest/lock expressa a linha suportada pelo projeto, sem aceitar automaticamente novos majors. Isso é uma política do projeto: o mínimo legado do lock continua >=18.17, mas Node 18/20 estão EOL. Node 24 está em Maintenance LTS, com fim de suporte previsto para 2028-04-30. Fontes consultadas em 2026-11-07: [distribuições oficiais](https://nodejs.org/dist/index.json) e [calendário oficial](https://github.com/nodejs/Release/blob/main/schedule.json).

Em máquina nova, instale a versão da `.nvmrc` pelo instalador/ZIP oficial ou gerenciador adequado e confira as versões abaixo. `.nvmrc` é uma referência, não instala Node nem garante ativação em todos os gerenciadores. `engines` também não instala o runtime; use `--engine-strict` para detectar incompatibilidade na instalação.

```powershell
node --version
npm --version
```

### Diagnóstico Windows/NVM — P3.2

Em 23/11/2026, `.nvmrc` continua `24.22.2`. A mensagem histórica “Node.js v24.22.2 is not installed or cannot be found” descrevia uma instalação ausente na Fase 1; não corresponde integralmente ao ambiente atual. Foram executados `node --version`, `npm --version`, `nvm list`, `nvm --version` e resolução por `Get-Command`. Resultados atuais:

| Verificação | Resultado observado |
| --- | --- |
| `node --version` | `v24.22.2` pelo shim |
| `nvm list` | `24.22.2` e `20.20.0` instalados |
| `nvm --version` | `v2.0.1-hotfix.6` |
| Resolução PowerShell | `node.exe`/`npm.exe` em `C:\Users\Emanuel\AppData\Local\Author Software\nvm\.nodejs`; NVM no diretório pai |
| Runtime fora de `node_modules` | `C:\Users\Emanuel\AppData\Local\Author Software\nvm\installs\v24.22.2\node.exe` existe e executa a versão esperada |
| `npm --version` pelo shim | Bloqueado por **NVM4306**, script delegado `npm-cli.js` não confiável; não foi executado diretamente para contornar o bloqueio |
| Metadados do npm instalado | `11.19.1`; ler metadados não comprova execução da CLI |
| Área portátil P0 antiga | `node_modules/.codebucket-p0/` ausente; os caminhos antigos são apenas históricos |

O gerenciador instalado é NVM Windows **v2**, com shims, resolução por projeto e controle de confiança; receitas de outras implementações de NVM não são automaticamente compatíveis. A falha atual é de confiança do launcher npm, distinta de ausência/seleção do Node. Também houve aviso de escrita negada no marcador de bootstrap do Registro durante consulta; nenhuma configuração persistente foi alterada. A origem exata da divergência de confiança não foi estabelecida (`NOT_CONFIRMED`). A [documentação do NVM v2](https://docs.nvm-windows.com/features/newv2/) e a [política do firewall](https://docs.nvm-windows.com/features/firewall/) distinguem esses mecanismos. Reparar/reinstalar a versão gerenciada ou mudar confiança exige verificar integridade e autorização específica; não foi feito nesta tarefa.

### Runtime independente verificado, sem alterar o NVM

A P3.2 baixou uma distribuição oficial independente Windows x64, fora de qualquer `node_modules`, em `C:\Users\Emanuel\AppData\Local\Temp\CodeBucket-p32-runtime-20261123\node-v24.22.2-win-x64`. SHA-256 do ZIP: `CA1BFF5D8EAD13C9F2EA404A176DB46BD430704D5B5113734049FA365E7799E2`, conferido com o `SHASUMS256.txt` da [distribuição oficial v24.22.2](https://nodejs.org/dist/v24.22.2/). Esse runtime e seu próprio npm foram executados: **Node v24.22.2/npm 11.19.1**. Não se reutilizou o script npm bloqueado do NVM, não se desativou proteção e não se alterou confiança, padrão global, Registro ou PATH persistente.

A pasta temporária pode ser removida pelo sistema. Se ausente, obtenha novamente o ZIP da versão exata no endereço oficial, compare `Get-FileHash -Algorithm SHA256` com a entrada exata de `SHASUMS256.txt` e extraia em diretório local fora do `node_modules` que será instalado. Não execute um arquivo cuja integridade divergir. Para usar a cópia verificada existente nesta máquina:

```powershell
$codeBucketRuntime = Join-Path $env:TEMP 'CodeBucket-p32-runtime-20261123/node-v24.22.2-win-x64'
$nodeRuntime = Join-Path $codeBucketRuntime 'node.exe'
$npmCli = Join-Path $codeBucketRuntime 'node_modules/npm/bin/npm-cli.js'
if (-not (Test-Path -LiteralPath $nodeRuntime)) {
    throw 'Runtime local ausente. Prepare a distribuicao oficial verificada antes de continuar.'
}
& $nodeRuntime --version
& $nodeRuntime $npmCli --version
# Somente este processo PowerShell; permite aos filhos do npm encontrar o mesmo Node.
$env:PATH = "$codeBucketRuntime;$env:PATH"
```

Esse procedimento se aplica à distribuição independente cuja integridade foi verificada; não é instrução para ignorar uma recusa do firewall do NVM. O `--local` de `nvm use` não deve ser interpretado como alteração restrita à sessão. O sandbox encontrou `EPERM ... lstat` em ancestrais em fases anteriores; flags `--preserve-symlinks --preserve-symlinks-main` foram usadas nos respectivos testes e não são requisito de hospedagem.

### Instalação reproduzível

Com Node 24.22.2/npm 11.19.1 disponíveis **fora do diretório a ser recriado**, use checkout novo e preserve o lock:

```powershell
npm ci --engine-strict
```

Para instalação de produção, em **outra cópia limpa**:

```powershell
npm ci --omit=dev --engine-strict
```

Na sessão configurada acima, os equivalentes explícitos são `& $nodeRuntime $npmCli ci --engine-strict` e, em outra cópia limpa, `& $nodeRuntime $npmCli ci --omit=dev --engine-strict`. Não execute instalação usando um runtime contido no `node_modules` do próprio alvo, porque `npm ci` o recria. As instalações desta entrega e suas limitações estão em [QUALITY_GATES](QUALITY_GATES.md).

As duas variantes foram executadas com sucesso na Fase 1, cada uma instalando 85 pacotes. Prettier `^3.5.3` agora está em `dependencies`, mantendo a versão travada `3.5.3`; a omissão de dev não remove mais o pacote requerido por [formatar.js](../../commands/formatar.js). Os outros pacotes não foram atualizados/removidos. `node-fetch` sem uso encontrado foi preservado. O import transitivo de `@discordjs/builders`, registrado historicamente, foi substituído em `/translate` por `discord.js` na P2.4, sem mudar versões/manifest/lock.

Os testes usaram diretórios inicialmente sem `node_modules`/`.env`: `node_modules/.codebucket-p0/ci-development` e `ci-production`, com cópias somente de fontes, assets, manifests, `.nvmrc` e `.env.example`. O npm recebeu `--prefix` apontando para cada cópia, caches distintos inicialmente vazios, userconfig/globalconfig vazios distintos, `--engine-strict --no-audit --no-fund --logs-max=0 --update-notifier=false` e registry público npm. Produção usou `NODE_ENV=production` e `--omit=dev`; desenvolvimento usou `NODE_ENV=development`. Nenhum pacote/credencial da instalação antiga foi usado para completar as cópias.

`npm ci` recria o `node_modules` do alvo: não aplique na instalação existente sem preparar o ambiente e preservar alterações locais pertinentes. Não remova/atualize o lock para contornar erros. [Comportamento oficial de npm ci](https://docs.npmjs.com/cli/v11/commands/npm-ci).

Na P2.4, duas novas cópias isoladas em `node_modules/.codebucket-p24/ci-development` e `ci-production` receberam instalações limpas offline em 2026-11-08: **85 pacotes/exit 0** em cada, sem mudar manifest/lock. Em 2026-11-13, ambas passaram na importação/serialização dos **23 contratos**, hash público preservado e execução de `/translate` com Unicode e resposta simulada; o resolver recusou dependências fora de cada cópia. Isso comprova a troca do import pela dependência direta nos dois modos, sem comprovar operação do endpoint real. Detalhes em [qualidade](QUALITY_GATES.md).

Em P1.1, as duas variantes passaram novamente em `node_modules/.codebucket-p1/ci-development` e `ci-production`, com `--offline` e os caches P0 já preenchidos. `npm test` executa a suíte offline sem precisar de `.env`; P1.3 acrescenta casos de configuração, inicialização, registro e timers. Instruções/resultados em [qualidade](QUALITY_GATES.md). Distribua todo `lib/`: runtime, comandos e registro dependem dos módulos locais de configuração, catálogo, ciclo de vida, respostas, HTTP e timers. P1.2/P1.3/P2.1 não adicionam dependências. P2.1 acrescenta content-limits/todo-store e amplia o helper HTTP; distribua todos os helpers. QR e fallbacks de texto não exigem diretório gravável.

## Revisar módulos locais antes de carregar — P2.5

O catálogo executa JavaScript confiável do checkout. Importar um módulo ou chamar seu toJSON não é uma operação de sandbox; o catálogo valida o contrato resultante e falha de forma sanitizada, mas não desfaz o que o código já executou. A revisão P2.5 não encontrou correção adicional justificada para os 23 comandos presentes; R03 permanece `MITIGATED`. Inventário e limitações estão na [arquitetura](ARCHITECTURE.md#confiança-e-efeitos-na-importação--p25).

Antes de aceitar um módulo ou mudança de dependência, em tarefa autorizada:

1. Conferir origem/diff do código e caminhos de require/import, inclusive dependências transitivas e symlinks. Não carregar módulos ou executar código enviados por usuários do Discord; entradas dos comandos não devem virar caminhos de módulo.
2. Separar inicialização estática de rede, credenciais, escrita/exclusão, timers, listeners globais, processos filhos e trabalho assíncrono no topo. Preservar funções de inicialização/execute explícitas. Prettier inicia import ESM local, tslib publica helpers globais e a pilha Undici prepara dispatchers globais ociosos; esses efeitos transitivos conhecidos não equivalem a operação remota nem a autorização para carregar código desconhecido.
3. Preservar catálogo compartilhado, ordenação determinística, data/execute e validação integral. Um módulo inválido deve bloquear a preparação inteira antes de Client/login ou REST/PUT; não remover arquivos ou contornar o validador para obter um conjunto parcial.
4. Executar os gates offline pertinentes e comparar os 23 contratos/hash. Instalação, atualização de pacotes, execução das entradas ou operações remotas exigem o escopo correspondente; a auditoria de um require não as autoriza automaticamente.
5. Não introduzir sandbox, workers, containers ou infraestrutura para isolar código já autorizado no repositório sem requisito concreto. Integridade de checkout/instalação e revisão continuam controles necessários; os probes offline pontuais não garantem isolamento contra módulos maliciosos.

Essa política não muda Node 24, CommonJS, memória temporária, limites ou a arquitetura de um processo. Não requer banco/disco durável ou serviços adicionais para hospedagem gratuita, cuja compatibilidade operacional continua `NOT_CONFIRMED`.

## Configurar ambiente e autenticação

O bootstrap de `index.js` e o modo **confirmado** de registro carregam `dotenv.config()` de forma lazy, sem caminho explícito: execute a partir da raiz, pois o `.env` é buscado no diretório de trabalho. Importar os pontos de entrada e usar `--dry-run` não carrega dotenv nem inicia login/PUT. Variáveis já injetadas no processo prevalecem sobre as do arquivo pelo comportamento padrão do dotenv instalado.

Crie `.env` a partir do exemplo somente se ainda não existir:

```powershell
if (-not (Test-Path -LiteralPath .env)) {
    Copy-Item -LiteralPath .env.example -Destination .env
}
```

Preencha os valores localmente em editor seguro ou injete-os pelo gerenciador de segredos da hospedagem; não os inclua em logs, terminal compartilhado ou commits.

| Variável | Necessidade e origem | Comportamento existente |
| --- | --- | --- |
| `TOKEN` | Obrigatória para login e registro confirmado. Token do bot no Discord Developer Portal; dry-run não a exige. | [config.js](../../lib/config.js) normaliza prefixo `Bot`/`Bearer` e valida antes de Client/REST: valor opaco de 20–512 caracteres ASCII alfanuméricos ou `_ . -`, sem placeholders, espaços ou formas evidentemente inválidas. Não imprime nem valida a credencial online. |
| `CLIENT_ID` | Opcional no runtime; obrigatória para registro confirmado. Application ID da mesma aplicação do token; identificador público. | Se preenchida, sempre exige decimal canônico de 17–20 dígitos, sem zero inicial e até uint64. `/invite` confronta com `interaction.applicationId`; divergência produz aviso privado sem URL. O registro usa `Routes.applicationCommands(CLIENT_ID)`. |
| `INVITE_URL` | Opcional; prefira vazia para geração do convite da aplicação atual. | HTTPS em `discord.com`, authorize em `/oauth2/authorize` ou `/api/oauth2/authorize`, exatamente `client_id`, `permissions=117824` e scopes `bot applications.commands`, únicos e coerentes. Sem parâmetros extras, credenciais, porta ou fragmento. Ausente/vazia não usa ID histórico. |
| `LOFIRADIO_URL` | Opcional, link público HTTPS de até 512 caracteres. | Vazia usa `https://lofiradio.web.app`. Exige hostname DNS público bem formado; recusa credenciais, query, fragmento, controles/espaços, barra invertida, percent-encoding malformado, host local e IP literal. Normaliza parênteses/colchetes para uso seguro em Markdown e mantém o limite após codificar. Apenas gera link/embed/botão. |

Essas são **as quatro variáveis de configuração da aplicação**; não há `GUILD_ID` nem chaves de APIs externas implementadas. `NODE_ENV` e configurações de ferramentas não são contratos da aplicação. `readConfig` valida TOKEN, CLIENT_ID opcional e URLs configuradas antes de criar Client/login; falhas têm mensagens fixas sem valores. A validação é estrutural: não decodifica token, não prova associação TOKEN/CLIENT_ID ou disponibilidade/propriedade de site. O confronto da identidade efetiva só ocorre quando existir uma interação real. Parâmetros de URL podem conter segredos; por isso a rádio não admite query/fragmento e o convite admite somente seus três campos públicos. A `.env` existente não é sobrescrita nem exibida nesta preparação.

O Client solicita somente `GatewayIntentBits.Guilds`; não há necessidade técnica identificada de ampliar intents. O convite pede scopes `bot` e `applications.commands` e **117824**, cobrindo ver canal, enviar mensagens comuns, embeds, anexos, histórico e novas reações. Conferir cargos/sobrescritas efetivos e permissão do usuário de usar comandos; o bitfield do convite não supera uma negativa de canal. A [matriz dos 23 comandos](COMMANDS.md#matriz-de-recursos-e-permissões--p32) diferencia respostas de interação, o `channel.send` do timer, reações, anexos e DM. Threads podem exigir `SendMessagesInThreads` para o aviso do timer; o convite-base destina-se a canais de texto comuns. Não pede Administrator.

A página top.gg histórica `https://top.gg/bot/1193011045577523300` é um link externo preservado, independente da identidade Discord da instância. Não se substitui seu ID com base em `CLIENT_ID`; isso inventaria uma página não verificada. As URLs da rádio/site/GitHub/playlist permanecem legítimas referências históricas, sem atestado de disponibilidade. Campos `link` da presença eram ignorados pelo SDK e foram removidos; a rotação continua com nome/tipo, sem promessa de links clicáveis ou transformação em streaming. Uma URL sintaticamente aceita não equivale a serviço online, domínio confiável ou proteção SSRF; nenhum desses links é consultado pela validação local.

### Preparação neste computador — sequência pronta

**Histórico da preparação P3.2/P3.3:** a validação de então recusou `INVITE_URL`, e o usuário adiou o ajuste. O relato recebido em 2026-11-23 informa configuração validada e login bem-sucedido; essa pendência não é tratada como bloqueio atual. O assistente não alterou nem revalidou `.env` neste fechamento, nem verificou qual ajuste foi feito. Para nova máquina ou mudança futura, seguir a validação abaixo antes de uma execução autorizada, sem copiar valores para chat/logs.

Na preparação anterior, CLIENT_ID e LOFIRADIO_URL passaram individualmente; uma cópia somente em memória do ambiente com INVITE_URL vazia passou em `readConfig`. Esse diagnóstico histórico não comprova o valor atual do arquivo. `INVITE_URL=` vazia continua sendo a opção recomendada para derivar o convite da aplicação atual; uma URL explícita precisa cumprir o contrato documentado.

1. Na raiz, confira `git status`, `.nvmrc` e esta entrega. Prepare o runtime independente pelo bloco acima; mantenha `$nodeRuntime`, `$npmCli` e PATH somente nessa sessão. As duas versões devem ser `24.22.2`/`11.19.1`.
2. Instale o lockfile com `& $nodeRuntime $npmCli ci --engine-strict`, usando runtime fora de `node_modules`. Para produção em outra cópia limpa, acrescente `--omit=dev`. A P3.2 executou ambas as instalações isoladas: 85 pacotes/exit 0 e 23 contratos/hash preservados; isso não executa Discord nem substitui a instalação da raiz.
3. Crie `.env` pelo bloco seguro anterior somente se ausente. Preserve a configuração já validada; em uma preparação nova, confirme o Application ID da mesma aplicação e deixe o convite vazio ou configure uma URL coerente com o contrato. Não altere credenciais por tentativa de diagnóstico.
4. Valide estrutura/configuração local sem rede ou impressão de valores:

   ```powershell
   & $nodeRuntime -e "try { require('dotenv').config(); require('./lib/config').readConfig(process.env); console.log('Configuracao local valida.'); } catch { console.error('Configuracao local invalida. Revise .env sem compartilhar valores.'); process.exitCode = 1; }"
   ```

5. Rode `& $nodeRuntime $npmCli test` e `& $nodeRuntime deploy-commands.js --dry-run`. O dry-run deve confirmar 23 comandos; não lê `.env`, não verifica token/identidade/permissões e não registra nada.
6. No Developer Portal, confira visualmente Application ID e bot correspondente ao token armazenado, sem gerar/rotacionar token. No servidor, confira a instalação existente, scopes `bot applications.commands`, cargos e sobrescritas dos canais de teste conforme a matriz. Não registre de novo só por reinstalar dependências ou mudar de máquina.
7. **Somente após autorização explícita para login local**, execute `& $nodeRuntime index.js` na raiz. Esse comando inicia conexão real. Não execute `--confirm-global-replacement` nesta preparação.
8. Confira mensagens sanitizadas de pronto/total e a resposta a `/ping`; siga o checklist abaixo. Em erro, anote somente classe operacional, momento aproximado, versão e resultado, sem token, `.env`, stack bruto, URL de webhook ou dump de interação.
9. Ao terminar a instância autorizada, use `Ctrl+C` no terminal e confira que o processo encerrou. Estado volátil se perde; não há recuperação de tarefas/timers/cooldowns após parar.
10. Para futura hospedagem gratuita, use os requisitos abaixo e valide as condições reais do provedor antes de publicar. A P3.2 não autoriza deploy, registro global, permissões remotas ou reinício de produção.

### Checklist da primeira validação real autorizada

- [ ] Confirmar que não há outra instância a ser interrompida/substituída e registrar commit/runtime e escopo da autorização, sem credenciais.
- [ ] Conferir o Application ID no Portal e o `client_id` do botão de `/invite` antes de autorizar qualquer instalação. O botão deve ter scopes `bot applications.commands` e `permissions=117824`; divergência deve produzir aviso privado sem link.
- [ ] Confirmar ready e `/ping`; conferir 23 comandos disponíveis e `/help`. Ausência remota de slash commands exige diagnóstico separado, sem registro automático.
- [ ] Testar `/docs` e uma seleção nova; menus antigos não são o contrato atual.
- [ ] Testar embeds, botões `/vote` e `/lofiradio`, PNG de `/qrcode`, um fallback de texto extenso e as reações de `/autor`, `/invite`, `/vote` e `/playlist`. Conferir identidade da página externa separadamente do convite.
- [ ] Testar `/timer set` com um minuto e confirmar o aviso no canal; testar `stop`. Se houver necessidade de threads/DM, testar esses contextos separadamente e conferir suas permissões/acesso.
- [ ] Testar `/todo` com conteúdo não sensível: privacidade, isolamento entre usuários/servidores/DM e remoção; testar `/ping` efêmero. Não usar dados pessoais nos testes.
- [ ] Testar os demais comandos locais e as seis integrações HTTP em entradas pequenas; registrar indisponibilidade/quota sem loops de retry. `/status` deve continuar recusando destinos proibidos.
- [ ] Conferir logs sanitizados; em ambiente controlado, verificar falhas de permissão/entrega sem conceder Administrator e sem duplicação de respostas. Qualquer mudança remota de permissão precisa do escopo autorizado.
- [ ] Encerrar com `Ctrl+C`, registrar resultados e limites em CURRENT/QUALITY_GATES; não declarar identidade, disponibilidade ou permissões integralmente validadas apenas pelo ready.

## Registrar slash commands — ação remota separada

O runtime **não registra comandos automaticamente**. O script [deploy-commands.js](../../deploy-commands.js) usa [registration.js](../../lib/registration.js) e o mesmo [catálogo validado](../../lib/command-catalog.js) do runtime. O modo de envio usa REST v10 com `PUT` em `Routes.applicationCommands(CLIENT_ID)`; esse endpoint sobrescreve o conjunto **global** da aplicação, podendo remover comandos ausentes no payload. [Contrato oficial do Discord](https://docs.discord.com/developers/interactions/application-commands#bulk-overwrite-global-application-commands).

Para conferir somente os arquivos locais, sem `.env`, token, login ou instância REST:

```powershell
node deploy-commands.js --dry-run
```

A CLI exige exatamente um argumento: `--dry-run` ou `--confirm-global-replacement`. Invocação sem argumento, desconhecido, duplicado ou combinação retorna código 1 antes de carregar ambiente ou enviar REST. O dry-run valida contratos, unicidade e snapshot do payload; falha de qualquer módulo bloqueia o catálogo inteiro. Não há seleção de comando individual ou registro por servidor.

Somente em tarefa com autorização explícita de registro, confira aplicação/token corretos, instalação completa, inventário pretendido e resultados offline; o envio exige:

```powershell
node deploy-commands.js --confirm-global-replacement
```

Esse modo carrega ambiente e revalida configuração/payload antes de criar REST. Usa timeout e AbortSignal de 15 s, `retries: 0` e rejeição de rate limit, sem retry automático do PUT. A API de envio também exige confirmação explícita. Falhas de configuração, catálogo ou REST retornam mensagens fixas e código 1, sem objetos de erro/credenciais; a instância REST tem limpeza local. Sucesso retorna 0 e confirma somente o pedido REST, sem garantir propagação imediata nos clientes. Não houve PUT real nesta tarefa. A flag é uma proteção operacional, sem substituir a autorização do responsável.

## Iniciar e interromper

Depois de preparar/configurar uma instância cuja execução esteja autorizada:

```powershell
node index.js
```

Não existe script `npm start` declarado; use a entrada explícita. O bootstrap carrega ambiente, valida TOKEN, CLIENT_ID quando presente, URLs configuradas e catálogo e só então cria o Client; os handlers são instalados antes do login, cujo prazo é 30 s. Falha registra mensagem fixa, define `exitCode = 1` e tenta limpar recursos da aplicação e destruir o Client em até 2 s. Um watchdog de 5 s após a falha, com `unref`, força saída de erro se ainda houver recursos ativos. Esse fluxo foi projetado para inicialização, sem reiniciar o bot automaticamente.

Em `ready`, o código registra somente texto fixo de pronto e total agregado validado de servidores, sem tag/nomes/IDs individuais, e mantém rotação de presença a cada 100 s. Esse é o comportamento esperado pelo fonte; o responsável relatou login e contagem pontual de 134 servidores, sem coleta de logs pelo assistente. A limpeza de inicialização remove eventos operacionais, intervalo de presença e timeouts de cooldown; preserva somente um handler fixo de erro para falhas tardias durante a destruição do SDK. Interrompa uma instância local interativa com `Ctrl+C` somente no escopo autorizado; serviços hospedados devem ser parados pelo supervisor autorizado.

Não há desligamento gracioso geral de SIGINT/SIGTERM. `timers.clearAll()` existe no manager, sem ligação automática ao encerramento do processo. Toda interrupção perde listas `/todo`, timers e cooldowns; essa perda é comportamento conhecido e aceito no [ADR 0003](decisions/0003-estado-operacional-temporario.md). Não se persistem ou restauram esses dados em banco, arquivo, snapshot ou replay. O processo precisa permanecer ativo para atender interações e disparar timers da sessão; não há servidor web para receber tráfego HTTP nem implementação de bot de voz.

### Estado e transição do /todo na P2.2

Reiniciar o bot apaga as tarefas. Não existe sincronização entre processos nem recuperação de tarefas após falha de hospedagem; cada instância nova começa vazia. O [ADR 0003](decisions/0003-estado-operacional-temporario.md) aceita essa volatilidade e proíbe persistência operacional em SQLite, Firebase, Firestore, Redis, qualquer outro banco ou arquivos locais. Persistência não é pendência técnica, e não se adicionam dependências/infraestrutura para esse fim. Mudar essa política exigiria nova decisão explícita que substitua o ADR 0003. Fontes, assets e configuração/credenciais continuam com os papéis atuais; não são backups de tarefas, timers ou cooldowns.

As listas da P2.2 são específicas do servidor+usuário ou DM+usuário; canais do mesmo servidor compartilham a lista privada daquele usuário, e DM não depende do canal. Todas as respostas/anexos são efêmeros. Os tetos de 100 tarefas e 64 KiB UTF-8 são somados entre todos os contextos do usuário, com 8 MiB/1024 usuários distintos por processo. Capacidade esgotada recusa inserções novas sem expulsar dados; remover libera bytes/contagens e entradas vazias.

A lista global de uma versão anterior não possui informação de servidor de origem, por isso não é copiada/mesclada automaticamente para novos contextos. A P2.2 alterou código local, sem reiniciar o bot ou ler/apagar seu estado real; a decisão documental do ADR 0003 preservou essa restrição. A P2.4 também não acessa tarefas ou reinicia o bot. O [ADR 0002](decisions/0002-privacidade-e-isolamento-do-todo.md) registra historicamente a recomendação de preservação manual privada de listas antigas importantes antes de uma transição autorizada. O ADR 0003 aceita deliberadamente a perda: isso não é obrigação de backup nem recurso de persistência/recuperação do bot. Não publique tarefas em logs, chat ou anexos públicos; não há migração em execução ou promessa de recuperar memória após reinício. Exportação de conteúdo sensível e reinício continuam dependendo de autorização própria.

Uma confirmação que falha pode ter sido entregue. A inserção/remoção local permanece e o helper não repete o envio; confira a lista no mesmo contexto antes de tentar novamente. Mensagens públicas antigas não são apagadas automaticamente pela nova visibilidade. R09 continua `MITIGATED`: privacidade/isolamento local permanecem protegidos e a volatilidade restante foi aceita deliberadamente.

## Diagnóstico

| Sintoma | Conferência e limitação |
| --- | --- |
| Node/npm sem versão ativa | Conferir `.nvmrc`, `Get-Command node,npm,nvm`, versões e `nvm list`. Separar instalação ausente de seleção do shim. Usar distribuição oficial independente verificada fora do alvo de `npm ci`, sem alterar padrão global. |
| npm bloqueado por NVM4306 | O shim recusou script delegado não confiável. Não execute esse script diretamente nem desative o firewall. Verifique integridade e política do NVM em reparo autorizado, ou prepare distribuição oficial independente verificada como acima. |
| INVITE_URL inválida / identidade divergente | Se esse erro ocorrer, deixar `INVITE_URL` vazia em editor seguro permite gerar o convite da aplicação atual; uma URL explícita precisa cumprir o contrato. Manter TOKEN/CLIENT_ID e confrontar a aplicação no Portal. O bloqueio da preparação anterior é histórico; a configuração foi posteriormente validada segundo o responsável. Nunca publicar URL/configuração para diagnosticar. Divergência durante `/invite` produz erro privado sem botão. |
| LOFIRADIO_URL inválida | Use o fallback deixando vazia ou configure HTTPS público conforme a tabela, sem query/fragmento/credenciais. A validação sintática não comprova disponibilidade real. |
| `Cannot find module 'prettier'` na inicialização/registro | Em commits anteriores à Fase 1, Prettier estava em devDependencies. Conferir manifest/lock atuais e instalação limpa; agora produção inclui Prettier, sem exigir `--include=dev`. Não copiar `node_modules` antigo como correção. |
| Configuração recusada ou bot não chega a `ready` | Ler somente a mensagem fixa: TOKEN ausente/evidentemente inválido é recusado antes do Client; falha real de login tem prazo de 30 s, cleanup e saída 1. Conferir segredo/aplicação e conectividade em ambiente autorizado, sem imprimir token. |
| Catálogo recusado ou comandos não carregam | Conferir instalação e contrato dos módulos e executar dry-run/testes offline. Catálogo vazio, duplicatas, falha de require/toJSON ou payload fora da política bloqueiam todo o carregamento antes de login/PUT. Não contornar removendo módulos sem revisar o conjunto global. |
| Registro bloqueado sem enviar nada | Sem argumento ou argumento inválido retorna 1; dry-run não envia. O modo confirmado exige TOKEN/CLIENT_ID válidos estruturalmente e catálogo aprovado. Falha/timeout/rate limit não repete PUT automaticamente. |
| Slash command ausente | Separar carregamento local de registro global/instalação OAuth. Confirmar aplicação e permissões; não rodar registro repetidamente como diagnóstico automático. |
| “A aplicação não respondeu” / interação desconhecida | P1.2 reconhece antes das operações demoradas. Conferir atraso de entrega/event loop/rede: o defer também pode falhar. Interações expiradas não são reenviadas; o prazo inicial continua 3 s e o token reconhecido vale 15 min desde a criação. [Contrato de respostas](https://docs.discord.com/developers/interactions/receiving-and-responding). |
| “InteractionAlreadyReplied” ou erro após sucesso aparente | P1.2 escolhe continuação por estado e não tenta novo envio após falha de entrega. Reações são secundárias e capturadas; erro inesperado após sucesso pode gerar follow-up conforme visibilidade já estabelecida. Não repetir manualmente uma operação sem conferir o efeito anterior. |
| Loading/placeholder neutro permanece após erro | Ramos privados após defer público concluem o loading sem conteúdo visível, enviam follow-up efêmero e removem o original. Falha intermediária pode manter esse placeholder; o helper não expõe o erro privado nem repete envio ambíguo. |
| Falha HTTP / resultado inesperado | Consultas têm prazo total 5 s e corpo até 1 MiB, JSON estrito e mensagens classificadas, sem erro/URL bruto. 403/429 não significam recurso inexistente. Pausa temporária retorna aviso imediato, sem fila/retry; `/http` aceita o status solicitado somente com corpo coerente. Conferir [auditoria](COMMANDS.md#contratos-externos--p24). |
| Limite temporário / quota esgotada | Respeitar o aviso e o intervalo antes de nova tentativa; pausas de HTTP/backoff existem só em memória e são compartilhadas no processo conforme serviço/método. Outros processos no mesmo IP podem consumir a quota. Não reiniciar para contornar limites, criar loop de tentativas ou trocar credenciais. Prazo do provedor desconhecido não vira promessa de retomada. |
| `/status` recusa um site público | P1.1 recusa DNS misto, faixas especiais, mapped/tradução IPv6, credenciais e redirects; usa somente o primeiro IP aprovado. Limites de 5 s/1 MiB/16 KiB também podem recusar sites online. Erros são genéricos e a saída omite caminho/query; não solicitar dumps com segredos como diagnóstico. |
| Falha no QR code | P2.1 gera PNG em Buffer sem escrita/cwd/temporários. Conferir capacidade por modo/Unicode e permissão para anexos. Geração falha recebe aviso privado; envio falho não é repetido e não abandona arquivo. Não se apagam resíduos de versões antigas automaticamente. |
| Conteúdo extenso ou capacidade todo atingida | Resultados extensos seguem completos em anexo (até 1 MiB UTF-8). Todo usa resposta/anexo efêmero; 100 itens/64 KiB são agregados por usuário entre servidores e DM, com 8 MiB/1024 usuários distintos globais. Recusa só novas inserções; remover libera capacidade sem expulsão silenciosa. Ver [limites](COMMANDS.md). HTTP acima de 1 MiB é recusado antes do parse, mantendo erro sanitizado e 5 s. |
| Anexos/reação não enviados | Conferir permissões e presença de `images/lofiradio.jpeg` e `images/lofiicon.png`. |
| Lista `/todo` ausente em outro servidor/DM | P2.2 isola servidor+usuário de cada outro servidor e da lista DM+usuário. Consulte no contexto de criação; não há transferência implícita. Canal diferente do mesmo servidor usa a mesma lista privada. Contexto inválido é recusado sem fallback global/DM; não há backup restaurável. |
| Timer substituído, ausente ou aviso não chegou | Aceita 1–1440 minutos inteiros. Um timer por usuário+servidor; DM por usuário+canal. Outro `set` no mesmo servidor substitui e usa o novo canal; `stop` de outro escopo não cancela. Expiração remove estado antes do envio, que não tem retry. Conferir canal/permissões; envio já iniciado não é cancelado retroativamente. Reinício perde timers. |
| Confirmação de início/cancelamento do timer falhou | O efeito local é mantido porque a resposta pode ter chegado ao Discord; não há rollback automático. Conferir o contexto antes de repetir, pois um novo set pode substituir o timer ativo. |

## Política de logs e retenção — P3.1

A aplicação escreve somente diagnósticos curtos por console através de [safeLog](../../lib/logging.js), sem arquivos de log, buffer persistente, monitoramento externo ou dependência nova. Mensagens são fixas; dados variáveis se limitam às contagens agregadas validadas de servidores ou comandos. ready confirma login e total; guildCreate registra o evento e total, sem nome/ID/memberCount individual, tag do bot ou data/hora detalhada. [Inventário antes/depois](ARCHITECTURE.md#logs-e-diagnósticos--p31).

- Não registrar TOKEN, CLIENT_ID como valor, cookies, headers de autenticação, URLs completas de requisição/query, corpo de API, Error/stack bruto ou dump de interação.
- Não registrar conteúdo de mensagens, tarefas do todo, texto de tradução, IDs/nomes de usuários/canais/servidores ou dados externos arbitrários. Não usar logs como arquivo alternativo do estado volátil do ADR 0003.
- Ao adicionar um diagnóstico, escolher log/warn/error e mensagem fixa ou contagem inteira segura não negativa. safeLog admite uma string de até 500 unidades UTF-16, Unicode bem formado e sem controles ASCII/DEL; rejeita objetos sem convertê-los. Ele não redige automaticamente segredos em uma string arbitrária.
- Falha de método/getter/logger e rejeição assíncrona são descartadas sem await, retry ou fallback recursivo. Um diagnóstico pode se perder; a falha não deve mudar código de saída, impedir cleanup/presença/resposta ou repetir operação já aplicada.
- Para compartilhar diagnóstico, usar somente o trecho mínimo sanitizado necessário e conferir a ausência de dados sensíveis antes do envio. Esta tarefa não autorizou compartilhamento de logs com terceiros.

**Retenção externa:** stdout/stderr podem ser capturados pela plataforma de hospedagem; nenhum provedor/configuração atual foi identificado. O código não controla prazo de retenção, réplicas/backups, acesso ou eliminação desses registros. Em tarefa operacional autorizada, o responsável deve identificar o destino, verificar quem pode consultar/exportar, definir e conferir retenção/eliminação proporcionais à manutenção e revisar eventuais logs históricos que já contenham dados individuais. Não se declara prazo, garantia de exclusão ou política de um provedor desconhecido; não se consultou/apagou histórico nem se alterou hospedagem nesta entrega.

R17 fica **MITIGATED**: as exposições locais foram removidas, mas captura, acesso e retenção/histórico externos continuam NOT_CONFIRMED. O funcionamento real relatado pelo responsável não incluiu coleta ou auditoria desses logs. Os fluxos testados e limitações estão em [QUALITY_GATES](QUALITY_GATES.md). O escopo não adiciona handlers globais de exceção nem garante sanitização de logs do Node, dependências ou plataforma fora dos pontos da aplicação auditados.

## Preparação para futura hospedagem

Não foi identificado provedor atual ou configuração de Docker, PM2, systemd, CI/CD ou serviço gerenciado. **Não há deploy aprovado ou realizado.** Como proposta técnica: um processo Node persistente com saída HTTPS/WebSocket para Discord/APIs, cwd na raiz, dependências completas, assets presentes, segredo injetado, memória para Buffers QR/texto e logs com retenção/acesso definidos.

Para uma oferta gratuita, confirmar suporte a **processo Node 24 de longa duração**, WebSocket de saída, variáveis secretas, instalação por lockfile, assets e limites de CPU/memória/rede. Uma plataforma apenas estática, uma função curta ou um plano que suspende processos não garante atendimento contínuo nem timers; não foi criado servidor HTTP ou mecanismo artificial de keep-alive. Preferir uma instância para o modelo atual; réplicas têm memórias independentes. Não há requisito de disco durável/banco. Preço, franquia, suspensão e disponibilidade do provedor precisam de verificação na futura escolha; nenhum provedor gratuito foi selecionado ou prometido nesta entrega.

Runtime LTS, instalações limpas normal/produção e contratos offline foram validados em P0/P1.1 e novamente nos escopos da P2.4/P3.2; os gates em [QUALITY_GATES](QUALITY_GATES.md) verificam o checkout, sem autenticar credenciais ou auditar permissões remotas. O relato atual confirma funcionamento manual na instância do responsável, sem demonstrar operação numa hospedagem gratuita. Escopo/privacidade de `/todo` vêm da P2.2; o ADR 0003 aceita volatilidade e elimina persistência/retenção de estado como requisito de hospedagem. Não se exige banco, disco durável, serviço externo ou nova infraestrutura de persistência. Avaliação de encerramento geral, controle de recursos e validação de hospedagem continuam propostas separadas; supervisor/rollback não foram implementados ou autorizados aqui. Rede, roteamento, disponibilidade e compatibilidade efetiva de um provedor gratuito continuam `NOT_CONFIRMED`. Múltiplas réplicas/shards têm estados independentes, sem sincronização; a arquitetura atual é um único cliente/processo com memória local, não uma proposta de armazenamento compartilhado.

## Recuperar após perda de máquina ou hospedagem

1. Obter uma cópia íntegra do repositório e selecionar branch/commit pretendidos. O cérebro está na `develop`; exemplo em máquina nova: `git clone --branch develop https://github.com/emanuelsacoman/Bot-Estudos-Discord.git`; entrar na pasta e conferir `git status`/`git log -1`. Neste fechamento, a comparação GitHub confirmou a preparação P3.3 commitada e enviada em `6478dab`, idêntica à `develop` remota (ahead 0 / behind 0). Uma clonagem dessa revisão inclui a preparação P3.3, mas ainda não este fechamento local posterior; a clonagem e o merge para main não foram executados nesta tarefa.
2. Ler [AGENTS](../../AGENTS.md), [CURRENT](CURRENT.md), [estado](PROJECT_STATE.md) e este procedimento. Restaurar alterações/documentos que tenham sido salvos em backup mas ainda não estejam no Git.
3. Preparar Node da `.nvmrc` (24.22.2) e npm correspondente (11.19.1); instalar com o lock via `npm ci --engine-strict`, ou `npm ci --omit=dev --engine-strict` em produção, em checkout novo com os manifests desta fase. Conservar `commands/`, `lib/`, testes e os três assets versionados.
4. Recuperar `TOKEN` de armazenamento seguro autorizado e o Application ID da aplicação existente. O token não está no Git e não pode ser reconstruído pelo `.env.example`. Se não houver acesso ao segredo/conta, a recuperação depende do responsável; rotação de credenciais é ação separada e não foi autorizada nesta auditoria.
5. Configurar `.env` ou variáveis injetadas; conferir convite e URLs públicas. Não assumir que recriar a aplicação preserva identidade, instalações e votos.
6. Executar os gates offline e, se necessário, `node deploy-commands.js --dry-run` para conferir o catálogo sem credenciais/rede. O registro global já existente no Discord não depende do processo antigo: não registre novamente só porque mudou a máquina. Registrar somente se o conjunto remoto precisar mudar e houver autorização explícita para o modo confirmado.
7. Em instância autorizada, iniciar `node index.js`, conferir `ready` e testar `/ping`, `/help`, menu `/docs`, anexos, reações e comandos HTTP num ambiente controlado. Registrar versão, commit, resultados e limitações; não declarar recuperação concluída só pelo log inicial.
8. Listas/timers/cooldowns/pausas de APIs anteriores não são recuperáveis do Git: não há armazenamento persistente. A nova instância começa vazia e a perda é aceita pelo ADR 0003; não é falha de restauração ou pendência para introduzir persistência. Registrar a reinicialização/perda conhecida e atualizar [CURRENT](CURRENT.md) quando uma operação real autorizada acontecer.

Este runbook recupera a aplicação e seus acessos, não o estado temporário das sessões. O responsável relatou configuração validada, login e funcionamento dos 23 comandos; uma recuperação integral após perda da máquina ou hospedagem não foi demonstrada. Backups de segredos, conta Discord e infraestrutura atual são `NOT_CONFIRMED`; cópia do código não substitui esses acessos. A política de estado em memória não altera credenciais nem autoriza exportação de tarefas ou reinícios.
