# Operação e recuperação

Referência de 2026-11-07 para o commit `cea09b9`. Os procedimentos de instalação, login, registro e hospedagem abaixo são **documentados, não executados nesta auditoria**. Somente as verificações offline descritas em [QUALITY_GATES](QUALITY_GATES.md) foram realizadas. Os exemplos de shell usam PowerShell, a partir da raiz do repositório.

## Preparar Node.js e dependências

O projeto não fixa runtime. O lock exige Node >=18.17 (discord.js 14.18.0 exige >=18; undici 6.21.1 exige >=18.17). Para uma recuperação futura, a proposta é usar **Node 24 LTS** e validar com o lock atual antes de promover. Na consulta de 2026-11-07, as linhas 22, 24 e 26 constam como LTS; 18 e 20 estão EOL. A recomendação oficial é produção em uma linha LTS suportada. [Ciclo oficial do Node.js](https://nodejs.org/en/about/previous-releases).

Instale/selecione o Node pelo instalador oficial ou pelo gerenciador já usado no ambiente; confirme que o terminal resolve a versão pretendida. Nenhuma seleção/instalação foi realizada nesta tarefa.

```powershell
node --version
npm --version
```

No ambiente auditado, os shims `node` e `npm` responderam “No active Node.js version is configured”. Um binário já instalado de Node 20.20.0 permitiu apenas testes locais por caminho explícito; não serve como aprovação de uma versão EOL para hospedagem. Erro `EPERM ... lstat` em ancestral ocorreu dentro do sandbox; flags `--preserve-symlinks --preserve-symlinks-main` permitiram a auditoria sem mudar permissões. Não confunda esse caso com defeito dos fontes.

Em checkout novo, instale respeitando o lock e incluindo as dependências de desenvolvimento:

```powershell
npm ci --include=dev
```

Esse comando é procedimento futuro: `npm ci` recria `node_modules` e deve ser executado em ambiente preparado para instalação. A inclusão explícita de dev é necessária porque [formatar.js](../../commands/formatar.js) importa Prettier ao carregar. Usar `--omit=dev` ou omissão por ambiente de produção pode impedir o bot inteiro de iniciar. Não remova/atualize o lock para contornar erros de instalação sem investigar. [Comportamento de npm ci](https://docs.npmjs.com/cli/v10/commands/npm-ci/).

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
| Node/npm sem versão ativa | Selecionar uma LTS suportada no gerenciador usado pelo operador e reabrir o terminal; não foi corrigido globalmente nesta tarefa. |
| `Cannot find module 'prettier'` na inicialização/registro | Instalação omitiu devDependencies; em ambiente preparado, reinstalar com `npm ci --include=dev`. Nenhuma dependência foi alterada nesta entrega. |
| Token inválido ou bot não chega a `ready` | Verificar segredo local, conexão de saída e aplicação; não imprimir token. `login` não tem catch explícito. |
| Slash command ausente | Separar carregamento local de registro global/instalação OAuth. Confirmar aplicação e permissões; não rodar registro repetidamente como diagnóstico automático. |
| “A aplicação não respondeu” / interação desconhecida | Há operações HTTP/arquivo antes do primeiro reply, sem defer. Discord exige resposta inicial em até 3 segundos; timeout de `/status` é 5 segundos. [Contrato de respostas](https://docs.discord.com/developers/interactions/receiving-and-responding). |
| “InteractionAlreadyReplied” ou erro após sucesso aparente | Falha em reação/follow-up pode ocorrer após resposta; catch global tenta novo `reply` indiscriminadamente. |
| Falha HTTP / resultado inesperado | Verificar limite, status e formato esperado da API. `/github` mapeia qualquer não 200 para inexistente; `/status` pode chamar 4xx/5xx de offline. Não há política central de retry/backoff. |
| Falha no QR code | cwd precisa permitir escrita; PNG temporário pode permanecer se envio falhar. Inspecionar arquivos sem apagá-los nesta auditoria. |
| Anexos/reação não enviados | Conferir permissões e presença de `images/lofiradio.jpeg` e `images/lofiicon.png`. |
| Lista/timer desapareceu ou mudou em outro servidor | Estado por userId é compartilhado entre servidores do mesmo processo e volátil. Não há backup restaurável dessas estruturas. |

Logs de erros axios podem conter URLs e texto de consultas; compartilhe somente trechos sanitizados. Veja [riscos](KNOWN_RISKS.md).

## Preparação para futura hospedagem

Não foi identificado provedor atual ou configuração de Docker, PM2, systemd, CI/CD ou serviço gerenciado. **Não há deploy aprovado ou realizado.** Como proposta técnica: um processo Node persistente com saída HTTPS/WebSocket para Discord/APIs, cwd na raiz, dependências completas, assets presentes, segredo injetado, espaço temporário gravável para QR codes e logs com retenção/acesso definidos.

Antes de publicar, validar runtime LTS/instalação limpa e tratar os riscos prioritários de `/status`, prazo das interações e erros assíncronos. Um supervisor com reinício controlado e procedimento de rollback são propostas; não estão implementados. Múltiplas réplicas/shards exigem decidir como sincronizar estado e contagens; a versão atual é um único cliente/processo com memória local.

## Recuperar após perda de máquina ou hospedagem

1. Obter uma cópia íntegra do repositório e selecionar o commit pretendido. Exemplo em máquina nova: `git clone https://github.com/emanuelsacoman/Bot-Estudos-Discord.git`; entrar na pasta e conferir `git status`/`git log -1`. O acesso remoto de clonagem não foi testado.
2. Ler [AGENTS](../../AGENTS.md), [CURRENT](CURRENT.md), [estado](PROJECT_STATE.md) e este procedimento. Restaurar alterações/documentos que tenham sido salvos em backup mas ainda não estejam no Git.
3. Preparar Node LTS suportado e npm; instalar com o lock via `npm ci --include=dev` em checkout novo. Conservar `commands/` e os três assets versionados.
4. Recuperar `TOKEN` de armazenamento seguro autorizado e o Application ID da aplicação existente. O token não está no Git e não pode ser reconstruído pelo `.env.example`. Se não houver acesso ao segredo/conta, a recuperação depende do responsável; rotação de credenciais é ação separada e não foi autorizada nesta auditoria.
5. Configurar `.env` ou variáveis injetadas; conferir convite e URLs públicas. Não assumir que recriar a aplicação preserva identidade, instalações e votos.
6. Executar os gates offline. O registro global já existente no Discord não depende de haver o processo antigo em execução: não registre novamente só porque mudou a máquina. Registrar somente se o conjunto remoto precisar mudar e houver autorização.
7. Em instância autorizada, iniciar `node index.js`, conferir `ready` e testar `/ping`, `/help`, menu `/docs`, anexos, reações e comandos HTTP num ambiente controlado. Registrar versão, commit, resultados e limitações; não declarar recuperação concluída só pelo log inicial.
8. Listas/timers/cooldowns anteriores não são recuperáveis do Git: não há armazenamento persistente. Documentar a perda e atualizar [CURRENT](CURRENT.md).

Este runbook nunca foi exercitado integralmente. Backups de segredos, conta Discord e infraestrutura atual são `NOT_CONFIRMED`; cópia do código não substitui esses acessos.
