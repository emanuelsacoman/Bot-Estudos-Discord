# Catálogo dos comandos

Auditoria inicial de 2026-11-07, código-base `cea09b90889716b5b05139eaf06f8b0e858f179e`. Foram encontrados **23 comandos** em [commands/](../../commands/); na auditoria inicial, os 23 módulos foram carregados localmente e `data.toJSON()`, função `execute` e nomes únicos foram verificados. Atualização da Fase 1/P0 na mesma data, base `develop` / `02e22dd`: Node foi fixado em `24.22.2` e Prettier passou a dependência de produção; os fontes/contratos dos comandos não mudaram. Instalações limpas de desenvolvimento e produção com npm `11.19.1` passaram, assim como sintaxe, importação/serialização dos 23 módulos e igualdade do payload JSON com o baseline anterior à mudança; evidências em [QUALITY_GATES.md](QUALITY_GATES.md). Os comportamentos abaixo foram identificados no código; uso real no Discord e integrações externas permanecem `NOT_CONFIRMED`.

## Regras comuns

**Atualização P1.1 — 2026-11-07, base `develop` / `49138e6`:** `/status` passou a usar transporte seguro do Node; contratos slash dos 23 comandos continuam idênticos ao P0. Suíte permanente de SSRF/interação simulada e carregamento passa offline; resultados e limites em [QUALITY_GATES](QUALITY_GATES.md).

**Atualização P1.2 — 2026-11-07, base `develop` / `234f01b`:** todos os comandos passaram a usar a continuação compartilhada de respostas. Operações HTTP, formatação e geração/envio de arquivos têm reconhecimento prévio; nomes, opções, mensagens e visibilidade dos ramos existentes foram preservados. A P1.2 foi commitada em `a79f13a`.

**Atualização P1.3 — 2026-11-07, base `develop` / `a79f13a`:** validação compartilhada do catálogo no runtime/registro e ciclo de vida de `/timer` com duração e escopo controlados. Os nomes e opções slash permanecem iguais; as mudanças P1.3 estão sem commit. Evidências e limites em [QUALITY_GATES](QUALITY_GATES.md).

- Todos os módulos exportam `data` e `execute(interaction)`. [command-catalog.js](../../lib/command-catalog.js) carrega e valida o mesmo conjunto para o [runtime](../../index.js) e o [registro global](../../deploy-commands.js): catálogo não vazio, contratos serializáveis, nomes/opções sem duplicatas e snapshot JSON válido. Falha bloqueia a preparação, sem aceitar catálogo parcial. Carregar ou serializar localmente não comprova registro remoto.
- Todas as opções de entrada documentadas são **obrigatórias**. Somente `/formatar` define escolhas fechadas; os demais textos são livres. Não há `setMinValue`, `setMaxValue`, `setMinLength` ou `setMaxLength` nos builders atuais.
- O runtime aplica cooldown de **5 segundos por comando e usuário**, comum a todos os servidores daquele processo. Nenhum módulo configura cooldown próprio. O timestamp é registrado antes de executar; uma execução que falha também consome o intervalo. Reiniciar perde os cooldowns. Menus não passam por esse controle.
- Respostas normais são públicas, exceto `/ping`. Respostas efêmeras específicas são indicadas abaixo; o bloqueio de cooldown também é efêmero.
- [interactions.js](../../lib/interactions.js) usa `reply()` antes do reconhecimento, `editReply()` após defer ainda pendente e `followUp()` depois de uma resposta concluída. Os sete comandos HTTP deferem antes da consulta; `/question` sem pergunta e `/http` 1xx respondem imediatamente. `/formatar`, `/qrcode` e o envio de anexos de `/lofiradio` também deferem antes do trabalho demorado.
- A privacidade do reconhecimento original é imutável. Quando um ramo efêmero sucede defer público, o helper edita o loading com U+200B neutro, envia o conteúdo privado em follow-up com flag 64 e remove o placeholder. Nenhum erro privado é colocado na resposta pública; uma falha nessa sequência interrompe novas tentativas e pode deixar o placeholder neutro.
- Os seis comandos de APIs usam prazo total de **5000 ms** via [http-client.js](../../lib/http-client.js), incluindo leitura do JSON de `/github`; `/status` mantém seu prazo e todas as proteções SSRF próprias. Não há retry automático. Falhas HTTP são convertidas em erros sem corpo, URL ou configuração remota.
- O listener trata erros conforme o estado da interação, sem repetir envios que falharam ou já foram reportados. Expiração local (3 s sem reconhecimento ou 15 min para interação reconhecida, desde a criação) e códigos terminais impedem novo envio. O erro central inicial continua público; depois do reconhecimento herda a visibilidade estabelecida. Reações e exclusão do QR após sucesso usam `runSecondary`; o manager de timers captura seu próprio envio tardio depois de remover o estado. Consulte [KNOWN_RISKS.md](KNOWN_RISKS.md).
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

**Erros e limites:** as reações podem repetir e dependem de permissões. Cada reação é protegida por `runSecondary`; uma falha após a mensagem não provoca nova resposta nem expõe o erro bruto. A biografia é conteúdo estático do código, sem consulta ao GitHub.

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

Reconhece a interação com defer público antes de `await prettier.format(codigo, { parser: linguagem })` e envia o resultado em campo de embed com bloco de código, usando a continuação compartilhada. Usa Prettier localmente, sem executar o código enviado e sem API externa.

**Dependência e histórico:** Prettier `3.5.3` é dependência de produção (`^3.5.3`), pois é importado durante o carregamento de todos os comandos. Na auditoria inicial estava em `devDependencies`; a Fase 1 corrigiu essa classificação ([R02](KNOWN_RISKS.md#r02)), preservando faixa e versão resolvida. Instalação limpa com `--omit=dev` e carregamento dos comandos passaram em Node `24.22.2`/npm `11.19.1`. O `execute` real de `/formatar` passou nos cinco parsers (`babel`, `html`, `css`, `json`, `markdown`) usando resposta simulada, em ambos os modos de instalação, sem chamadas de rede. Envio real no Discord continua `NOT_CONFIRMED`; consulte [QUALITY_GATES.md](QUALITY_GATES.md).

**Erros e limites:** não divide saídas grandes para os limites de campos/embeds do Discord. Falha de formatação/construção do embed mantém erro efêmero sugerindo conferir a sintaxe, inclusive quando a causa é outra. O envio fica fora desse catch; falha de envio não é confundida com erro de sintaxe nem provoca retry. A semântica de formatação foi preservada em P1.2.

### `/git`

**Fonte:** [git.js](../../commands/git.js). **Opções:** nenhuma.

Retorna embed estático com referências a `init`, `clone`, `stash`, `status`, `add`, `commit`, `branch`, `switch -c`, `merge`, `push`, `pull`, `remote` e `config`, incluindo variações desses comandos. Não executa comandos Git e não consulta o repositório local.

**Erros e limites:** o embed e o timestamp são construídos uma vez no carregamento do módulo. Não há catch local; a referência textual precisa de revisão se seu conteúdo for alterado.

### `/github`

**Fonte:** [github.js](../../commands/github.js). **Opções:** `repositorio` — string obrigatória; formato esperado na descrição: `usuario/repositorio`.

Defer público antes de `fetchJson` em `https://api.github.com/repos/${repository}`; o helper usa `fetch` global com prazo total de 5000 ms para requisição e leitura do JSON. Para HTTP 200 exibe proprietário/avatar, nome completo, descrição, linguagem, estrelas, forks e URL em embed. Qualquer outro status recebe “Repositório não encontrado.” Todos esses ramos continuam públicos.

**Erros e limites:** requer runtime com `fetch` global; não importa `node-fetch`. Não valida o formato nem autentica. Status de limite de API e falhas de autenticação podem ser confundidos com repositório ausente. Fallbacks após template strings não substituem `null`/`undefined`, que se tornam texto. Falhas HTTP, timeout ou corpo inesperado produzem mensagem pública genérica, sem log bruto; falha na continuação de envio não provoca nova resposta.

### `/help`

**Fonte:** [help.js](../../commands/help.js). **Opções:** nenhuma.

Lê `interaction.client.commands` e monta um campo de embed para cada nome/descrição carregado. Não faz consulta à lista registrada na API Discord.

**Erros e limites:** não apresenta parâmetros nem subcomandos. São 23 campos no código atual; adicionar comandos pode exceder o limite de campos por embed. Não há catch local.

### `/http`

**Fonte:** [http.js](../../commands/http.js). **Opções:** `codigo` — integer obrigatório, sem intervalo declarado.

Valores 100–199 recebem descrição genérica local de código informativo, sem defer nem HTTP. Os demais deferem publicamente e usam axios GET via `getJson` em `https://httpstat.us/${code}?json`, com prazo total de 5000 ms e aceitando qualquer status com `validateStatus: () => true`. Espera corpo com `code` e `description`; colore o embed conforme a faixa e inclui link em `httpstatuses.com`.

**Erros e limites:** não restringe código a valores existentes. Corpo sem `data.code` recebe aviso efêmero; exceção/timeout gera erro efêmero, preservado mesmo após defer público. Falhas do envio são tratadas separadamente. O contrato atual do corpo remoto e a disponibilidade dos links são `NOT_CONFIRMED`.

### `/invite`

**Fonte:** [invite.js](../../commands/invite.js). **Opções:** nenhuma.

Exibe embed e botão OAuth com `process.env.INVITE_URL` ou fallback público com aplicação `1193011045577523300`, `permissions=0` e scopes `bot applications.commands`; adiciona reação de coração.

**Erros e limites:** o fallback não deriva de `CLIENT_ID` e pode apontar para outra aplicação. Permissões zero na URL não garantem os recursos de anexos e reações. URL inválida pode falhar antes da resposta; a reação posterior é protegida por `runSecondary`, sem nova mensagem de erro ao usuário. O bot apenas compartilha o link, sem alterar instalação remota nesta execução.

### `/lofiradio`

**Fonte:** [lofiradio.js](../../commands/lofiradio.js). **Opções:** nenhuma.

Usa `process.env.LOFIRADIO_URL` ou `https://lofiradio.web.app`, prepara embed com botão e anexa [lofiicon.png](../../images/lofiicon.png) e [lofiradio.jpeg](../../images/lofiradio.jpeg). Caminhos são montados com `path` e `__dirname`; defer público precede o envio dos anexos.

**Erros e limites:** apenas compartilha um site externo; não transmite áudio e não entra em canal de voz. Depende dos dois arquivos e da permissão de anexar/mostrar embeds. Falha ao preparar o conteúdo gera erro efêmero antes do defer; falha no envio não provoca uma segunda mensagem. Disponibilidade e estações do site não foram verificadas.

### `/moeda`

**Fonte:** [moeda.js](../../commands/moeda.js). **Opções:** `valor` — number obrigatório; `origem` e `destino` — strings obrigatórias, exemplos USD/EUR na descrição.

Converte códigos para maiúsculas, defere publicamente e usa axios GET via `getJson` em `https://api.exchangerate-api.com/v4/latest/${origem}`, com prazo total de 5000 ms. Busca `rates[destino]`, multiplica pelo valor e arredonda com `toFixed(2)`. Embed público mostra valor original, convertido e taxa.

**Erros e limites:** não valida positividade nem faz trim. Destino sem taxa gera erro efêmero; HTTP 404 é interpretado como origem inválida; demais falhas/timeout recebem erro efêmero genérico. Esses ramos permanecem privados após defer público, e falha de envio não repete resposta. Atualização e precisão das taxas dependem do serviço externo, `NOT_CONFIRMED` nesta auditoria.

### `/ping`

**Fonte:** [ping.js](../../commands/ping.js). **Opções:** nenhuma.

Responde **efemeramente** com “Pong!” via `respond`, mede a duração da resposta inicial por `Date.now()` e usa `editResponse` para editar a mesma mensagem com a latência em ms.

**Erros e limites:** a medida representa o tempo da resposta inicial, sem usar `client.ws.ping` e sem medir todas as condições de rede. Falha na resposta ou edição interrompe novos envios; o handler central não tenta repetir uma operação de resultado ambíguo.

### `/playlist`

**Fonte:** [playlist.js](../../commands/playlist.js). **Opções:** nenhuma.

Envia embed, um follow-up público com URL fixa da playlist Spotify `3FbsZmt8BrFFmVpKD4ju4H` e uma reação aleatória ao follow-up.

**Erros e limites:** compartilha link, sem consulta à API Spotify e sem reprodução de áudio. Falha da reação é capturada por `runSecondary` após as duas mensagens, sem provocar nova resposta. Disponibilidade da playlist `NOT_CONFIRMED`.

### `/qrcode`

**Fonte:** [qrcode.js](../../commands/qrcode.js). **Opções:** `link` — string obrigatória.

Defere publicamente antes de usar `qrcode.toFile()` para gerar `qrcode_${Date.now()}.png` no diretório de trabalho; envia como imagem anexa a um embed e tenta apagar o arquivo com `fs.unlinkSync()` depois da resposta. Usa `qrcode` e `fs`; não acessa o endereço codificado.

**Erros e limites:** aceita texto arbitrário sem validar URL; requer escrita no diretório de execução. `Date.now()` permite colisões no mesmo milissegundo. Falha de geração agora propaga ao tratamento central e interrompe o envio do anexo ausente. A exclusão após sucesso é protegida por `runSecondary`, sem nova resposta em caso de falha. Não há `finally`: falha de geração/envio ou limpeza recusada ainda pode deixar arquivo no disco (R10 residual).

### `/question`

**Fonte:** [question.js](../../commands/question.js). **Opções:** `pergunta` — string obrigatória; descrição solicita inglês.

Defere publicamente antes de axios GET via `getJson` em `https://api.stackexchange.com/2.3/search`, com prazo total de 5000 ms, `order=desc`, `sort=activity`, `intitle` codificado e `site=stackoverflow`. Exibe título e link do **primeiro resultado por atividade**, sem buscar o conteúdo da resposta. Não há IA nem resposta automática à pergunta.

**Erros e limites:** entrada vazia recebe resposta efêmera imediata, sem defer/HTTP; ausência de resultados e exceções/timeout também permanecem efêmeros após defer público. Não há controle de quota/backoff. Variável `answerLink` é calculada e não usada; o campo “Answer link” aponta para a própria pergunta. Idioma inglês é solicitado, sem validação ou tradução.

### `/repositorys`

**Fonte:** [repositorys.js](../../commands/repositorys.js). **Opções:** `linguagem` — string obrigatória. O nome público é exatamente `repositorys`.

Defere publicamente antes de axios GET via `getJson` em `https://api.github.com/search/repositories?q=language:${linguagem}&sort=stars&order=desc`, com prazo total de 5000 ms. Seleciona até cinco itens e envia texto público com nome completo, link e estrelas. Ausência de resultados recebe mensagem pública.

**Erros e limites:** a entrada não é codificada na URL, permitindo caracteres que alteram a consulta. Não há autenticação nem tratamento específico de rate limit. Falha HTTP/timeout mantém erro público, sem log bruto. Não garante cinco resultados se houver menos.

### `/servercount`

**Fonte:** [servercount.js](../../commands/servercount.js). **Opções:** nenhuma.

Envia embed com `interaction.client.guilds.cache.size`. Não consulta armazenamento histórico ou serviço de métricas externo.

**Erros e limites:** representa o cache do cliente/processo atual; não agrega shards e não é inventário histórico. Não há catch local.

### `/status`

**Fonte:** [status.js](../../commands/status.js). **Opções:** `url` — string obrigatória.

Adiciona `https://` a domínios sem esquema e preserva `url` obrigatória, nome, descrição e contrato `data`/`execute`. Faz GET usando [status-http.js](../../lib/status-http.js) e HTTP/HTTPS nativos do Node. Aceita somente HTTP(S), sem credenciais; canoniza IPs alternativos, bloqueia localhost e destinos privados, loopback, link-local, metadata e faixas especiais IPv4/IPv6. Valida todos os endereços retornados pelo DNS; qualquer resposta não pública recusa a consulta inteira. Conecta diretamente ao primeiro IP aprovado, sem nova resolução, preservando Host e domínio original para SNI/certificado TLS; não usa proxy/agente global nem segue redirecionamentos.

Prazo de **5000 ms** cobre DNS, conexão, TLS e corpo; limites de **1 MiB** de corpo bruto, **16 KiB** de cabeçalhos e **2048 caracteres** de entrada. Corpo é descartado sem descompressão; respostas contêm somente origem (protocolo/domínio/porta) e status numérico, sem caminho, query, fragmento, cabeçalhos ou detalhes internos. HTTP 2xx gera embed verde “Online”; 3xx/4xx/5xx mantém embed vermelho “Offline ou inacessível” com o código recebido. Falhas de validação/DNS/conexão/timeout/limite geram mensagem genérica vermelha, sem repetir a entrada. P1.2 adiciona defer público antes da consulta e conclui com `respond`; todos os ramos continuam públicos, sem retry de envio.

**Erros e limites:** R06 `RESOLVED` no escopo dos testes controlados, incluindo transporte nativo com sockets em memória e prova do IP conectado; o helper SSRF não foi alterado em P1.2. A política conservadora recusa todo IPv4-mapped IPv6, tradução/transição e alguns blocos especiais globalmente roteáveis. Não há fallback entre IPs públicos nem redirects; sites online podem ser recusados por essas restrições ou pelos limites. Não há allowlist fixa de domínios. A semântica antiga para HTTP não 2xx foi preservada e não comprova indisponibilidade do servidor. O prazo HTTP agora ocorre após o reconhecimento, e falha de envio é marcada para o tratamento central não repetir a tentativa. Consultas reais e operação no Discord permanecem `NOT_CONFIRMED`.

### `/timer`

**Fonte:** [timer.js](../../commands/timer.js) e [timers.js](../../lib/timers.js). **Subcomandos:** `set` com `tempo` — integer obrigatório em minutos; `stop` sem opções. Builders e descrições preservados, sem valor padrão nem novos limites no payload slash. Na execução, aceita somente inteiros seguros de **1 a 1440 minutos**, sem coerção; o máximo equivale a 86400000 ms, abaixo do limite do timeout Node.

Mantém Map em memória com um timer por **usuário+servidor**, ou **usuário+canal de DM**. No mesmo servidor, `set` substitui o timer anterior mesmo quando chamado em outro canal; o aviso usa o canal da nova definição. Agendar a substituição ocorre antes de cancelar o anterior, preservado se o scheduler falhar. Duração/contexto inválidos recebem aviso efêmero e não alteram um timer válido; início e cancelamento válidos mantêm mensagens públicas. `stop` atua somente no contexto atual; ausência de timer, inclusive após expiração, mantém aviso efêmero. Escopo estabelecido no [ADR 0001](decisions/0001-isolamento-dos-timers.md).

Ao expirar, remove o agendamento **antes** de aguardar o envio ao canal. Uma identidade por agendamento torna callbacks cancelados/substituídos inofensivos e impede um envio antigo, concluído ou falho, de apagar um timer novo. O callback conserva somente canal e conteúdo, sem a interação/token. Falhas síncronas e rejeições do envio são capturadas com log fixo, sem retry ou nova resposta pela interação.

**Erros e limites:** R08 corrigido no escopo local descrito em [QUALITY_GATES](QUALITY_GATES.md). Estado continua volátil e se perde ao reiniciar; não há persistência, sincronização entre processos nem garantia de horário exato. `stop` não desfaz uma notificação cujo envio já começou. Falha na confirmação Discord mantém o efeito local de definir/cancelar, pois a entrega pode ter ocorrido; não há transação ou rollback automático. A exposição de estado entre servidores de `/todo` permanece um risco separado de R09.

### `/todo`

**Fonte:** [todo.js](../../commands/todo.js). **Subcomandos:** `add` com `tarefa` — string obrigatória; `list` sem opções; `remove` com `numero` — integer obrigatório, posição começando em 1.

Usa `Map<userId, array>` em memória. `add` bloqueia duplicata textual exata, acrescenta e confirma em embed; `list` enumera as tarefas; `remove` valida faixa, remove por índice e confirma. Duplicata, lista vazia e posição inválida geram mensagens efêmeras. Confirmações normais e lista são públicas.

**Erros e limites:** reinício perde todas as listas. A mesma lista do usuário é acessível em diferentes servidores, sem isolamento ou persistência. Não limita tarefas/tamanho nem divide embeds longos. Não há catch local. Inserção/remoção acontece antes de responder, podendo alterar a memória mesmo se o envio falhar.

### `/translate`

**Fonte:** [translate.js](../../commands/translate.js). **Opções:** `idioma` — string obrigatória com sigla de destino; `texto` — string obrigatória.

Importa `SlashCommandBuilder` de `@discordjs/builders` (dependência transitiva de discord.js). Defere publicamente e usa axios via `getJson` para consultar `https://translate.googleapis.com/translate_a/single`, com prazo total de 5000 ms, `client=gtx`, `sl=auto`, `tl=${idioma}`, `dt=t` e texto codificado em `q`. Extrai apenas `response.data[0][0][0]` e responde publicamente com menção ao usuário e tradução.

**Erros e limites:** não valida idioma nem codifica a sigla e pressupõe formato específico do corpo. Pode descartar segmentos adicionais da tradução. Não existe chave/configuração de Google Cloud no projeto; contrato, estabilidade e uso permitido desse endpoint são `NOT_CONFIRMED`. Falha HTTP/timeout/corpo inesperado mantém erro efêmero, sem log bruto, mesmo após defer público. A importação depende da resolução de um pacote não declarado diretamente.

### `/vote`

**Fonte:** [vote.js](../../commands/vote.js). **Opções:** nenhuma.

Envia embed, botão para `https://top.gg/bot/1193011045577523300` e reação de estrela. Não consulta API top.gg e não confirma se o usuário votou.

**Erros e limites:** aplicação no link é fixa, independente de `CLIENT_ID`. A reação depende de permissões e é protegida por `runSecondary`; falha posterior não provoca nova resposta. Disponibilidade da página `NOT_CONFIRMED`.

## Continuidade

Ao mudar nome, opções ou comportamento, atualize esta ficha e avalie impacto no registro global. Valide o contrato local conforme [QUALITY_GATES.md](QUALITY_GATES.md); o registro na API Discord exige autorização específica. Integrações, segurança e recuperação estão em [ARCHITECTURE.md](ARCHITECTURE.md), [KNOWN_RISKS.md](KNOWN_RISKS.md) e [OPERATIONS.md](OPERATIONS.md).
