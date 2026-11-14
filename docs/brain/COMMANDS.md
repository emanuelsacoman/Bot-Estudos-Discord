# Catálogo dos comandos

Auditoria inicial de 2026-11-07, código-base `cea09b90889716b5b05139eaf06f8b0e858f179e`. Foram encontrados **23 comandos** em [commands/](../../commands/); na auditoria inicial, os 23 módulos foram carregados localmente e `data.toJSON()`, função `execute` e nomes únicos foram verificados. Atualização da Fase 1/P0 na mesma data, base `develop` / `02e22dd`: Node foi fixado em `24.22.2` e Prettier passou a dependência de produção; os fontes/contratos dos comandos não mudaram. Instalações limpas de desenvolvimento e produção com npm `11.19.1` passaram, assim como sintaxe, importação/serialização dos 23 módulos e igualdade do payload JSON com o baseline anterior à mudança; evidências em [QUALITY_GATES.md](QUALITY_GATES.md). Os comportamentos abaixo foram identificados no código; uso real no Discord e integrações externas permanecem `NOT_CONFIRMED`.

## Regras comuns

**Atualização P1.1 — 2026-11-07, base `develop` / `49138e6`:** `/status` passou a usar transporte seguro do Node; contratos slash dos 23 comandos continuam idênticos ao P0. Suíte permanente de SSRF/interação simulada e carregamento passa offline; resultados e limites em [QUALITY_GATES](QUALITY_GATES.md).

**Atualização P1.2 — 2026-11-07, base `develop` / `234f01b`:** todos os comandos passaram a usar a continuação compartilhada de respostas. Operações HTTP, formatação e geração/envio de arquivos têm reconhecimento prévio; nomes, opções, mensagens e visibilidade dos ramos existentes foram preservados. A P1.2 foi commitada em `a79f13a`.

**Atualização P1.3 — 2026-11-07, base `develop` / `a79f13a`:** validação compartilhada do catálogo no runtime/registro e ciclo de vida de `/timer` com duração e escopo controlados. Os nomes e opções slash permanecem iguais; a P1.3 foi commitada em `e233742`. Evidências e limites em [QUALITY_GATES](QUALITY_GATES.md).

**Atualização P2.2 — 2026-11-07, base `develop/cf65c14`:** `/todo` passa a usar listas por servidor+usuário e DM+usuário, com todas as respostas efêmeras e cotas agregadas por usuário. O texto de tarefas deixa de aparecer em erros de duplicata. Nomes/opções slash permanecem iguais; decisão em [ADR 0002](decisions/0002-privacidade-e-isolamento-do-todo.md). P2.1 já commitada; alterações P2.2 sem commit.

**Decisão Estado Temporário — 2026-11-07, base `develop/868774b`:** o [ADR 0003](decisions/0003-estado-operacional-temporario.md) aceita deliberadamente a perda de tarefas, timers e cooldowns após reinícios e mantém todo estado operacional exclusivamente em memória. Não se implementam bancos, arquivos de estado ou dependências/infraestrutura de persistência. Isolamento, privacidade, cotas e os 23 contratos permanecem iguais; esta atualização é documental, e a P2.2 já está commitada.

**Atualização P2.3 — 2026-11-08, base `develop/67c25a3`:** `/docs` e seu handler passam a consumir o catálogo único de tecnologias e o componente usa `codebucket:docs:select`. As 25 opções históricas e os 23 payloads slash são preservados. Menus antigos com `select` são ignorados e podem ser substituídos por nova execução de `/docs`; Laravel permanece apenas como registro histórico, sem opção/roteamento. Nenhuma persistência ou dependência nova. R14 `RESOLVED` no escopo offline: suíte 863/863, sintaxe 56/56 e 23 contratos/hash preservados. As 25 opções e mensagens foram comparadas com a base; somente a URL C++ mudou deliberadamente. Evidências em [QUALITY_GATES](QUALITY_GATES.md).

**Atualização P2.4 — 2026-11-13, base `develop/da6a413` (P2.3 já commitada):** confiabilidade das seis integrações externas e importação de builder de `/translate` via dependência direta `discord.js`, sem mudar os 23 payloads slash. R16 permanece `MITIGATED`: schema/quota/estabilidade dos serviços não são garantias do bot. Baseline executada em 2026-11-08: **863/863**, em Node **24.22.2**/npm **11.19.1**. Validação final em 2026-11-13: **1097/1097** testes, focais **282/282**, sintaxe **59/59** e 23 contratos/hash preservados; `/translate` com Unicode validado em instalações limpas normal/produção, sem rede. Auditoria e políticas em [Contratos externos](#contratos-externos--p24) e [qualidade](QUALITY_GATES.md).

- Todos os módulos exportam `data` e `execute(interaction)`. [command-catalog.js](../../lib/command-catalog.js) carrega e valida o mesmo conjunto para o [runtime](../../index.js) e o [registro global](../../deploy-commands.js): catálogo não vazio, contratos serializáveis, nomes/opções sem duplicatas e snapshot JSON válido. Falha bloqueia a preparação, sem aceitar catálogo parcial. Carregar ou serializar localmente não comprova registro remoto.
- Todas as opções de entrada documentadas são **obrigatórias**. Somente `/formatar` define escolhas fechadas; os demais textos são livres. Não há `setMinValue`, `setMaxValue`, `setMinLength` ou `setMaxLength` nos builders atuais.
- O runtime aplica cooldown de **5 segundos por comando e usuário**, comum a todos os servidores daquele processo. Nenhum módulo configura cooldown próprio. O timestamp é registrado antes de executar; uma execução que falha também consome o intervalo. Reiniciar perde os cooldowns. Menus não passam por esse controle.
- Respostas normais são públicas, exceto `/ping` e todas as operações de `/todo`. Respostas efêmeras específicas são indicadas abaixo; o bloqueio de cooldown também é efêmero.
- [interactions.js](../../lib/interactions.js) usa `reply()` antes do reconhecimento, `editReply()` após defer ainda pendente e `followUp()` depois de uma resposta concluída. Os sete comandos HTTP deferem antes da consulta; `/question` sem pergunta e `/http` 1xx respondem imediatamente. `/formatar`, `/qrcode` e o envio de anexos de `/lofiradio` também deferem antes do trabalho demorado.
- A privacidade do reconhecimento original é imutável. Quando um ramo efêmero sucede defer público, o helper edita o loading com U+200B neutro, envia o conteúdo privado em follow-up com flag 64 e remove o placeholder. Nenhum erro privado é colocado na resposta pública; uma falha nessa sequência interrompe novas tentativas e pode deixar o placeholder neutro.
- Os seis comandos de APIs usam prazo total de **5000 ms** via [http-client.js](../../lib/http-client.js), incluindo leitura do JSON de `/github`, agora com corpo até 1 MiB antes do parse; `/status` mantém seu prazo e todas as proteções SSRF próprias. Não há retry automático. Falhas HTTP são convertidas em erros classificados sem corpo, URL ou configuração remota. P2.4 acrescenta JSON estrito, validação de status, zero redirects e pausas temporárias para limites de serviço, sem esperar ou reenviar a operação.
- O listener trata erros conforme o estado da interação, sem repetir envios que falharam ou já foram reportados. Expiração local (3 s sem reconhecimento ou 15 min para interação reconhecida, desde a criação) e códigos terminais impedem novo envio. O erro central inicial continua público; depois do reconhecimento herda a visibilidade estabelecida. Reações usam `runSecondary`; QR agora usa somente Buffer sem exclusão; o manager de timers captura seu próprio envio tardio depois de remover o estado. Consulte [KNOWN_RISKS.md](KNOWN_RISKS.md).
- Todos dependem de `discord.js`, incluindo o builder de `/translate` desde a P2.4. Permissões de acesso ao canal, envio, embeds, anexos e reações devem ser verificadas conforme o recurso usado. Os builders não impõem permissões administrativas ou restrição explícita a servidores.

## Limites e mudanças P2.1

Base `develop/e233742`, 2026-11-07. **Os 23 payloads slash permanecem idênticos**, inclusive nomes, opções e descrições; as regras abaixo são validações em execute. Entradas normais mantêm mensagens/visibilidade. Entradas vazias, tipos incorretos, Unicode malformado e excesso recebem rejeição informativa; não há corte silencioso. Anexos de texto são Buffers UTF-8 com dados completos, sem arquivos temporários.

| Limite | Origem / comportamento |
| --- | --- |
| Mensagem 2000; título/nome de campo/autor 256; descrição 4096; valor de campo 1024; 25 campos; rodapé 2048; soma de embed 6000 | [Discord oficial](https://docs.discord.com/developers/resources/message#embed-object-embed-limits), conferido nos builders. Conta unidades UTF-16 conservadoramente, sem dividir pares surrogate/emojis. Campos e soma são verificados antes da construção do embed; resultado extenso vai integral para anexo. |
| String geral até 6000 | Teto de [opção string Discord](https://docs.discord.com/developers/interactions/application-commands#application-command-object-application-command-option-structure), validado também em execução direta; regras mais específicas abaixo prevalecem. |
| URLs recebidas de APIs até 2048 unidades UTF-16 | Política local conservadora para links/URLs de imagens exibidos nos embeds, alinhada ao orçamento de entrada de URL já usado por /status; não é limite universal de URL/Discord. Exige HTTP(S) sem credenciais; recusa excesso/tipo inesperado, sem truncar ou consultar a URL recebida. |
| Corpo HTTP e anexo de texto até 1 MiB UTF-8 cada | Política local de recurso para respostas de metadados, consistente com budget já usado por /status. Axios conta após descompressão antes do parse; fetch lê fluxo contado/cancelável. Mantém prazo 5 s e erros sanitizados. Não é quota da API remota ou teto global de heap/concorrência. |
| QR até 5596 unidades UTF-16; capacidade efetiva depende do modo/UTF-8 | Máximo numérico versão 40/M da biblioteca; encoder recusa capacidades menores dos outros modos sem gerar anexo inválido. PNG/correção M preservados, texto continua livre (não exige URL). Descrição extensa transfere conteúdo completo a texto anexo junto do PNG. |
| Todo: 1967 por tarefa | Derivado na P2.1 de 2000 menos prefixo/sufixo da antiga mensagem de duplicata, preservado como cota de compatibilidade na P2.2. O erro de duplicata agora é genérico e não repete a tarefa. |
| Todo: 100 itens e 64 KiB de texto UTF-8 por usuário; 8 MiB de texto UTF-8/processo; 1024 usuários distintos com tarefas | Na P2.2, os 100 itens e 64 KiB são somados entre todos os servidores e DM do mesmo usuário; cada lista também respeita esses tetos. 1024 conta pessoas, não pares servidor+usuário; contextos não vazios são limitados pelas tarefas. 8 MiB continua compartilhado por todo o processo. Não são limites Discord nem medição exata de heap. Ao atingir, recusa nova inserção sem expulsar dados; remoção libera contagens/bytes e apaga contexto/usuário vazios. Leitura vazia não aloca. |

Mudanças adicionais de segurança: idioma deve ter sintaxe de sigla/tag com hífens (ex.: pt-BR), repositório deve ter forma usuario/repositorio, códigos de moeda três letras, valor/taxas/produto finitos e código HTTP inteiro 100–599. Isso valida formato, sem comprovar suporte/existência remota. Parâmetros interpolados de busca/tradução são codificados. APIs com forma inesperada ou corpo acima do budget recebem os erros sanitizados existentes, sem publicar saída parcial. /translate passa a unir todos os segmentos, corrigindo a perda anterior. /github passa a exibir fallbacks para descrição/linguagem ausentes. Na P2.4, o import transitivo é substituído por discord.js e falhas/quota recebem tratamento delimitado; R16 permanece mitigado quanto aos contratos/quotas externos não garantidos.

A falha de envio não é reinterpretada como falha de API/formatação nem repetida. /todo prepara a resposta antes de mudar a memória; uma falha de confirmação mantém o efeito local, pois a entrega pode ter ocorrido. A P2.2 altera sua privacidade/escopo conforme a ficha abaixo e o [ADR 0002](decisions/0002-privacidade-e-isolamento-do-todo.md). Permissão para anexos é necessária também nos fallbacks extensos; entrega real `NOT_CONFIRMED`. R04/R05/R06/R07/R08/R13 preservados.

## Contratos externos — P2.4

Auditoria de fontes em **2026-11-08**, conferida com o código na retomada de **2026-11-13**. A tabela descreve o contrato mínimo consumido pelo código e o comportamento implementado e testado offline na P2.4; a evidência de execução está separada em [QUALITY_GATES](QUALITY_GATES.md). Campos extras não são usados como dados confiáveis. Sucessos mantêm a visibilidade anterior; falhas de `/github` e `/repositorys` são públicas, enquanto erros de `/question`, `/translate`, `/moeda` e `/http` são efêmeros. Nenhum corpo/URL de requisição/erro bruto é publicado ou registrado.

| Integração e endpoint GET | Formato, campos obrigatórios/opcionais e vazio | HTTP, indisponibilidade e compatibilidade |
| --- | --- | --- |
| `/github` — `https://api.github.com/repos/{owner}/{repo}` | HTTP 200 com objeto: `owner.login`, `owner.avatar_url`, `full_name`, `html_url`, `stargazers_count` e `forks_count`. Contagens inteiras seguras ≥0; URLs HTTP(S) válidas sem credenciais. `description`/`language` podem faltar, ser null ou vazias e recebem fallback. Objeto ausente não é sucesso vazio. | 404 mantém recurso não encontrado; 400/422 indicam pedido recusado; 401/403 indicam acesso recusado ou limite quando reconhecido; 429 indica limite temporário; 5xx indica indisponibilidade. O 404 do GitHub também pode ocultar recurso privado: não comprova inexistência global. |
| `/repositorys` — `https://api.github.com/search/repositories?q=language:{linguagem}&sort=stars&order=desc` | `items` array; até cinco itens consumidos exigem `full_name`, `html_url` e contagem `stargazers_count` válida. `items: []` é resultado vazio válido. `incomplete_results`, quando presente, deve ser booleano; true produz aviso de resultado parcial. | 400/422 podem recusar consulta; 401/403/429 não viram “sem resultados”. 5xx recebe aviso de serviço indisponível. Busca é limitada e pode ser parcial mesmo com HTTP 200; não se percorrem páginas adicionais. |
| `/question` — `https://api.stackexchange.com/2.3/search?order=desc&sort=activity&intitle={pergunta}&site=stackoverflow` | Wrapper com `items`; primeiro item exige `title`/`link` válidos. `items: []` mantém ausência privada. `error_*`, `quota_remaining` e `backoff` são validados quando presentes. Erro no wrapper não vira sucesso/ausência, mesmo sob 200. | Diferencia pedido/acesso recusado, limite e indisponibilidade. `error_id` é código do wrapper e não status HTTP: 502 significa throttle e 503 indisponibilidade temporária. `backoff` válido impõe pausa para chamadas seguintes ao mesmo método, inclusive se esta resposta traz dados válidos. |
| `/translate` — `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl={idioma}&dt=t&q={texto}` | Array com `data[0]` como array não vazio de segmentos; cada `segment[0]` deve ser string Unicode bem formada. Concatena todos os segmentos em ordem, resultado final não vazio; demais posições são ignoradas. | 400/422, 401/403, 429 e 5xx recebem mensagens de falha apropriadas, privadas. Array vazio não é tradução válida. O endpoint gtx não é a interface REST documentada da Cloud Translation; suporte formal, idiomas, termos, quota e estabilidade desse endpoint permanecem `NOT_CONFIRMED`. |
| `/moeda` — `https://api.exchangerate-api.com/v4/latest/{ORIGEM}` | Objeto `rates`; propriedade própria `rates[DESTINO]` com número positivo finito, produto finito. `base`, quando presente, precisa coincidir com a origem. Destino ausente é aviso privado; taxa presente null/zero/tipo errado indica contrato inválido. Tabela ausente ou vazia é contrato inválido; ausência de destino não comprova inexistência global da moeda. | 404 conserva aviso de origem inválida sem comprovar suporte do provedor; demais 400/401/403/429/5xx são classificados. Precisão/atualidade e contrato/quota da interface v4 aberta não são garantidos. Não se substitui o endpoint nesta tarefa. |
| `/http` — `https://httpstat.us/{codigo}?json`, com `Accept: application/json` | Exige objeto `code` inteiro igual ao código solicitado e `description` textual válida. Códigos 1xx permanecem locais. Resposta 204/304 sem JSON ou corpo malformado recebe aviso seguro, sem inventar descrição. | Este serviço devolve deliberadamente o status solicitado: 400/401/403/404/429/500/503 coerentes podem ser resultado funcional válido. Status/corpo divergente não é mostrado como o código pedido. Quota e disponibilidade operacional são `NOT_CONFIRMED`. |

### Prazo, quota e retentativas

**Política local comum:** defer antes da consulta, prazo total de **5 s**, incluindo leitura/parse, e corpo de até **1 MiB**, contado antes do JSON e após descompressão no adapter axios. JSON inválido, UTF-8 inválido em ambos os transportes, schema incompleto/tipos inesperados, excesso, DNS/conexão, cancelamento e timeout viram falhas sanitizadas. Não há redirects ou retry automático, fila, espera por quota ou cache de resultados. O prazo limita trabalho assíncrono; não preempta JSON.parse ou outro JavaScript síncrono que bloqueie o event loop. A proteção SSRF de `/status` segue no transporte próprio e não usa este helper.

Pausas operacionais existem somente em memória. Um limite HTTP reconhecido de um host fixo pode adiar chamadas seguintes usando `Retry-After`/reset válido; sem indicação válida, **60 s** é uma política conservadora local, não reset garantido pelo provedor. A pausa por cabeçalho tem teto local de **24 h**; um prazo maior do provedor não é observado integralmente por esse mecanismo. Os cinco escopos são as quatro origens fixas GitHub, tradução, câmbio e httpstat.us, mais o método Stack Exchange search; GitHub compartilha a pausa entre seus dois comandos. `backoff` Stack Exchange é por método, com inteiro de 0–86400 s aceito pela política local; quota esgotada sem prazo conhecido também usa pausa conservadora. O bloqueio devolve aviso imediato, sem manter a interação esperando. Reinício perde essas pausas conforme [ADR 0003](decisions/0003-estado-operacional-temporario.md), e processos não as sincronizam. Pausa não garante quota disponível ao terminar nem cancela requisições já em curso.

**Políticas dos provedores consultadas:** GitHub documenta limite não autenticado por IP de 60/h e Search de 10/min, além de limites secundários; cabeçalhos orientam pausa em 403/429. O bot não conhece o consumo de outros processos no mesmo IP. Headers de GitHub explicitam `User-Agent: CodeBucket`, `Accept: application/vnd.github+json` e versão `2022-11-28`, igual ao default documentado, sem migrar a API. Stack Exchange compartilha quota sem token por IP e exige respeitar `backoff`; a cota padrão documentada não é saldo reservado ao bot. Não se aplicam quotas Cloud Translation ao endpoint gtx nem quotas/schema do ExchangeRate v6 ao v4.

**Sem retry automático:** uma nova tentativa multiplicaria quota e precisaria caber no prazo total da interação; não há evidência que justifique isso neste escopo. Falhas de entrega Discord também não são repetidas. Resultados extensos continuam completos em anexos em Buffer, com limites Discord/Unicode anteriores preservados. Disponibilidade/permissões/entrega reais permanecem `NOT_CONFIRMED`.

### Referências dos provedores

Fontes primárias consultadas em **2026-11-08**, somente documentação/código público; nenhuma requisição funcional aos endpoints:

- GitHub: [repositório](https://docs.github.com/en/rest/repos/repos#get-a-repository), [busca](https://docs.github.com/en/rest/search/search), [limites](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api), [erros e cabeçalhos](https://docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api), [versões](https://docs.github.com/en/rest/about-the-rest-api/api-versions). A versão 2022-11-28 tem suporte documentado até 10/03/2028; sua fixação não garante disponibilidade permanente.
- Stack Exchange: [search](https://api.stackexchange.com/docs/search), [wrapper](https://api.stackexchange.com/docs/wrapper), [throttles](https://api.stackexchange.com/docs/throttle), [erros](https://api.stackexchange.com/docs/error-handling).
- Google: [REST formal da Cloud Translation](https://docs.cloud.google.com/translate/docs/reference/rest), que descreve recursos distintos de `translate_a/single`. Não há contrato formal confirmado para o endpoint gtx consumido.
- ExchangeRate: [Open Access atual](https://www.exchangerate-api.com/docs/free) descreve `open.er-api.com/v6/latest`; [LTS](https://www.exchangerate-api.com/product/long-term-support) restringe a garantia a clientes pagantes, excluindo interfaces abertas/gratuitas. Não se infere garantia de v4 nem se implementa migração automaticamente.
- httpstat.us: [projeto oficial](https://github.com/aaronpowell/httpstatus), [serialização JSON/corpos ausentes](https://raw.githubusercontent.com/aaronpowell/httpstatus/main/src/Teapot.Web/CustomHttpStatusCodeResult.cs), [roteamento](https://raw.githubusercontent.com/aaronpowell/httpstatus/main/src/Teapot.Web/StatusExtensions.cs). Fonte upstream não comprova configuração/limites do serviço hospedado.

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

**Erros e limites:** rejeita texto vazio/inválido/acima de 6000 antes da contagem. Letras acentuadas não entram na contagem de letras; `_` entra no grupo de letras/números; o total de caracteres segue unidades UTF-16 do JavaScript. Não há catch local nem definição própria de contagem Unicode.

### `/docs`

**Fonte:** [docs.js](../../commands/docs.js), [catálogo único](../../lib/documentation-catalog.js) e [handler de seleção](../../lib/documentation-interactions.js), delegado por [index.js](../../index.js). **Opções slash:** nenhuma; nome `docs` e descrição “Acesse as documentações que quiser” preservados.

Envia o mesmo embed, placeholder e menu de seleção com `customId="codebucket:docs:select"`. Os 25 valores disponíveis são `angular`, `csharp`, `cpp`, `css`, `dart`, `discordjs`, `git`, `go`, `godot`, `html`, `ionic`, `java`, `javascript`, `kotlin`, `python`, `react`, `ruby`, `swift`, `typescript`, `unreal`, `unity`, `rust`, `php`, `vuejs` e `jquery`.

O catálogo determina IDs, labels, descrições, URLs e ordem pela posição no array; o menu e o lookup do handler derivam das mesmas entradas. Para adicionar, editar, remover ou reordenar uma tecnologia, altere apenas [documentation-catalog.js](../../lib/documentation-catalog.js) e execute a suíte offline. Há no máximo 25 opções: o validador recusa a 26ª, sem paginação automática. Laravel existia apenas no mapa anterior e foi retirado do roteamento; não é acrescentado ao menu nem aceito como seleção.

O handler exige string select com o identificador correto e array contendo exatamente uma string conhecida. Responde publicamente com o texto/link existente usando `respond`; URLs são estáticas e o bot não consulta o conteúdo das documentações. C++ passa do agregador DevDocs para a FAQ da [Standard C++ Foundation](https://isocpp.org/faq); os demais destinos históricos são preservados nesta etapa.

**Erros e limites:** validação local recusa IDs não canônicos/duplicados, catálogo vazio/acima de 25, labels/descrições inválidos/acima de 100 unidades UTF-16, URLs HTTPS inválidas/com credenciais e resposta acima de 2000. Seleção malformada/desconhecida recebe “Opção não reconhecida.” sem publicar a entrada. Outros tipos/IDs de componentes são ignorados. Menus antigos com `customId="select"` também são ignorados: esse ID genérico não identifica a origem com segurança; execute `/docs` novamente para obter o menu atual. Não há edição/remoção automática de mensagens antigas nem restrição ao autor original. Falha de envio e expiração seguem as proteções do helper comum, sem retry ou exceção interna exposta. Disponibilidade/atualidade dos links e entrega real permanecem `NOT_CONFIRMED`.

### `/exercise`

**Fonte:** [exercise.js](../../commands/exercise.js). **Opções:** `linguagem` — string obrigatória, sem escolhas fechadas.

P2.1 valida linguagem não vazia/Unicode bem formado até 6000; resultado cujo título ultrapassa 256 segue em exercicio.txt integral. Converte a entrada para minúsculas e sorteia um enunciado no banco local. Aliases aceitos:

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

**Erros e limites:** P2.1 valida código não vazio até 6000 e parser entre as cinco choices. Campo de até 1024 inclui cercas/linguagem; saída maior ou contendo cercas Markdown é anexada integralmente como codigo-formatado com extensão apropriada. Não executa código. Falhas do Prettier mantêm erro efêmero de sintaxe; saída inválida/acima de 1 MiB recebe aviso específico para reduzir o código. Envio fora do catch impede retry/confusão com erro de sintaxe. Anexo tem budget local de 1 MiB.

### `/git`

**Fonte:** [git.js](../../commands/git.js). **Opções:** nenhuma.

Retorna embed estático com referências a `init`, `clone`, `stash`, `status`, `add`, `commit`, `branch`, `switch -c`, `merge`, `push`, `pull`, `remote` e `config`, incluindo variações desses comandos. Não executa comandos Git e não consulta o repositório local.

**Erros e limites:** o embed e o timestamp são construídos uma vez no carregamento do módulo. Não há catch local; a referência textual precisa de revisão se seu conteúdo for alterado.

### `/github`

**Fonte:** [github.js](../../commands/github.js). **Opção:** `repositorio` string obrigatória no formato usuario/repositorio, até 6000, sem espaços/query/caminho adicional.

Defer público e fetchJson na API GitHub, com os headers explícitos e contrato da [auditoria P2.4](#contratos-externos--p24). Resposta válida mantém embed, fallbacks de descrição/linguagem e repositorio.txt completo quando extenso. Apenas 404 recebe “Repositório não encontrado.”; 403/429 e 5xx são diferenciados de inexistência. Falhas de consulta/schema continuam públicas e sanitizadas. Envio fora do catch, sem retry. Formato local não comprova existência remota ou acesso a recurso privado.

### `/help`

**Fonte:** [help.js](../../commands/help.js). **Opções:** nenhuma.

Lê `interaction.client.commands` e monta um campo de embed para cada nome/descrição carregado. Não faz consulta à lista registrada na API Discord.

**Erros e limites:** não apresenta parâmetros nem subcomandos. São 23 campos no catálogo atual; P2.1 envia comandos.txt integral se ultrapassar limites individuais/25 campos/6000 totais. Sem consulta ao catálogo remoto.

### `/http`

**Fonte:** [http.js](../../commands/http.js). **Opção:** `codigo` integer obrigatório; execute exige inteiro 100–599.

1xx continua local imediato. Demais valores deferem publicamente e usam getJson/axios no mesmo httpstat.us, com `Accept: application/json`, 5 s/1 MiB e tratamento do status solicitado descrito na [auditoria P2.4](#contratos-externos--p24). O corpo deve identificar exatamente o código pedido; 4xx/5xx coerente é resultado funcional, divergência é recusada. Corpo ausente ou JSON inválido recebe aviso privado; não se inventa descrição para 204/304. Embed/campos/cor e fallback integral codigo-http.txt preservados.

Entrada inválida, limite real do serviço, indisponibilidade e falha inesperada têm avisos efêmeros sanitizados, inclusive após defer público. Falha de envio não é reinterpretada como erro de consulta nem repetida. Disponibilidade/contrato remoto `NOT_CONFIRMED`.

### `/invite`

**Fonte:** [invite.js](../../commands/invite.js). **Opções:** nenhuma.

Exibe embed e botão OAuth com `process.env.INVITE_URL` ou fallback público com aplicação `1193011045577523300`, `permissions=0` e scopes `bot applications.commands`; adiciona reação de coração.

**Erros e limites:** o fallback não deriva de `CLIENT_ID` e pode apontar para outra aplicação. Permissões zero na URL não garantem os recursos de anexos e reações. URL inválida pode falhar antes da resposta; a reação posterior é protegida por `runSecondary`, sem nova mensagem de erro ao usuário. O bot apenas compartilha o link, sem alterar instalação remota nesta execução.

### `/lofiradio`

**Fonte:** [lofiradio.js](../../commands/lofiradio.js). **Opções:** nenhuma.

Usa `process.env.LOFIRADIO_URL` ou `https://lofiradio.web.app`, prepara embed com botão e anexa [lofiicon.png](../../images/lofiicon.png) e [lofiradio.jpeg](../../images/lofiradio.jpeg). Caminhos são montados com `path` e `__dirname`; defer público precede o envio dos anexos.

**Erros e limites:** apenas compartilha um site externo; não transmite áudio e não entra em canal de voz. Depende dos dois arquivos e da permissão de anexar/mostrar embeds. Falha ao preparar o conteúdo gera erro efêmero antes do defer; falha no envio não provoca uma segunda mensagem. Disponibilidade e estações do site não foram verificadas.

### `/moeda`

**Fonte:** [moeda.js](../../commands/moeda.js). **Opções:** `valor` number obrigatório; `origem`/`destino` strings obrigatórias de três letras, convertidas para maiúsculas, sem trim. Valor finito negativo/zero continua aceito.

Defer público e getJson no mesmo endpoint v4 da [auditoria P2.4](#contratos-externos--p24), 5 s/1 MiB. Valida tabela e taxa própria positiva finita, produto finito e `base` coerente quando informado. Ausência do destino mantém aviso privado; taxa presente null/zero/tipo errado recebe falha de contrato. Cálculo preserva `toFixed(2)` e embed público.

404 conserva aviso privado de origem inválida; outras falhas HTTP, limite, timeout/cancelamento e dados inesperados recebem erro classificado privado, sem corpo/URL/erro bruto. Falha de envio não repete resposta. Precisão/atualidade, quota e suporte formal do v4 aberto permanecem `NOT_CONFIRMED`; nenhuma migração de API nesta entrega.

### `/ping`

**Fonte:** [ping.js](../../commands/ping.js). **Opções:** nenhuma.

Responde **efemeramente** com “Pong!” via `respond`, mede a duração da resposta inicial por `Date.now()` e usa `editResponse` para editar a mesma mensagem com a latência em ms.

**Erros e limites:** a medida representa o tempo da resposta inicial, sem usar `client.ws.ping` e sem medir todas as condições de rede. Falha na resposta ou edição interrompe novos envios; o handler central não tenta repetir uma operação de resultado ambíguo.

### `/playlist`

**Fonte:** [playlist.js](../../commands/playlist.js). **Opções:** nenhuma.

Envia embed, um follow-up público com URL fixa da playlist Spotify `3FbsZmt8BrFFmVpKD4ju4H` e uma reação aleatória ao follow-up.

**Erros e limites:** compartilha link, sem consulta à API Spotify e sem reprodução de áudio. Falha da reação é capturada por `runSecondary` após as duas mensagens, sem provocar nova resposta. Disponibilidade da playlist `NOT_CONFIRMED`.

### `/qrcode`

**Fonte:** [qrcode.js](../../commands/qrcode.js). **Opção:** `link` string obrigatória, preservada; continua aceitando texto livre, sem acessar o endereço.

P2.1 valida texto não vazio/Unicode bem formado até 5596 (máximo numérico versão 40/M), defere publicamente e gera PNG com qrcode.toBuffer, correção M padrão. Limites menores por modo/bytes são tratados pelo encoder com aviso privado pedindo reduzir o texto. Nome qrcode.png é local ao anexo de cada mensagem; Buffers independentes não compartilham caminho. Não há fs, diretório temporário, cwd ou cleanup. Descrição que exceda 4096 transfere o texto original completo para conteudo-qrcode.txt junto do PNG.

Falha de geração recebe erro privado sanitizado após defer; falha de envio propaga ao helper, sem retry/novo arquivo. R10 resolvido localmente por testes de PNG real em memória, falhas/concorrência e guardas de filesystem; permissões/entrega reais `NOT_CONFIRMED`.

### `/question`

**Fonte:** [question.js](../../commands/question.js). **Opção:** `pergunta` string obrigatória, não vazia/Unicode válido até 6000; consulta codificada. Idioma inglês é solicitado, sem validação/tradução.

Defer público e getJson no endpoint Stack Exchange descrito na [auditoria P2.4](#contratos-externos--p24), 5 s/1 MiB. Exibe título/link do primeiro resultado por atividade; o campo “Answer link” aponta para a pergunta, sem buscar resposta. Título/link são validados, excesso vira pergunta.txt integral. Wrapper de erro/quota/backoff é interpretado antes de tratar ausência de resultado; pausa por método vale para chamadas seguintes, inclusive se houve dados válidos nesta resposta.

Entrada inválida, lista vazia, erros de pedido/acesso, limite, indisponibilidade e dados inesperados mantêm resposta efêmera, inclusive após defer público. Backoff/quota não causam espera ou retry. Corpo/erro bruto não é publicado. Falha de envio permanece fora do catch e não repete resposta.

### `/repositorys`

**Fonte:** [repositorys.js](../../commands/repositorys.js). **Opção:** `linguagem` string obrigatória não vazia/Unicode válido até 6000; nome público `repositorys` preservado.

Defer público e getJson/axios na busca GitHub da [auditoria P2.4](#contratos-externos--p24), com consulta codificada, headers explícitos, 5 s/1 MiB. Valida os até cinco resultados exibidos. Lista vazia mantém mensagem de ausência; `incomplete_results: true` informa que a busca pode estar parcial. Texto extenso segue completo em repositorios.txt.

Não há autenticação nova ou paginação adicional. Pedido/acesso recusado, limite e indisponibilidade não viram “sem resultados”; falhas mantêm resposta pública sanitizada. Envio fora do catch, sem retry. Quotas compartilhadas por IP e comportamento remoto permanecem limitações externas.

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

**Erros e limites:** R08 corrigido no escopo local descrito em [QUALITY_GATES](QUALITY_GATES.md). Estado continua volátil e se perde ao reiniciar, comportamento conhecido e aceito no [ADR 0003](decisions/0003-estado-operacional-temporario.md); não há persistência, sincronização entre processos nem garantia de horário exato. `stop` não desfaz uma notificação cujo envio já começou. Falha na confirmação Discord mantém o efeito local de definir/cancelar, pois a entrega pode ter ocorrido; não há transação ou rollback automático. `/todo` tem decisão de escopo própria no ADR 0002; R09 permanece `MITIGATED`, com volatilidade deliberadamente aceita.

### `/todo`

**Fonte:** [todo.js](../../commands/todo.js) e [todo-store.js](../../lib/todo-store.js). **Subcomandos preservados:** add tarefa string, list, remove numero integer (posição a partir de 1).

**Isolamento P2.2:** estado em memória por `guildId + userId` nos servidores e `DM + userId` nas mensagens diretas. Canais do mesmo servidor compartilham a lista daquele usuário; DM não usa o canal na chave. Criação, listagem e remoção exigem o mesmo contexto explícito. Contexto inválido/ausente é recusado sem consultar uma lista global ou inferir DM; usuários/contextos não compartilham arrays nem números de remoção. Duplicata textual exata é verificada apenas na lista atual.

**Privacidade:** todas as respostas são efêmeras, incluindo confirmação de inclusão/remoção, listagem em embed ou arquivo, lista vazia e erros. Confirmações e listagem podem conter a tarefa, mas erros de duplicata/validação/capacidade usam texto fixo sem reproduzir conteúdo. Não há log de tarefas ou erro bruto. O helper preserva privacidade mesmo após defer público: edição neutra, follow-up privado e remoção do placeholder; dados pessoais não entram na edição pública. A mudança de visibilidade é intencional para tratar R09.

**Cotas/integridade:** 1967 unidades UTF-16 por tarefa; 100 tarefas e 64 KiB UTF-8 agregados por usuário entre todos os servidores e DM; 8 MiB de texto e 1024 usuários distintos por processo. Cotas esgotadas recusam só a nova inserção, sem expulsão/TTL/mesclagem silenciosa. Listagem até 4096 em embed; acima disso segue integral em tarefas.txt, com ordem e números preservados. Remove exige inteiro seguro no intervalo da lista atual, libera bytes/contagens e apaga contexto vazio; a última tarefa de todos os contextos libera o usuário. Leitura vazia não cria estado. São budgets de admissão de texto/cardinalidade, não medição exata de heap.

Resposta é preparada antes de inserir/remover; operações de estado são síncronas antes de aguardar o envio, tornando admissões concorrentes consistentes no processo. Falha de entrega mantém o efeito local já aplicado, sem retry. Reiniciar apaga todas as tarefas; não existe sincronização entre processos ou recuperação após falha de hospedagem. Essa perda é comportamento conhecido e aceito segundo o [ADR 0003](decisions/0003-estado-operacional-temporario.md); R09 continua `MITIGATED`. Persistência não é pendência técnica e não deve ser adicionada sob a política vigente; mudá-la exigiria decisão explícita que substitua o ADR 0003. Não há migração automática de listas globais antigas para servidores; a decisão documental não lê/apaga estado real nem reinicia o bot. Veja [ADR 0002](decisions/0002-privacidade-e-isolamento-do-todo.md) e [operações](OPERATIONS.md) antes de qualquer ativação autorizada.

### `/translate`

**Fonte:** [translate.js](../../commands/translate.js). **Opções preservadas:** `idioma`/`texto` strings obrigatórias. Builder importado de `discord.js`, dependência direta já declarada, sem adicionar/atualizar pacotes.

Texto não vazio/Unicode bem formado até 6000; idioma com sintaxe de sigla/tag (ex.: pt, pt-BR), ambos codificados na consulta. Defer público e getJson/axios no endpoint gtx da [auditoria P2.4](#contratos-externos--p24), 5 s/1 MiB. Valida array e segmentos, concatena todas as traduções em ordem e mantém menção ao usuário. Até 2000 em mensagem; acima, traducao.txt integral até 1 MiB UTF-8.

Entrada inválida, tradução vazia/inesperada, pedido/acesso recusado, limite, indisponibilidade, timeout/cancelamento e demais falhas recebem erro privado sanitizado. Falha de envio fora do catch não causa retry. Não há chave Google Cloud; não se atribui contrato/quota da API Cloud ao endpoint gtx. Idiomas, suporte formal, estabilidade/termos e disponibilidade permanecem `NOT_CONFIRMED`; R16 é `MITIGATED`.

### `/vote`

**Fonte:** [vote.js](../../commands/vote.js). **Opções:** nenhuma.

Envia embed, botão para `https://top.gg/bot/1193011045577523300` e reação de estrela. Não consulta API top.gg e não confirma se o usuário votou.

**Erros e limites:** aplicação no link é fixa, independente de `CLIENT_ID`. A reação depende de permissões e é protegida por `runSecondary`; falha posterior não provoca nova resposta. Disponibilidade da página `NOT_CONFIRMED`.

## Continuidade

Ao mudar nome, opções ou comportamento, atualize esta ficha e avalie impacto no registro global. Valide o contrato local conforme [QUALITY_GATES.md](QUALITY_GATES.md); o registro na API Discord exige autorização específica. Integrações, segurança e recuperação estão em [ARCHITECTURE.md](ARCHITECTURE.md), [KNOWN_RISKS.md](KNOWN_RISKS.md) e [OPERATIONS.md](OPERATIONS.md).
