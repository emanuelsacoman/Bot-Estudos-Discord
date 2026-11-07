# Catálogo dos comandos

Auditoria inicial de 2026-11-07, código-base `cea09b90889716b5b05139eaf06f8b0e858f179e`. Foram encontrados **23 comandos** em [commands/](../../commands/); na auditoria inicial, os 23 módulos foram carregados localmente e `data.toJSON()`, função `execute` e nomes únicos foram verificados. Atualização da Fase 1/P0 na mesma data, base `develop` / `02e22dd`: Node foi fixado em `24.22.2` e Prettier passou a dependência de produção; os fontes/contratos dos comandos não mudaram. Instalações limpas de desenvolvimento e produção com npm `11.19.1` passaram, assim como sintaxe, importação/serialização dos 23 módulos e igualdade do payload JSON com o baseline anterior à mudança; evidências em [QUALITY_GATES.md](QUALITY_GATES.md). Os comportamentos abaixo foram identificados no código; uso real no Discord e integrações externas permanecem `NOT_CONFIRMED`.

## Regras comuns

- Todos os módulos exportam `data` e `execute(interaction)`. O [runtime](../../index.js) carrega os arquivos `.js`; o [registro global](../../deploy-commands.js) serializa os mesmos módulos. Carregar ou serializar um módulo localmente não comprova registro remoto.
- Todas as opções de entrada documentadas são **obrigatórias**. Somente `/formatar` define escolhas fechadas; os demais textos são livres. Não há `setMinValue`, `setMaxValue`, `setMinLength` ou `setMaxLength` nos builders atuais.
- O runtime aplica cooldown de **5 segundos por comando e usuário**, comum a todos os servidores daquele processo. Nenhum módulo configura cooldown próprio. O timestamp é registrado antes de executar; uma execução que falha também consome o intervalo. Reiniciar perde os cooldowns. Menus não passam por esse controle.
- Respostas normais são públicas, exceto `/ping`. Respostas efêmeras específicas são indicadas abaixo; o bloqueio de cooldown também é efêmero.
- Nenhum comando chama `deferReply()`. Consultas HTTP, formatação e geração de arquivos podem atrasar o primeiro reconhecimento da interação: `KNOWN_RISK`. Apenas `/status` define timeout HTTP explícito.
- Tratamento central de erros tenta `reply()` sem verificar `replied`/`deferred`; uma falha depois da primeira resposta pode impedir o aviso de erro. Erros locais capturados podem também tentar responder novamente. Consulte [KNOWN_RISKS.md](KNOWN_RISKS.md).
- Todos dependem de `discord.js`, diretamente ou pelo builder transitivo indicado em `/translate`. Permissões de acesso ao canal, envio, embeds, anexos e reações devem ser verificadas conforme o recurso usado. Os builders não impõem permissões administrativas ou restrição explícita a servidores.

## Inventário

| Comando | Finalidade | Entrada |
| --- | --- | --- |
| `/autor` | Apresentar o autor e a origem acadêmica | Nenhuma |
| `/count` | Contar componentes de texto | `texto` string |
| `/docs` | Selecionar links de documentação | Menu posterior à resposta |
| `/exercise` | Sortear enunciado de exercício local | `linguagem` string |
| `/formatar` | Formatar código com Prettier | `linguagem`, `codigo` strings |
| `/git` | Consultar referência estática de Git | Nenhuma |
| `/github` | Consultar um repositório GitHub | `repositorio` string |
| `/help` | Listar comandos carregados | Nenhuma |
| `/http` | Consultar significado de código HTTP | `codigo` integer |
| `/invite` | Compartilhar convite OAuth do bot | Nenhuma |
| `/lofiradio` | Compartilhar site Lofi Radio | Nenhuma |
| `/moeda` | Converter moedas por taxa externa | `valor` number; `origem`, `destino` strings |
| `/ping` | Medir tempo da resposta inicial | Nenhuma |
| `/playlist` | Compartilhar playlist Spotify | Nenhuma |
| `/qrcode` | Gerar PNG com QR code | `link` string |
| `/question` | Buscar pergunta no Stack Overflow | `pergunta` string |
| `/repositorys` | Listar até cinco repositórios populares | `linguagem` string |
| `/servercount` | Contar servidores no cache atual | Nenhuma |
| `/status` | Consultar URL por HTTP GET | `url` string |
| `/timer` | Agendar ou cancelar temporizador | `set tempo` integer; `stop` |
| `/todo` | Gerenciar lista de tarefas em memória | `add tarefa` string; `list`; `remove numero` integer |
| `/translate` | Traduzir texto por endpoint externo | `idioma`, `texto` strings |
| `/vote` | Compartilhar página de votação top.gg | Nenhuma |

## Contratos e comportamento individual

### `/autor`

**Fonte:** [autor.js](../../commands/autor.js). **Opções:** nenhuma.

Envia embed sobre Emanuel Vinícius Sacoman e a origem do CodeBucket no TCC de Análise e Desenvolvimento de Sistemas, botão para seu perfil GitHub e três reações aleatórias sequenciais. Usa a API de mensagens/reações do Discord; avatar é uma URL pública do GitHub.

**Erros e limites:** as reações podem repetir e dependem de permissões. Não há catch local; falha de reação acontece depois de enviar a resposta. A biografia é conteúdo estático do código, sem consulta ao GitHub.

### `/count`

**Fonte:** [count.js](../../commands/count.js). **Opções:** `texto` — string obrigatória.

Responde embed com palavras (`trim`, separação por espaços e filtro), letras ASCII (`[a-zA-Z]`), dígitos (`\d`), grupo “Letras e Números” (`\w`) e `text.length`. Não usa serviço externo.

**Erros e limites:** letras acentuadas não entram na contagem de letras; `_` entra no grupo de letras/números; o total de caracteres segue unidades UTF-16 do JavaScript. Não há catch local nem definição própria de contagem Unicode.

### `/docs`

**Fonte:** [docs.js](../../commands/docs.js) e mapa/handler de seleção em [index.js](../../index.js). **Opções slash:** nenhuma.

Envia embed e menu de seleção com `customId="select"`. Os 25 valores disponíveis são `angular`, `csharp`, `cpp`, `css`, `dart`, `discordjs`, `git`, `go`, `godot`, `html`, `ionic`, `java`, `javascript`, `kotlin`, `python`, `react`, `ruby`, `swift`, `typescript`, `unreal`, `unity`, `rust`, `php`, `vuejs` e `jquery`.

O handler global usa o primeiro valor selecionado para responder publicamente com texto/link. As URLs são estáticas; o bot não consulta o conteúdo das documentações. Há uma entrada `laravel` em `index.js`, mas **Laravel não é oferecido no menu atual**.

**Erros e limites:** menu e mapa são mantidos em arquivos separados. O handler recebe qualquer string select menu sem filtrar `customId` nem restringir ao autor original; valor desconhecido recebe “Opção não reconhecida.” Links podem estar desatualizados; disponibilidade `NOT_CONFIRMED`.

### `/exercise`

**Fonte:** [exercise.js](../../commands/exercise.js). **Opções:** `linguagem` — string obrigatória, sem escolhas fechadas.

Converte a entrada para minúsculas e sorteia um enunciado no banco local. Aliases aceitos:

| Banco | Entradas aceitas |
| --- | --- |
| JavaScript | `javascript`, `js` |
| TypeScript | `typescript`, `ts` |
| Python | `python`, `py` |
| Java | `java` |
| C# | `csharp`, `c#` |
| C | `c` |
| C++ | `cpp`, `c++`, `c plus plus` |
| HTML | `html`, `hypertext markup language` |
| CSS | `css`, `cascading style sheets` |

O embed usa a entrada em maiúsculas como título e o enunciado sorteado como descrição. Não há API externa, execução de código, solução, correção ou IA.

**Erros e limites:** não remove espaços nas extremidades. Entrada desconhecida gera aviso no próprio embed público. Existem enunciados repetidos; não há controle de repetição entre chamadas.

### `/formatar`

**Fonte:** [formatar.js](../../commands/formatar.js). **Opções:** `linguagem` — string obrigatória com escolhas `JavaScript → babel`, `HTML → html`, `CSS → css`, `JSON → json`, `Markdown → markdown`; `codigo` — string obrigatória.

Executa `await prettier.format(codigo, { parser: linguagem })` e envia o resultado em campo de embed com bloco de código. Usa Prettier localmente, sem executar o código enviado e sem API externa.

**Dependência e histórico:** Prettier `3.5.3` é dependência de produção (`^3.5.3`), pois é importado durante o carregamento de todos os comandos. Na auditoria inicial estava em `devDependencies`; a Fase 1 corrigiu essa classificação ([R02](KNOWN_RISKS.md#r02)), preservando faixa e versão resolvida. Instalação limpa com `--omit=dev` e carregamento dos comandos passaram em Node `24.22.2`/npm `11.19.1`. O `execute` real de `/formatar` passou nos cinco parsers (`babel`, `html`, `css`, `json`, `markdown`) usando resposta simulada, em ambos os modos de instalação, sem chamadas de rede. Envio real no Discord continua `NOT_CONFIRMED`; consulte [QUALITY_GATES.md](QUALITY_GATES.md).

**Erros e limites:** não divide saídas grandes para os limites de campos/embeds do Discord. Catch envia erro efêmero sugerindo conferir a sintaxe, inclusive quando a causa é outra. Comportamento do formatador não foi refatorado na Fase 1.

### `/git`

**Fonte:** [git.js](../../commands/git.js). **Opções:** nenhuma.

Retorna embed estático com referências a `init`, `clone`, `stash`, `status`, `add`, `commit`, `branch`, `switch -c`, `merge`, `push`, `pull`, `remote` e `config`, incluindo variações desses comandos. Não executa comandos Git e não consulta o repositório local.

**Erros e limites:** o embed e o timestamp são construídos uma vez no carregamento do módulo. Não há catch local; a referência textual precisa de revisão se seu conteúdo for alterado.

### `/github`

**Fonte:** [github.js](../../commands/github.js). **Opções:** `repositorio` — string obrigatória; formato esperado na descrição: `usuario/repositorio`.

Usa `fetch` global em `https://api.github.com/repos/${repository}`. Para HTTP 200 exibe proprietário/avatar, nome completo, descrição, linguagem, estrelas, forks e URL em embed. Qualquer outro status recebe “Repositório não encontrado.”

**Erros e limites:** requer runtime com `fetch` global; não importa `node-fetch`. Não valida o formato, não autentica e não define timeout. Status de limite de API e falhas de autenticação podem ser confundidos com repositório ausente. Fallbacks após template strings não substituem `null`/`undefined`, que se tornam texto. Catch envia mensagem pública genérica.

### `/help`

**Fonte:** [help.js](../../commands/help.js). **Opções:** nenhuma.

Lê `interaction.client.commands` e monta um campo de embed para cada nome/descrição carregado. Não faz consulta à lista registrada na API Discord.

**Erros e limites:** não apresenta parâmetros nem subcomandos. São 23 campos no código atual; adicionar comandos pode exceder o limite de campos por embed. Não há catch local.

### `/http`

**Fonte:** [http.js](../../commands/http.js). **Opções:** `codigo` — integer obrigatório, sem intervalo declarado.

Valores 100–199 recebem descrição genérica local de código informativo. Os demais usam axios GET em `https://httpstat.us/${code}?json`, aceitando qualquer status com `validateStatus: () => true`. Espera corpo com `code` e `description`; colore o embed conforme a faixa e inclui link em `httpstatuses.com`.

**Erros e limites:** não define timeout nem restringe código a valores existentes. Corpo sem `data.code` recebe aviso efêmero; exceção gera erro efêmero. O contrato atual do corpo remoto e a disponibilidade dos links são `NOT_CONFIRMED`.

### `/invite`

**Fonte:** [invite.js](../../commands/invite.js). **Opções:** nenhuma.

Exibe embed e botão OAuth com `process.env.INVITE_URL` ou fallback público com aplicação `1193011045577523300`, `permissions=0` e scopes `bot applications.commands`; adiciona reação de coração.

**Erros e limites:** o fallback não deriva de `CLIENT_ID` e pode apontar para outra aplicação. Permissões zero na URL não garantem os recursos de anexos e reações. URL inválida ou reação sem permissão podem falhar; não há catch local. O bot apenas compartilha o link, sem alterar instalação remota nesta execução.

### `/lofiradio`

**Fonte:** [lofiradio.js](../../commands/lofiradio.js). **Opções:** nenhuma.

Usa `process.env.LOFIRADIO_URL` ou `https://lofiradio.web.app`, envia embed com botão e anexa [lofiicon.png](../../images/lofiicon.png) e [lofiradio.jpeg](../../images/lofiradio.jpeg). Caminhos são montados com `path` e `__dirname`.

**Erros e limites:** apenas compartilha um site externo; não transmite áudio e não entra em canal de voz. Depende dos dois arquivos e da permissão de anexar/mostrar embeds. Catch tenta responder erro efêmero; disponibilidade e estações do site não foram verificadas.

### `/moeda`

**Fonte:** [moeda.js](../../commands/moeda.js). **Opções:** `valor` — number obrigatório; `origem` e `destino` — strings obrigatórias, exemplos USD/EUR na descrição.

Converte códigos para maiúsculas, usa axios GET em `https://api.exchangerate-api.com/v4/latest/${origem}`, busca `rates[destino]`, multiplica pelo valor e arredonda com `toFixed(2)`. Embed mostra valor original, convertido e taxa.

**Erros e limites:** não valida positividade, não faz trim e não define timeout. Destino sem taxa gera erro efêmero; HTTP 404 é interpretado como origem inválida; demais falhas recebem erro efêmero genérico. Atualização e precisão das taxas dependem do serviço externo, `NOT_CONFIRMED` nesta auditoria.

### `/ping`

**Fonte:** [ping.js](../../commands/ping.js). **Opções:** nenhuma.

Responde **efemeramente** com “Pong!”, mede a duração de `await interaction.reply()` por `Date.now()` e edita a mesma resposta com a latência em ms.

**Erros e limites:** a medida representa o tempo da resposta inicial, sem usar `client.ws.ping` e sem medir todas as condições de rede. Não há catch local; `editReply` pode falhar após a primeira resposta.

### `/playlist`

**Fonte:** [playlist.js](../../commands/playlist.js). **Opções:** nenhuma.

Envia embed, um follow-up público com URL fixa da playlist Spotify `3FbsZmt8BrFFmVpKD4ju4H` e uma reação aleatória ao follow-up.

**Erros e limites:** compartilha link, sem consulta à API Spotify e sem reprodução de áudio. Falha de reação pode ocorrer após as duas mensagens serem enviadas. Disponibilidade da playlist `NOT_CONFIRMED`; sem catch local.

### `/qrcode`

**Fonte:** [qrcode.js](../../commands/qrcode.js). **Opções:** `link` — string obrigatória.

Usa `qrcode.toFile()` para gerar `qrcode_${Date.now()}.png` no diretório de trabalho, envia como imagem anexa a um embed e apaga o arquivo com `fs.unlinkSync()` depois do reply. Usa `qrcode` e `fs`; não acessa o endereço codificado.

**Erros e limites:** aceita texto arbitrário sem validar URL; requer escrita no diretório de execução. `Date.now()` permite colisões no mesmo milissegundo. O helper captura/loga falha de geração e permite continuar para envio do arquivo ausente. Não há `finally`: falha de resposta pode deixar arquivo no disco. Falhas de exclusão propagam depois da resposta.

### `/question`

**Fonte:** [question.js](../../commands/question.js). **Opções:** `pergunta` — string obrigatória; descrição solicita inglês.

Usa axios GET em `https://api.stackexchange.com/2.3/search`, com `order=desc`, `sort=activity`, `intitle` codificado e `site=stackoverflow`. Exibe título e link do **primeiro resultado por atividade**, sem buscar o conteúdo da resposta. Não há IA nem resposta automática à pergunta.

**Erros e limites:** entrada vazia, ausência de resultados e exceções geram respostas efêmeras. Não há timeout nem controle de quota/backoff. Variável `answerLink` é calculada e não usada; o campo “Answer link” aponta para a própria pergunta. Idioma inglês é solicitado, sem validação ou tradução.

### `/repositorys`

**Fonte:** [repositorys.js](../../commands/repositorys.js). **Opções:** `linguagem` — string obrigatória. O nome público é exatamente `repositorys`.

Usa axios GET em `https://api.github.com/search/repositories?q=language:${linguagem}&sort=stars&order=desc`. Seleciona até cinco itens e envia texto público com nome completo, link e estrelas. Ausência de resultados recebe mensagem pública.

**Erros e limites:** a entrada não é codificada na URL, permitindo caracteres que alteram a consulta. Não há autenticação, timeout ou tratamento específico de rate limit. Catch loga e responde erro público. Não garante cinco resultados se houver menos.

### `/servercount`

**Fonte:** [servercount.js](../../commands/servercount.js). **Opções:** nenhuma.

Envia embed com `interaction.client.guilds.cache.size`. Não consulta armazenamento histórico ou serviço de métricas externo.

**Erros e limites:** representa o cache do cliente/processo atual; não agrega shards e não é inventário histórico. Não há catch local.

### `/status`

**Fonte:** [status.js](../../commands/status.js). **Opções:** `url` — string obrigatória.

Adiciona `https://` quando a entrada não começa com `http://` ou `https://`. Faz axios GET com timeout de **5000 ms**. Sucesso gera embed verde com status HTTP; catch gera embed vermelho com status recebido ou “Desconhecido”.

**Erros e limites:** `KNOWN_RISK` de SSRF: destino é controlado pelo usuário sem bloqueio de redes privadas, loopback ou redirecionamentos para destinos internos. Faz GET real a partir da infraestrutura do bot. HTTP não 2xx pode ser apresentado como “Offline ou inacessível” mesmo com servidor acessível. Esperar até 5 segundos sem defer pode expirar a interação. Falha ao enviar o embed de erro propaga.

### `/timer`

**Fonte:** [timer.js](../../commands/timer.js). **Subcomandos:** `set` com `tempo` — integer obrigatório em minutos; `stop` sem opções. Sem valor padrão ou limites declarados.

Mantém objeto `timers` por `interaction.user.id` na memória do processo, compartilhado entre servidores. `set` cancela eventual timer anterior daquele usuário, agenda `setTimeout(tempo * 60 * 1000)` e confirma publicamente com menção/embed. No vencimento tenta enviar nova mensagem ao canal original. `stop` cancela/remove a referência e confirma; ausência de timer recebe resposta efêmera.

**Erros e limites:** reinício perde timers; não há persistência nem isolamento por servidor. Zero, negativos e valores muito grandes não são barrados. O callback não aguarda nem captura `channel.send()` e não remove a referência quando o timer vence. O catch de `execute` apenas loga, podendo deixar interação sem resposta; não cobre rejeições futuras do callback. Uma referência vencida pode ainda ser considerada timer existente por `stop`.

### `/todo`

**Fonte:** [todo.js](../../commands/todo.js). **Subcomandos:** `add` com `tarefa` — string obrigatória; `list` sem opções; `remove` com `numero` — integer obrigatório, posição começando em 1.

Usa `Map<userId, array>` em memória. `add` bloqueia duplicata textual exata, acrescenta e confirma em embed; `list` enumera as tarefas; `remove` valida faixa, remove por índice e confirma. Duplicata, lista vazia e posição inválida geram mensagens efêmeras. Confirmações normais e lista são públicas.

**Erros e limites:** reinício perde todas as listas. A mesma lista do usuário é acessível em diferentes servidores, sem isolamento ou persistência. Não limita tarefas/tamanho nem divide embeds longos. Não há catch local. Inserção/remoção acontece antes de responder, podendo alterar a memória mesmo se o envio falhar.

### `/translate`

**Fonte:** [translate.js](../../commands/translate.js). **Opções:** `idioma` — string obrigatória com sigla de destino; `texto` — string obrigatória.

Importa `SlashCommandBuilder` de `@discordjs/builders` (dependência transitiva de discord.js) e axios. Consulta `https://translate.googleapis.com/translate_a/single` com `client=gtx`, `sl=auto`, `tl=${idioma}`, `dt=t` e texto codificado em `q`. Extrai apenas `response.data[0][0][0]` e responde publicamente com menção ao usuário e tradução.

**Erros e limites:** não valida idioma, não codifica a sigla, não define timeout e pressupõe formato específico do corpo. Pode descartar segmentos adicionais da tradução. Não existe chave/configuração de Google Cloud no projeto; contrato, estabilidade e uso permitido desse endpoint são `NOT_CONFIRMED`. Catch loga e responde erro efêmero. A importação depende da resolução de um pacote não declarado diretamente.

### `/vote`

**Fonte:** [vote.js](../../commands/vote.js). **Opções:** nenhuma.

Envia embed, botão para `https://top.gg/bot/1193011045577523300` e reação de estrela. Não consulta API top.gg e não confirma se o usuário votou.

**Erros e limites:** aplicação no link é fixa, independente de `CLIENT_ID`. Reação depende de permissões e pode falhar depois da resposta. Disponibilidade da página `NOT_CONFIRMED`; não há catch local.

## Continuidade

Ao mudar nome, opções ou comportamento, atualize esta ficha e avalie impacto no registro global. Valide o contrato local conforme [QUALITY_GATES.md](QUALITY_GATES.md); o registro na API Discord exige autorização específica. Integrações, segurança e recuperação estão em [ARCHITECTURE.md](ARCHITECTURE.md), [KNOWN_RISKS.md](KNOWN_RISKS.md) e [OPERATIONS.md](OPERATIONS.md).
