# Operação e recuperação

Atualizado na decisão documental **Estado Temporário, 2026-11-07**, base `develop/868774b` (P2.2 já commitada). P0–P2.2 têm evidências históricas em [QUALITY_GATES](QUALITY_GATES.md). O [ADR 0003](decisions/0003-estado-operacional-temporario.md) mantém todo estado operacional em memória e aceita sua perda após reinícios, priorizando simplicidade e compatibilidade com hospedagens gratuitas. Não há mudança de código, dependências ou infraestrutura nesta decisão. Node 24.22.2/npm 11.19.1; login/PUT reais, hospedagem e recuperação operacional do bot continuam `NOT_CONFIRMED`. Os exemplos usam PowerShell a partir da raiz.

## Preparar Node.js e dependências

O runtime de referência é **Node 24.22.2 LTS (Krypton)**, com **npm 11.19.1** da distribuição oficial. [.nvmrc](../../.nvmrc) fixa o patch reproduzível; `engines.node: "24.x"` no manifest/lock expressa a linha suportada pelo projeto, sem aceitar automaticamente novos majors. Isso é uma política do projeto: o mínimo legado do lock continua >=18.17, mas Node 18/20 estão EOL. Node 24 está em Maintenance LTS, com fim de suporte previsto para 2028-04-30. Fontes consultadas em 2026-11-07: [distribuições oficiais](https://nodejs.org/dist/index.json) e [calendário oficial](https://github.com/nodejs/Release/blob/main/schedule.json).

Em máquina nova, instale a versão da `.nvmrc` pelo instalador/ZIP oficial ou gerenciador adequado e confira as versões abaixo. `.nvmrc` é uma referência, não instala Node nem garante ativação em todos os gerenciadores. `engines` também não instala o runtime; use `--engine-strict` para detectar incompatibilidade na instalação.

```powershell
node --version
npm --version
```

### Recuperação local sem alterar configuração global

O ambiente Windows possui NVM `2.0.1-hotfix.6`, em modo shim: o PATH aponta para proxies em `.nodejs`, que é uma junction para `.shim`. Só Node 20.20.0 estava instalado, com padrão `vnone`, `auto_use=true` e `auto_install=false`. Portanto não havia uma versão instalada/selecionada correspondente ao projeto. O `--local` de `nvm use` desse gerenciador seleciona versões locais e pode alterar o padrão; não significa ativação só na sessão. Nenhuma alteração de padrão, Registro ou PATH persistente foi feita.

Na Fase 1 foi baixado o ZIP Windows x64 **Node 24.22.2** de `nodejs.org`, com SHA-256 conferido contra `SHASUMS256.txt` oficial, e extraído em `node_modules/.codebucket-p0/runtime/node-v24.22.2-win-x64`. Runtime, caches e cópias de teste são locais e ignorados pelo Git; não substituem uma instalação gerenciada em outra máquina. A área fica dentro do `node_modules` original, preservado nesta fase: **não execute `npm ci` na raiz usando esse binário**, pois o comando remove o diretório que o contém. Para instalar na raiz, use um runtime instalado fora do `node_modules` alvo.

Para conferir o runtime portátil existente sem acionar o shim:

```powershell
$runtimeRoot = Join-Path (Get-Location).Path 'node_modules/.codebucket-p0/runtime/node-v24.22.2-win-x64'
$nodeRuntime = Join-Path $runtimeRoot 'node.exe'
$npmCli = Join-Path $runtimeRoot 'node_modules/npm/bin/npm-cli.js'
& $nodeRuntime --version
& $nodeRuntime --preserve-symlinks --preserve-symlinks-main $npmCli --version
```

O sandbox encontrou `EPERM ... lstat` em ancestral na auditoria inicial. Foram mantidas as flags `--preserve-symlinks --preserve-symlinks-main` nos checks para contornar resolução de caminhos; não são requisito de hospedagem. Quando necessário para filhos do npm, PATH e `NODE_OPTIONS` foram definidos somente no processo PowerShell do teste. Não foram modificadas variáveis persistentes nem o NVM global.

### Instalação reproduzível

Com Node 24.22.2/npm 11.19.1 disponíveis **fora do diretório a ser recriado**, use checkout novo e preserve o lock:

```powershell
npm ci --engine-strict
```

Para instalação de produção, em **outra cópia limpa**:

```powershell
npm ci --omit=dev --engine-strict
```

As duas variantes foram executadas com sucesso na Fase 1, cada uma instalando 85 pacotes. Prettier `^3.5.3` agora está em `dependencies`, mantendo a versão travada `3.5.3`; a omissão de dev não remove mais o pacote requerido por [formatar.js](../../commands/formatar.js). Os outros pacotes não foram atualizados/removidos. `node-fetch` sem uso encontrado e importação transitiva de `@discordjs/builders` foram registrados para manutenção posterior, sem mudanças nesta fase.

Os testes usaram diretórios inicialmente sem `node_modules`/`.env`: `node_modules/.codebucket-p0/ci-development` e `ci-production`, com cópias somente de fontes, assets, manifests, `.nvmrc` e `.env.example`. O npm recebeu `--prefix` apontando para cada cópia, caches distintos inicialmente vazios, userconfig/globalconfig vazios distintos, `--engine-strict --no-audit --no-fund --logs-max=0 --update-notifier=false` e registry público npm. Produção usou `NODE_ENV=production` e `--omit=dev`; desenvolvimento usou `NODE_ENV=development`. Nenhum pacote/credencial da instalação antiga foi usado para completar as cópias.

`npm ci` recria o `node_modules` do alvo: não aplique na instalação existente sem preparar o ambiente e preservar alterações locais pertinentes. Não remova/atualize o lock para contornar erros. [Comportamento oficial de npm ci](https://docs.npmjs.com/cli/v11/commands/npm-ci).

Em P1.1, as duas variantes passaram novamente em `node_modules/.codebucket-p1/ci-development` e `ci-production`, com `--offline` e os caches P0 já preenchidos. `npm test` executa a suíte offline sem precisar de `.env`; P1.3 acrescenta casos de configuração, inicialização, registro e timers. Instruções/resultados em [qualidade](QUALITY_GATES.md). Distribua todo `lib/`: runtime, comandos e registro dependem dos módulos locais de configuração, catálogo, ciclo de vida, respostas, HTTP e timers. P1.2/P1.3/P2.1 não adicionam dependências. P2.1 acrescenta content-limits/todo-store e amplia o helper HTTP; distribua todos os helpers. QR e fallbacks de texto não exigem diretório gravável.

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
| `CLIENT_ID` | Obrigatória somente para registro confirmado. Application ID da mesma aplicação do token; identificador público. | String decimal de 17–20 dígitos, sem zero inicial e até o máximo de uint64. Define `Routes.applicationCommands(CLIENT_ID)`; o login do runtime não a exige. |
| `INVITE_URL` | Opcional, URL OAuth pública completa da aplicação pretendida. | Ausente/vazia usa fallback com ID fixo `1193011045577523300`, `permissions=0` e scopes `bot applications.commands`; não deriva de CLIENT_ID. |
| `LOFIRADIO_URL` | Opcional, URL pública válida HTTP(S). | Ausente/vazia usa `https://lofiradio.web.app`; apenas gera link/embed/botão. |

Essas são **as quatro variáveis de configuração da aplicação**; não há `GUILD_ID` nem chaves de APIs externas implementadas. `NODE_ENV` e configurações de ferramentas não são contratos da aplicação. A presença de valores locais foi registrada na auditoria inicial, sem comprovar validade. A validação P1.3 é estrutural e conservadora: não decodifica token, não prova associação TOKEN/CLIENT_ID, permissões ou existência remota da aplicação.

O Client solicita somente `GatewayIntentBits.Guilds`. Não há necessidade demonstrada pelo código de ativar intents privilegiadas para mensagens/membros. Confira a instalação OAuth da aplicação com scopes `bot` e `applications.commands`, acesso ao canal e permissões dos recursos usados: ver canal, enviar mensagens, embeds, anexar arquivos e adicionar reações; leitura do histórico pode ser necessária para reações. Não conceda Administrator como substituto dessa conferência. As permissões efetivas não foram consultadas.

O fallback `permissions=0` não garante esses recursos em todos os canais. A recuperação de uma aplicação própria exige revisar a URL de convite e os IDs fixos de top.gg/presença, em tarefa autorizada; não copie o token de outra aplicação.

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

Não existe script `npm start` declarado; use a entrada explícita. O bootstrap carrega ambiente, valida TOKEN e catálogo e só então cria o Client; os handlers são instalados antes do login, cujo prazo é 30 s. Falha registra mensagem fixa, define `exitCode = 1` e tenta limpar recursos da aplicação e destruir o Client em até 2 s. Um watchdog de 5 s após a falha, com `unref`, força saída de erro se ainda houver recursos ativos. Esse fluxo foi projetado para inicialização, sem reiniciar o bot automaticamente.

Em `ready`, o código mantém logs de usuário/servidores e rotação de presença a cada 100 s. Isso é comportamento esperado pelo fonte, sem login remoto comprovado. A limpeza de inicialização remove eventos operacionais, intervalo de presença e timeouts de cooldown; preserva somente um handler fixo de erro para falhas tardias durante a destruição do SDK. Interrompa uma instância local interativa com `Ctrl+C`; serviços hospedados devem ser parados pelo supervisor autorizado.

Não há desligamento gracioso geral de SIGINT/SIGTERM. `timers.clearAll()` existe no manager, sem ligação automática ao encerramento do processo. Toda interrupção perde listas `/todo`, timers e cooldowns; essa perda é comportamento conhecido e aceito no [ADR 0003](decisions/0003-estado-operacional-temporario.md). Não se persistem ou restauram esses dados em banco, arquivo, snapshot ou replay. O processo precisa permanecer ativo para atender interações e disparar timers da sessão; não há servidor web para receber tráfego HTTP nem implementação de bot de voz.

### Estado e transição do /todo na P2.2

Reiniciar o bot apaga as tarefas. Não existe sincronização entre processos nem recuperação de tarefas após falha de hospedagem; cada instância nova começa vazia. O [ADR 0003](decisions/0003-estado-operacional-temporario.md) aceita essa volatilidade e proíbe persistência operacional em SQLite, Firebase, Firestore, Redis, qualquer outro banco ou arquivos locais. Persistência não é pendência técnica, e não se adicionam dependências/infraestrutura para esse fim. Mudar essa política exigiria nova decisão explícita que substitua o ADR 0003. Fontes, assets e configuração/credenciais continuam com os papéis atuais; não são backups de tarefas, timers ou cooldowns.

As listas da P2.2 são específicas do servidor+usuário ou DM+usuário; canais do mesmo servidor compartilham a lista privada daquele usuário, e DM não depende do canal. Todas as respostas/anexos são efêmeros. Os tetos de 100 tarefas e 64 KiB UTF-8 são somados entre todos os contextos do usuário, com 8 MiB/1024 usuários distintos por processo. Capacidade esgotada recusa inserções novas sem expulsar dados; remover libera bytes/contagens e entradas vazias.

A lista global de uma versão anterior não possui informação de servidor de origem, por isso não é copiada/mesclada automaticamente para novos contextos. A P2.2 alterou código local, sem reiniciar o bot ou ler/apagar seu estado real; a atual decisão muda somente documentação. O [ADR 0002](decisions/0002-privacidade-e-isolamento-do-todo.md) registra historicamente a recomendação de preservação manual privada de listas antigas importantes antes de uma transição autorizada. O ADR 0003 aceita deliberadamente a perda: isso não é obrigação de backup nem recurso de persistência/recuperação do bot. Não publique tarefas em logs, chat ou anexos públicos; não há migração em execução ou promessa de recuperar memória após reinício. Exportação de conteúdo sensível e reinício continuam dependendo de autorização própria.

Uma confirmação que falha pode ter sido entregue. A inserção/remoção local permanece e o helper não repete o envio; confira a lista no mesmo contexto antes de tentar novamente. Mensagens públicas antigas não são apagadas automaticamente pela nova visibilidade. R09 continua `MITIGATED`: privacidade/isolamento local permanecem protegidos e a volatilidade restante foi aceita deliberadamente.

## Diagnóstico

| Sintoma | Conferência e limitação |
| --- | --- |
| Node/npm sem versão ativa | Conferir versão da `.nvmrc`, localização do runtime e shim NVM. Usar binário portátil explícito fora do `node_modules` alvo ou preparar gerenciador em tarefa apropriada; não foi definido padrão global nesta fase. |
| `Cannot find module 'prettier'` na inicialização/registro | Em commits anteriores à Fase 1, Prettier estava em devDependencies. Conferir manifest/lock atuais e instalação limpa; agora produção inclui Prettier, sem exigir `--include=dev`. Não copiar `node_modules` antigo como correção. |
| Configuração recusada ou bot não chega a `ready` | Ler somente a mensagem fixa: TOKEN ausente/evidentemente inválido é recusado antes do Client; falha real de login tem prazo de 30 s, cleanup e saída 1. Conferir segredo/aplicação e conectividade em ambiente autorizado, sem imprimir token. |
| Catálogo recusado ou comandos não carregam | Conferir instalação e contrato dos módulos e executar dry-run/testes offline. Catálogo vazio, duplicatas, falha de require/toJSON ou payload fora da política bloqueiam todo o carregamento antes de login/PUT. Não contornar removendo módulos sem revisar o conjunto global. |
| Registro bloqueado sem enviar nada | Sem argumento ou argumento inválido retorna 1; dry-run não envia. O modo confirmado exige TOKEN/CLIENT_ID válidos estruturalmente e catálogo aprovado. Falha/timeout/rate limit não repete PUT automaticamente. |
| Slash command ausente | Separar carregamento local de registro global/instalação OAuth. Confirmar aplicação e permissões; não rodar registro repetidamente como diagnóstico automático. |
| “A aplicação não respondeu” / interação desconhecida | P1.2 reconhece antes das operações demoradas. Conferir atraso de entrega/event loop/rede: o defer também pode falhar. Interações expiradas não são reenviadas; o prazo inicial continua 3 s e o token reconhecido vale 15 min desde a criação. [Contrato de respostas](https://docs.discord.com/developers/interactions/receiving-and-responding). |
| “InteractionAlreadyReplied” ou erro após sucesso aparente | P1.2 escolhe continuação por estado e não tenta novo envio após falha de entrega. Reações são secundárias e capturadas; erro inesperado após sucesso pode gerar follow-up conforme visibilidade já estabelecida. Não repetir manualmente uma operação sem conferir o efeito anterior. |
| Loading/placeholder neutro permanece após erro | Ramos privados após defer público concluem o loading sem conteúdo visível, enviam follow-up efêmero e removem o original. Falha intermediária pode manter esse placeholder; o helper não expõe o erro privado nem repete envio ambíguo. |
| Falha HTTP / resultado inesperado | Consultas têm prazo de 5 s, incluindo JSON do fetch; erros de consulta mantêm mensagens/visibilidade e falhas de envio são separadas. `/github` ainda mapeia não 200 para inexistente; `/status` pode chamar 3xx/4xx/5xx de offline. Schemas/quota/backoff continuam limitados. |
| `/status` recusa um site público | P1.1 recusa DNS misto, faixas especiais, mapped/tradução IPv6, credenciais e redirects; usa somente o primeiro IP aprovado. Limites de 5 s/1 MiB/16 KiB também podem recusar sites online. Erros são genéricos e a saída omite caminho/query; não solicitar dumps com segredos como diagnóstico. |
| Falha no QR code | P2.1 gera PNG em Buffer sem escrita/cwd/temporários. Conferir capacidade por modo/Unicode e permissão para anexos. Geração falha recebe aviso privado; envio falho não é repetido e não abandona arquivo. Não se apagam resíduos de versões antigas automaticamente. |
| Conteúdo extenso ou capacidade todo atingida | Resultados extensos seguem completos em anexo (até 1 MiB UTF-8). Todo usa resposta/anexo efêmero; 100 itens/64 KiB são agregados por usuário entre servidores e DM, com 8 MiB/1024 usuários distintos globais. Recusa só novas inserções; remover libera capacidade sem expulsão silenciosa. Ver [limites](COMMANDS.md). HTTP acima de 1 MiB é recusado antes do parse, mantendo erro sanitizado e 5 s. |
| Anexos/reação não enviados | Conferir permissões e presença de `images/lofiradio.jpeg` e `images/lofiicon.png`. |
| Lista `/todo` ausente em outro servidor/DM | P2.2 isola servidor+usuário de cada outro servidor e da lista DM+usuário. Consulte no contexto de criação; não há transferência implícita. Canal diferente do mesmo servidor usa a mesma lista privada. Contexto inválido é recusado sem fallback global/DM; não há backup restaurável. |
| Timer substituído, ausente ou aviso não chegou | Aceita 1–1440 minutos inteiros. Um timer por usuário+servidor; DM por usuário+canal. Outro `set` no mesmo servidor substitui e usa o novo canal; `stop` de outro escopo não cancela. Expiração remove estado antes do envio, que não tem retry. Conferir canal/permissões; envio já iniciado não é cancelado retroativamente. Reinício perde timers. |
| Confirmação de início/cancelamento do timer falhou | O efeito local é mantido porque a resposta pode ter chegado ao Discord; não há rollback automático. Conferir o contexto antes de repetir, pois um novo set pode substituir o timer ativo. |

P1.2 usa logs fixos para falhas de interação/secundárias e não imprime erros HTTP brutos. P1.3 usa mensagens sanitizadas também para configuração, inicialização, catálogo, registro e aviso do timer. Logs de ready ainda incluem servidores; acesso/retenção continuam pendentes. Compartilhe somente trechos sanitizados. Veja [riscos](KNOWN_RISKS.md).

## Preparação para futura hospedagem

Não foi identificado provedor atual ou configuração de Docker, PM2, systemd, CI/CD ou serviço gerenciado. **Não há deploy aprovado ou realizado.** Como proposta técnica: um processo Node persistente com saída HTTPS/WebSocket para Discord/APIs, cwd na raiz, dependências completas, assets presentes, segredo injetado, memória para Buffers QR/texto e logs com retenção/acesso definidos.

Runtime LTS, instalações limpas normal/produção e contratos offline foram validados em P0/P1.1; correções posteriores têm escopos locais em [QUALITY_GATES](QUALITY_GATES.md), sem certificar credenciais, login, permissões ou registro reais. Escopo/privacidade de `/todo` vêm da P2.2; o ADR 0003 aceita volatilidade e elimina persistência/retenção de estado como requisito de hospedagem. Não se exige banco, disco durável, serviço externo ou nova infraestrutura de persistência. Avaliação de encerramento geral, controle de recursos e validação operacional continuam propostas separadas; supervisor/rollback não foram implementados ou autorizados aqui. Rede, roteamento, disponibilidade e compatibilidade efetiva de um provedor gratuito continuam `NOT_CONFIRMED`. Múltiplas réplicas/shards têm estados independentes, sem sincronização; a arquitetura atual é um único cliente/processo com memória local, não uma proposta de armazenamento compartilhado.

## Recuperar após perda de máquina ou hospedagem

1. Obter uma cópia íntegra do repositório e selecionar branch/commit pretendidos. O cérebro está na `develop`; exemplo em máquina nova: `git clone --branch develop https://github.com/emanuelsacoman/Bot-Estudos-Discord.git`; entrar na pasta e conferir `git status`/`git log -1`. O acesso remoto de clonagem não foi testado nesta fase; P2.2 está commitada em `868774b` e as alterações documentais de Estado Temporário ainda estão sem commit.
2. Ler [AGENTS](../../AGENTS.md), [CURRENT](CURRENT.md), [estado](PROJECT_STATE.md) e este procedimento. Restaurar alterações/documentos que tenham sido salvos em backup mas ainda não estejam no Git.
3. Preparar Node da `.nvmrc` (24.22.2) e npm correspondente (11.19.1); instalar com o lock via `npm ci --engine-strict`, ou `npm ci --omit=dev --engine-strict` em produção, em checkout novo com os manifests desta fase. Conservar `commands/`, `lib/`, testes e os três assets versionados.
4. Recuperar `TOKEN` de armazenamento seguro autorizado e o Application ID da aplicação existente. O token não está no Git e não pode ser reconstruído pelo `.env.example`. Se não houver acesso ao segredo/conta, a recuperação depende do responsável; rotação de credenciais é ação separada e não foi autorizada nesta auditoria.
5. Configurar `.env` ou variáveis injetadas; conferir convite e URLs públicas. Não assumir que recriar a aplicação preserva identidade, instalações e votos.
6. Executar os gates offline e, se necessário, `node deploy-commands.js --dry-run` para conferir o catálogo sem credenciais/rede. O registro global já existente no Discord não depende do processo antigo: não registre novamente só porque mudou a máquina. Registrar somente se o conjunto remoto precisar mudar e houver autorização explícita para o modo confirmado.
7. Em instância autorizada, iniciar `node index.js`, conferir `ready` e testar `/ping`, `/help`, menu `/docs`, anexos, reações e comandos HTTP num ambiente controlado. Registrar versão, commit, resultados e limitações; não declarar recuperação concluída só pelo log inicial.
8. Listas/timers/cooldowns anteriores não são recuperáveis do Git: não há armazenamento persistente. A nova instância começa vazia e a perda é aceita pelo ADR 0003; não é falha de restauração ou pendência para introduzir persistência. Registrar a reinicialização/perda conhecida e atualizar [CURRENT](CURRENT.md) quando uma operação real autorizada acontecer.

Este runbook recupera a aplicação e seus acessos, não o estado temporário das sessões. Nunca foi exercitado integralmente. Backups de segredos, conta Discord e infraestrutura atual são `NOT_CONFIRMED`; cópia do código não substitui esses acessos. A política de estado em memória não altera credenciais nem autoriza exportação de tarefas ou reinícios.
