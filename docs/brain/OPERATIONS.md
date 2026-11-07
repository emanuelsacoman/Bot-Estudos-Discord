# Operação e recuperação

Atualizado na **P1.2, 2026-11-07**, base `develop` / `234f01b` (P1.1 já commitada). Instalações limpas normal/produção foram executadas em P0/P1.1; P1.2 validou interações e prazos HTTP offline com a instalação existente, sem alterar manifest/lock. Node 24.22.2/npm 11.19.1; alterações P1.2 sem commit. Login, registro, hospedagem e recuperação integral continuam apenas documentados, sem execução. Veja [QUALITY_GATES](QUALITY_GATES.md). Os exemplos usam PowerShell, a partir da raiz.

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

Em P1.1, as duas variantes passaram novamente em `node_modules/.codebucket-p1/ci-development` e `ci-production`, com `--offline` e os caches P0 já preenchidos. `npm test` executa a suíte offline de SSRF, contratos, interações, HTTP e operações secundárias, sem precisar de `.env`; instruções para o runtime portátil em [qualidade](QUALITY_GATES.md). Distribua todo `lib/`: os comandos importam os helpers de resposta, prazo HTTP e SSRF durante o carregamento. P1.2 não adiciona dependências.

## Configurar ambiente e autenticação

Os dois pontos de entrada chamam `dotenv.config()` sem caminho explícito: execute a partir da raiz, pois o `.env` é buscado no diretório de trabalho. Variáveis já injetadas no processo prevalecem sobre as do arquivo pelo comportamento padrão do dotenv instalado.

Crie `.env` a partir do exemplo somente se ainda não existir:

```powershell
if (-not (Test-Path -LiteralPath .env)) {
    Copy-Item -LiteralPath .env.example -Destination .env
}
```

Preencha os valores localmente em editor seguro ou injete-os pelo gerenciador de segredos da hospedagem; não os inclua em logs, terminal compartilhado ou commits.

| Variável | Necessidade e origem | Comportamento existente |
| --- | --- | --- |
| `TOKEN` | Obrigatória para login e registro. Token do bot no Discord Developer Portal. | [index.js](../../index.js) passa a `client.login`; [deploy-commands.js](../../deploy-commands.js) autentica REST. Sem validação prévia. |
| `CLIENT_ID` | Obrigatória somente para registrar comandos. Application ID da mesma aplicação do token. É identificador público. | Define a aplicação de `Routes.applicationCommands(CLIENT_ID)`; não é lida pelo runtime. |
| `INVITE_URL` | Opcional, URL OAuth pública completa da aplicação pretendida. | Ausente/vazia usa fallback com ID fixo `1193011045577523300`, `permissions=0` e scopes `bot applications.commands`; não deriva de CLIENT_ID. |
| `LOFIRADIO_URL` | Opcional, URL pública válida HTTP(S). | Ausente/vazia usa `https://lofiradio.web.app`; apenas gera link/embed/botão. |

Essas são **todas as quatro variáveis encontradas nas referências `process.env` da aplicação**, inclusive desestruturações; não há `GUILD_ID` nem chaves de APIs externas implementadas. `NODE_ENV` e outras configurações de ferramentas não são contratos de configuração da aplicação. O `.env` local continha as quatro chaves com valores não vazios, sem confirmar sua validade.

O Client solicita somente `GatewayIntentBits.Guilds`. Não há necessidade demonstrada pelo código de ativar intents privilegiadas para mensagens/membros. Confira a instalação OAuth da aplicação com scopes `bot` e `applications.commands`, acesso ao canal e permissões dos recursos usados: ver canal, enviar mensagens, embeds, anexar arquivos e adicionar reações; leitura do histórico pode ser necessária para reações. Não conceda Administrator como substituto dessa conferência. As permissões efetivas não foram consultadas.

O fallback `permissions=0` não garante esses recursos em todos os canais. A recuperação de uma aplicação própria exige revisar a URL de convite e os IDs fixos de top.gg/presença, em tarefa autorizada; não copie o token de outra aplicação.

## Registrar slash commands — ação remota separada

O runtime **não registra comandos automaticamente**. O script [deploy-commands.js](../../deploy-commands.js) carrega todos os 23 módulos, serializa `data.toJSON()` e usa REST v10 com `PUT` em `Routes.applicationCommands(CLIENT_ID)`. Esse endpoint sobrescreve o conjunto **global** da aplicação, podendo remover comandos que não estejam no payload. [Contrato oficial do Discord](https://docs.discord.com/developers/interactions/application-commands#bulk-overwrite-global-application-commands).

Somente em tarefa com autorização explícita de registro, confira aplicação/token corretos, instalação das dependências completas, inventário pretendido e resultados offline; então:

```powershell
node deploy-commands.js
```

Esse script não oferece modo dry-run nem registro por servidor. Não use uma aplicação compartilhada como ambiente de teste. A mensagem de sucesso informa conclusão do pedido REST; não comprova disponibilidade imediata em todos os clientes. Falha é apenas logada no catch, sem código de saída confiável; imports/serialização anteriores ao try também podem lançar exceções. Não foi executado nesta tarefa.

## Iniciar e interromper

Depois de preparar/configurar uma instância cuja execução esteja autorizada:

```powershell
node index.js
```

Não existe script `npm start` declarado; use a entrada explícita. Em `ready`, o código registra usuário, servidores e contagem no console; inicia rotação de presença a cada 100 segundos. Isso é comportamento esperado pelo fonte, não login comprovado na auditoria. Interrompa uma instância local interativa com `Ctrl+C`; serviços hospedados devem ser parados pelo supervisor aprovado para aquela instância.

Não há desligamento gracioso, persistência ou recuperação de tarefas. Toda interrupção perde listas `/todo`, timers e cooldowns. O processo precisa permanecer ativo; não há servidor web para receber tráfego HTTP nem implementação de bot de voz.

## Diagnóstico

| Sintoma | Conferência e limitação |
| --- | --- |
| Node/npm sem versão ativa | Conferir versão da `.nvmrc`, localização do runtime e shim NVM. Usar binário portátil explícito fora do `node_modules` alvo ou preparar gerenciador em tarefa apropriada; não foi definido padrão global nesta fase. |
| `Cannot find module 'prettier'` na inicialização/registro | Em commits anteriores à Fase 1, Prettier estava em devDependencies. Conferir manifest/lock atuais e instalação limpa; agora produção inclui Prettier, sem exigir `--include=dev`. Não copiar `node_modules` antigo como correção. |
| Token inválido ou bot não chega a `ready` | Verificar segredo local, conexão de saída e aplicação; não imprimir token. `login` não tem catch explícito. |
| Slash command ausente | Separar carregamento local de registro global/instalação OAuth. Confirmar aplicação e permissões; não rodar registro repetidamente como diagnóstico automático. |
| “A aplicação não respondeu” / interação desconhecida | P1.2 reconhece antes das operações demoradas. Conferir atraso de entrega/event loop/rede: o defer também pode falhar. Interações expiradas não são reenviadas; o prazo inicial continua 3 s e o token reconhecido vale 15 min desde a criação. [Contrato de respostas](https://docs.discord.com/developers/interactions/receiving-and-responding). |
| “InteractionAlreadyReplied” ou erro após sucesso aparente | P1.2 escolhe continuação por estado e não tenta novo envio após falha de entrega. Reações são secundárias e capturadas; erro inesperado após sucesso pode gerar follow-up conforme visibilidade já estabelecida. Não repetir manualmente uma operação sem conferir o efeito anterior. |
| Loading/placeholder neutro permanece após erro | Ramos privados após defer público concluem o loading sem conteúdo visível, enviam follow-up efêmero e removem o original. Falha intermediária pode manter esse placeholder; o helper não expõe o erro privado nem repete envio ambíguo. |
| Falha HTTP / resultado inesperado | Consultas têm prazo de 5 s, incluindo JSON do fetch; erros de consulta mantêm mensagens/visibilidade e falhas de envio são separadas. `/github` ainda mapeia não 200 para inexistente; `/status` pode chamar 3xx/4xx/5xx de offline. Schemas/quota/backoff continuam limitados. |
| `/status` recusa um site público | P1.1 recusa DNS misto, faixas especiais, mapped/tradução IPv6, credenciais e redirects; usa somente o primeiro IP aprovado. Limites de 5 s/1 MiB/16 KiB também podem recusar sites online. Erros são genéricos e a saída omite caminho/query; não solicitar dumps com segredos como diagnóstico. |
| Falha no QR code | cwd precisa permitir escrita; PNG temporário pode permanecer se envio falhar. Inspecionar arquivos sem apagá-los nesta auditoria. |
| Anexos/reação não enviados | Conferir permissões e presença de `images/lofiradio.jpeg` e `images/lofiicon.png`. |
| Lista/timer desapareceu ou mudou em outro servidor | Estado por userId é compartilhado entre servidores do mesmo processo e volátil. Não há backup restaurável dessas estruturas. |

P1.2 usa logs fixos para falhas de interação/secundárias e não imprime erros HTTP brutos. Logs de ready ainda incluem servidores e o registro remoto tem tratamento próprio; acesso/retenção continuam pendentes. Compartilhe somente trechos sanitizados. Veja [riscos](KNOWN_RISKS.md).

## Preparação para futura hospedagem

Não foi identificado provedor atual ou configuração de Docker, PM2, systemd, CI/CD ou serviço gerenciado. **Não há deploy aprovado ou realizado.** Como proposta técnica: um processo Node persistente com saída HTTPS/WebSocket para Discord/APIs, cwd na raiz, dependências completas, assets presentes, segredo injetado, espaço temporário gravável para QR codes e logs com retenção/acesso definidos.

Runtime LTS, instalações limpas normal/produção e contratos offline foram validados em P0/P1.1; R06 foi corrigido localmente e P1.2 corrigiu R05/R07 nos testes controlados. Antes de publicar, permanecem os riscos de configuração/ciclo de vida, limites/estado e recuperação, além da validação operacional autorizada. Rede e roteamento da hospedagem são `NOT_CONFIRMED`. Supervisor e rollback são propostas; não estão implementados. Múltiplas réplicas/shards exigem decidir sincronização de estado/contagens; a versão atual é um único cliente/processo com memória local.

## Recuperar após perda de máquina ou hospedagem

1. Obter uma cópia íntegra do repositório e selecionar branch/commit pretendidos. O cérebro está na `develop`; exemplo em máquina nova: `git clone --branch develop https://github.com/emanuelsacoman/Bot-Estudos-Discord.git`; entrar na pasta e conferir `git status`/`git log -1`. O acesso remoto de clonagem não foi testado nesta fase; P1.1 já está commitada e as alterações P1.2 ainda estão sem commit.
2. Ler [AGENTS](../../AGENTS.md), [CURRENT](CURRENT.md), [estado](PROJECT_STATE.md) e este procedimento. Restaurar alterações/documentos que tenham sido salvos em backup mas ainda não estejam no Git.
3. Preparar Node da `.nvmrc` (24.22.2) e npm correspondente (11.19.1); instalar com o lock via `npm ci --engine-strict`, ou `npm ci --omit=dev --engine-strict` em produção, em checkout novo com os manifests desta fase. Conservar `commands/`, `lib/`, testes e os três assets versionados.
4. Recuperar `TOKEN` de armazenamento seguro autorizado e o Application ID da aplicação existente. O token não está no Git e não pode ser reconstruído pelo `.env.example`. Se não houver acesso ao segredo/conta, a recuperação depende do responsável; rotação de credenciais é ação separada e não foi autorizada nesta auditoria.
5. Configurar `.env` ou variáveis injetadas; conferir convite e URLs públicas. Não assumir que recriar a aplicação preserva identidade, instalações e votos.
6. Executar os gates offline. O registro global já existente no Discord não depende de haver o processo antigo em execução: não registre novamente só porque mudou a máquina. Registrar somente se o conjunto remoto precisar mudar e houver autorização.
7. Em instância autorizada, iniciar `node index.js`, conferir `ready` e testar `/ping`, `/help`, menu `/docs`, anexos, reações e comandos HTTP num ambiente controlado. Registrar versão, commit, resultados e limitações; não declarar recuperação concluída só pelo log inicial.
8. Listas/timers/cooldowns anteriores não são recuperáveis do Git: não há armazenamento persistente. Documentar a perda e atualizar [CURRENT](CURRENT.md).

Este runbook nunca foi exercitado integralmente. Backups de segredos, conta Discord e infraestrutura atual são `NOT_CONFIRMED`; cópia do código não substitui esses acessos.
