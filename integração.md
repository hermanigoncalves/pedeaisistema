Arquitetura, Diagnosticabilidade de Erros e Mitigação de Banimento na Engine Evolution Go
Contexto Arquitetural e Visão Geral da Engine Evolution Go
A evolução das infraestruturas de integração com a rede do WhatsApp motivou a reconstrução do motor da Evolution Foundation em linguagem Go, dando origem ao Evolution Go1. Esta implementação foi concebida para substituir ou atuar como alternativa de alto rendimento à versão desenvolvida em Node.js e TypeScript1. A transição para a linguagem Go responde a requisitos operacionais de baixa latência e elevada concorrência em ambientes corporativos, reduzindo substancialmente o consumo de memória RAM através do uso de goroutines e da eliminação do overhead do ecossistema V81.
A arquitetura do Evolution Go baseia-se na biblioteca web Gin e utiliza a biblioteca whatsmeow para a comunicação direta com o protocolo do WhatsApp Web, dispensando a emulação de navegadores via Puppeteer1. A camada de persistência de dados é estruturada sobre o PostgreSQL com o ORM GORM, gerindo bases de dados distintas para autenticação, utilizadores e estados das instâncias1. O suporte para armazenamento de ficheiros multimédia é providenciado nativamente por serviços compatíveis com MinIO ou AWS S31. Para o streaming de eventos em tempo real, o motor implementa conexões via Webhooks, WebSockets e suporte nativo a brokers de mensageria como RabbitMQ (AMQP) e NATS1.



Ini, TOML
SERVER_PORT=8080
CLIENT_NAME=evolution
GLOBAL_API_KEY=sua_chave_global_segura

POSTGRES_AUTH_DB=postgresql://postgres:senha@localhost:5432/evogo_auth?sslmode=disable
POSTGRES_USERS_DB=postgresql://postgres:senha@localhost:5432/evogo_users?sslmode=disable
DATABASE_SAVE_MESSAGES=true

# AMQP_URL=amqp://guest:guest@localhost:5672/
# NATS_URL=nats://localhost:4222
# MINIO_ENABLED=true


A operação do Evolution Go depende de um ciclo de vida estrito de licenciamento5. Na inicialização do servidor, as rotas funcionais da API permanecem bloqueadas, retornando o código HTTP 503 Service Unavailable até que o processo de registo e ativação da licença seja concluído no painel gestor ou através dos endpoints dedicados de licenciamento5. O estado da ativação é armazenado de forma permanente na tabela runtime_configs do PostgreSQL, e a aplicação emite heartbeats periódicos a cada 30 minutos para manter a validação operacional e realizar o encerramento gracioso (graceful shutdown) quando necessário5.
Mapeamento de Rotas, Divergências de Protocolo e Modelos de Payload
A migração de sistemas desenvolvidos para a versão em Node.js (v2) para a engine em Go exige a reestruturação das chamadas HTTP, uma vez que a convenção de nomes e a distribuição de parâmetros nas URLs foram alteradas8. Na versão em Node.js, os endpoints de envio de mensagens utilizavam o nome da instância como um parâmetro de caminho (path parameter)8. No Evolution Go, a identificação da instância é transferida para o corpo (payload) do pedido JSON ou validada a partir dos parâmetros do cabeçalho (header) de autenticação9. A tentativa de utilizar rotas parametrizadas legadas resulta em falhas de encaminhamento com o código HTTP 404 Not Found9.
A estrutura de segurança divide os acessos em dois níveis distintos5. A chave global (GLOBAL_API_KEY) possui privilégios administrativos para criar, eliminar e configurar instâncias, gerir proxies e manipular licenças5. As chaves individuais de instância (instance tokens) delimitam o escopo de atuação para o envio de mensagens e consulta de estado do número pareado6.
Funcionalidade
Endpoint Evolution API v2 (Node.js)
Endpoint Evolution Go v3 (Go)
Estrutura Principal do Payload (Evolution Go)
Envio de Texto
POST /message/sendText/{instance}
POST /send/text
{"instance": "bot", "number": "55119...", "text": "Mensagem"}
[cite: 8, 9]
Envio de Mídia
POST /message/sendMedia/{instance}
POST /send/media
{"instance": "bot", "number": "55119...", "url": "https://..."}
[cite: 5, 8, 12]
Áudio PTT
POST /message/sendWhatsAppAudio/{instance}
POST /send/audio
{"instance": "bot", "number": "55119...", "url": "https://..."}
[cite: 10]
Status de Texto
Indisponível de forma unificada
POST /send/status/text
{"text": "Conteúdo do Status", "backgroundColor": "#000000"}
[cite: 11, 12]
Status de Mídia
Indisponível de forma unificada
POST /send/status/media
Suporta JSON contendo URL ou multipart/form-data
[cite: 11, 12]
Carrossel Interativo
Sem suporte nativo direto
POST /send/carousel
{"cards": [{"text": "Card", "buttons": [...]}]}
[cite: 11, 13]
Configuração de Proxy
POST /instance/update/{instance}
POST /instance/proxy/{instanceId}
{"host": "1.2.3.4", "port": 8080, "protocol": "http"}
[cite: 11]

O processamento de mensagens com citação (respostas diretas a mensagens anteriores) é suportado no Evolution Go no endpoint POST /send/text e nos endpoints de envio de mídia10. O payload aceita um objeto quoted contendo o parâmetro quoted.messageId e, opcionalmente, quoted.participant10. O serviço utiliza esses dados para construir a estrutura ContextInfo do Protobuf através da biblioteca whatsmeow, preenchendo os campos StanzaID e Participant no pacote transmitido10.



JSON
{
  "instance": "comercial",
  "number": "5511999999999",
  "text": "Resposta automatizada ao seu pedido.",
  "delay": 1200,
  "quoted": {
    "messageId": "3EB0C5A277F7F9B6C599"
  }
}


O endpoint POST /send/media suporta o envio de ficheiros por URL remota ou por cadeias de texto codificadas em Base6411. Quando o valor atribuído ao campo url não inicia por http:// ou https://, o motor interpreta o conteúdo como dados binários em Base64, realizando a descodificação na memória antes de submeter os ficheiros ao fluxo de envio da whatsmeow11.
Diagnosticabilidade e Análise Profunda de Falhas Operacionais
O Erro 463: NackCallerReachoutTimelocked e a Dinâmica de Tokens de Privacidade
O Erro 463 (NackCallerReachoutTimelocked) representa a falha de entrega mais crítica documentada em arquiteturas baseadas em whatsmeow e Baileys4. Não se trata de uma falha de sintaxe no código do cliente ou de uma interrupção de rede local, mas de um bloqueio temporário por limite de alcance (reach-out time-lock) aplicado pelos servidores da Meta quando uma conta emulada via WhatsApp Web tenta iniciar contacto com um destino sem histórico prévio de conversação4. O mecanismo de validação da Meta é executado internamente por meio de consultas GraphQL especificadas pela query WAWebMexFetchReachoutTimelockJobQuery15.
O protocolo do WhatsApp exige que o envio de mensagens para novos contactos contenha tokens de privacidade no pacote de transporte, conhecidos como tctoken (trusted contact token) e cstoken (caller signal token)4. A ausência destes tokens em mensagens direcionadas a contactos frios faz com que o servidor interprete o disparo como comunicação não solicitada, rejeitando a mensagem com o pacote NACK 4634.
Em versões do Evolution Go anteriores à incorporação da Pull Request #1081 da biblioteca whatsmeow, as mensagens recebidas de novos utilizadores contendo tctoken e cstoken não tinham os seus tokens devidamente persistidos na tabela whatsmeow_privacy_tokens da base de dados PostgreSQL4. Consequentemente, mesmo quando o utilizador enviava uma mensagem primeiro, as respostas subsequentes emitidas pela API falhavam por falta de injeção dos tokens no cabeçalho da stanza4.
O Erro 463 aciona a restrição do tipo RESTRICT_ALL_COMPANIONS na infraestrutura do WhatsApp4. Esta restrição afeta exclusivamente os dispositivos associados (linked devices), como a API, enquanto a aplicação oficial instalada no smartphone continua a operar normalmente4. Retentativas imediatas de envio com intervalos curtos (ex.: 2 segundos) falham continuamente4. A recuperação da capacidade de envio exige o cumprimento de um tempo de repouso nos servidores da Meta, variando entre alguns minutos e várias horas4.
Erro de Conexão Stream 515 e Desincronização de Sessões
Durante o processo de pareamento de instâncias através da leitura de QR Code, a comunicação WebSocket com o WhatsApp pode ser interrompida com o registo de stream:error de código 515 nos logs do contêiner18. Este evento ocorre quando o servidor do WhatsApp encerra abruptamente a sessão de sincronização durante a negociação de chaves criptográficas18.
A causa principal reside no acúmulo de registos órfãos e na violação de restrições de chave estrangeira na tabela IntegrationSession do PostgreSQL18. A remoção dessas linhas órfãs e o uso de pareamento por Código de Conexão (Pairing Code) em alternativa ao QR Code restabelecem a estabilidade da negociação criptográfica18.
Mensagens Presas em PENDING e Mapeamento de Identificadores LID/JID
A transição global do WhatsApp para identificadores anónimos do tipo LID (List Identifier - @lid) pode fazer com que mensagens enviadas para JIDs tradicionais (@s.whatsapp.net) permaneçam estagnadas no estado 1 (PENDING)17. Nessas situações, o servidor do WhatsApp aceita o pedido inicial da API, mas não emite a confirmação de recebimento no servidor (SERVER_ACK) nem o recibo de entrega (DELIVERY_ACK)17.
O Evolution Go (a partir da versão 0.7.1) implementa uma lógica de reversão automática de identificadores11. Quando uma mensagem de entrada é recebida com o formato @lid no remetente e o número de telefone real no campo SenderAlt, o motor inverte automaticamente as associações na base de dados, garantindo que as mensagens de saída sejam desempenhadas sobre o JID validado11. Se esta sincronização falhar, as mensagens ficam presas indeterminadamente sem transitar para o estado entregue17.
Falhas de Renderização em Mensagens Interativas
A utilização de endpoints interativos para envio de botões e listas passou por restrições rigorosas nas atualizações de clientes nativos do WhatsApp11. No Evolution Go, o envio de botões via /send/button encapsulados na estrutura ViewOnceMessage impedia a exibição em dispositivos iOS e no WhatsApp Web11. Da mesma forma, listas estruturadas sobre o nó NativeFlowMessage falhavam ao chegar ao destinatário, exibindo a mensagem "Atualize seu WhatsApp"13.
A solução adotada no ecossistema envolve a migração do envio de listas para a estrutura Protobuf nativa ListMessage e a utilização do endpoint POST /send/carousel para mensagens interativas com cartões, imagens e botões de ação11.

Código de Erro / Sintoma
Causa Raiz do Protocolo
Diagnóstico no Log / DB
Ação Corretiva Arquitetural
Erro 463 / NackCallerReachout
Ausência de tctoken/cstoken para contactos frios; restrição por disparo automatizado4.
Tabela whatsmeow_privacy_tokens vazia; registo de NACK 463 recebido4.
Atualizar o binário para versão com PR #1081 da whatsmeow; adotar modelo inbound-first4.
Stream Error 515
Falha de handshake criptográfico na sincronização de sessão via QR Code18.
Log de sistema indicando stream:error code: 515 durante a inicialização18.
Limpar registos em IntegrationSession; utilizar pareamento por Código de Conexão18.
Estagnado em PENDING
Mapeamento incorreto entre LID e JID; ausência de SERVER_ACK17.
Mensagens no banco de dados fixas em status = 1 sem progressão para status 2 ou 317.
Garantir versão  0.7.1 do motor Go; executar rotina de verificação de JID11.
Substituição por "Atualize seu WhatsApp"
Estrutura Protobuf incompatível ou envólucro ViewOnce em mensagens interativas11.
Notificação de erro visual no dispositivo do destinatário sem erro HTTP na API13.
Migrar envios com botões para o endpoint /send/carousel11.
HTTP 503 Service Unavailable
Instância operando sem ativação no sistema de licenciamento5.
Resposta HTTP 503 em chamadas aos endpoints funcionais /send/* ou /instance/*5.
Acessar o Manager (/manager/login) e concluir a ativação ou consumir /license/register5.

Matriz Integrada Antibanimento e Saúde da Instância
Algoritmos de Detecção da Meta e Riscos Operacionais
A infraestrutura de segurança da Meta analisa o tráfego da rede através de duas camadas de verificação: análise comportamental e análise estatística da conexão16. A camada comportamental avalia a assimetria entre mensagens enviadas e recebidas, a taxa de bloqueios e denúncias efetuadas pelos destinatários e a cadência de envio das mensagens16. A camada de rede avalia a estabilidade do Socket TCP, a reputação do endereço IP do servidor e a consistência das chaves criptográficas negociadas pela biblioteca16.
A ocorrência continuada do Erro 463 indica que a conta entrou em estado de suspeita nos sistemas da Meta16. O erro de operação mais dispendioso consiste em continuar enviando mensagens automatizadas enquanto a conta permanece sob a restrição do reach-out time-lock14. Forçar disparos durante esse período acelera a progressão da sanção, convertendo um bloqueio temporário de mensagens de saída num banimento permanente do número de telefone (hard ban)16.
O Paradigma Inbound-First e Arquitetura de Aquecimento
A estratégia mais eficiente para anular o risco de banimentos e prevenir o Erro 463 é a implementação do paradigma Inbound-First16. Este modelo inverte a dinâmica da comunicação: em vez de a instância iniciar contacto com uma lista de números frios, o fluxo de negócio é desenhado para que o cliente envie a primeira mensagem16. Quando o cliente inicia a conversa, o servidor do WhatsApp emite os tokens de privacidade necessários (tctoken), permitindo que a resposta do Evolution Go seja entregue sem ativar os gatilhos de segurança do reach-out time-lock4.
A operacionalização deste modelo é alcançada através da publicação de links diretos wa.me, integração de botões Click-to-WhatsApp em campanhas publicitárias, disponibilização de QR Codes em pontos de venda e inclusão de atalhos de atendimento em e-mails e páginas web16.
Para os cenários onde o envio ativo de mensagens é indispensável, os números novos precisam obrigatoriamente passar por um protocolo rigoroso de aquecimento (chip warm-up) antes de assumirem volumes operacionais expressivos16.

Fase do Protocolo
Período de Execução
Volume Máximo Diário
Proporção Mínima Inbound / Outbound
Intervalo Mínimo Entre Mensagens
Diretrizes Operacionais Obrigatórias
Fase 1: Maturação Inicial
Dias 1 a 7
20 a 30 mensagens
1:1 (50% entrada)
30 a 60 segundos
Apenas conversas bidirecionais reais com contactos conhecidos. Proibido uso de automação16.
Fase 2: Engajamento em Grupos
Dias 8 a 14
50 a 80 mensagens
Receptivo dominante
15 a 30 segundos
Participação ativa em grupos existentes. Troca mútua de mensagens e reações16.
Fase 3: Automação Controlada
Dias 15 a 21
150 a 300 mensagens
1:2 (33% entrada)
5 a 10 segundos
Início de fluxos automatizados. Proibido envio de links e conteúdos financeiros16.
Fase 4: Operação em Escala
Dia 22 em diante
Conforme Score de Saúde
Entrada constante
2 a 5 segundos
Aplicação de recuo exponencial (exponential backoff) em caso de flutuação de entrega4.

Salvaguardas Operacionais na Configuração do Engine
A configuração do engine deve incorporar salvaguardas rigorosas para simular o comportamento de utilizadores humanos e mitigar padrões automatizados. A cadência de envio deve ser controlada utilizando o parâmetro delay diretamente nos payloads das requisições, aplicando intervalos entre 1000ms e 2000ms para mensagens individuais e dilatando para 3000ms a 5000ms em envios sequenciais8.
O isolamento de rede é indispensável em infraestruturas que operam múltiplas instâncias no mesmo servidor11. A atribuição de proxies dedicados por instância através do endpoint POST /instance/proxy/{instanceId} impede que o bloqueio de um endereço IP impacte os restantes números da operação11.
O envio de conteúdos com alta conotação financeira, tais como chaves Pix, códigos de barras de boletos e dados de cartão de crédito para contactos frios apresenta a maior correlação com bloqueios automáticos16. Tais informações só devem ser transmitidas após a consolidação do primeiro turno de conversa iniciado pelo cliente16.
Adicionalmente, a aplicação receptora deve simular o consumo real de mídia e mensagens enviando os recibos de leitura através do endpoint POST /message/markread e de confirmação de áudio reproduzido via POST /message/markplayed (que emite o pacote ReceiptTypePlayed), mantendo a pontuação de integridade do número positiva junto aos servidores do WhatsApp16.
Guia de Integração Prática, Concorrência e Resiliência de Software
Arquitetura de Implantação e Mapeamento de Eventos
A integração do Evolution Go num ecossistema de produção exige uma infraestrutura contêinerizada focada em alta disponibilidade e desacoplamento de componentes1. A arquitetura recomendada combina o engine em Go com um servidor PostgreSQL para persistência de estado e um broker RabbitMQ para enfileiramento durável de eventos em tempo real1.



YAML
version: '3.8'

services:
  evolution-go:
    image: evoapicloud/evolution-go:latest
    container_name: evolution_go_engine
    restart: always
    ports:
      - "8080:8080"
    environment:
      - SERVER_PORT=8080
      - CLIENT_NAME=producao_engine
      - GLOBAL_API_KEY=sua_chave_global_extremamente_segura
      - POSTGRES_AUTH_DB=postgresql://evogo_user:SenhaSegura123@postgres_db:5432/evogo_auth?sslmode=disable
      - POSTGRES_USERS_DB=postgresql://evogo_user:SenhaSegura123@postgres_db:5432/evogo_users?sslmode=disable
      - DATABASE_SAVE_MESSAGES=true
      - AMQP_URL=amqp://guest:guest@rabbitmq_broker:5672/
      - WADEBUG=INFO
    depends_on:
      - postgres_db
      - rabbitmq_broker

  postgres_db:
    image: postgres:15-alpine
    container_name: postgres_db
    restart: always
    environment:
      - POSTGRES_USER=evogo_user
      - POSTGRES_PASSWORD=SenhaSegura123
      - POSTGRES_DB=evogo_auth
    volumes:
      - pgdata:/var/lib/postgresql/data

  rabbitmq_broker:
    image: rabbitmq:3-management-alpine
    container_name: rabbitmq_broker
    restart: always
    ports:
      - "5672:5672"
      - "15672:15672"

volumes:
  pgdata:


Para garantir o processamento confiável de eventos em tempo real, o ecossistema utiliza filas duráveis do tipo Quorum Queues no RabbitMQ6. As filas são nomeadas dinamicamente segundo a convenção {instanciaId}.{categoria}6. A aplicação principal deve consumir quatro filas fundamentais:
{instanciaId}.message: Recebe o fluxo de mensagens enviadas pelos utilizadores (MESSAGE_UPSERT)6.
{instanciaId}.sendmessage: Confirma o processamento e envio de mensagens originadas pela API, fornecendo o ID definitivo gerado pelo WhatsApp6.
{instanciaId}.receipt: Transmite as confirmações de entrega, leitura e reprodução de mídia6.
{instanciaId}.presence: Notifica alterações no estado de presença online/offline dos contactos6.



JSON
{
  "event": "MESSAGE",
  "instance": "comercial",
  "data": {
    "key": {
      "remoteJid": "5511999999999@s.whatsapp.net",
      "fromMe": false,
      "id": "3EB0C5A277F7F9B6C599"
    },
    "message": {
      "conversation": "Olá, preciso do suporte técnico."
    },
    "messageTimestamp": "1710000000"
  }
}


Padrões de Resiliência: Circuit Breaker, Recuo Exponencial e Failover
A camada de software responsável por consumir a API do Evolution Go deve implementar o padrão de projeto Circuit Breaker para responder a indisponibilidades e sanções de rede4. Quando um pedido de envio retornar um código de erro associado ao Erro 463 (NackCallerReachoutTimelocked), a aplicação deve interromper imediatamente a fila de disparos daquela instância específica, evitando o envio repetido de requisições que escalem o bloqueio para um banimento permanente4.
O algoritmo de envio deve classificar o contacto de destino antes da tentativa de entrega4. Se o destino for um contacto frio sem histórico de conversação bidirecional, a falha do Erro 463 deve alterar o estado do destino para REACHOUT_LOCK na base de dados do projeto4. A aplicação deve agendar uma retentativa utilizando o modelo de recuo exponencial (exponential backoff) com variação aleatória (jitter), iniciando com um intervalo de 15 minutos e duplicando progressivamente o tempo de repouso em caso de insucesso continuado (15m, 30m, 60m, 120m)4.
A fila de envio retoma a operação normal imediatamente se a instância receber um evento de mensagem de entrada (MESSAGE) vindo desse mesmo contacto4. A receção da mensagem de entrada força a atualização e persistência dos tokens de privacidade (tctoken) na tabela whatsmeow_privacy_tokens, desativando o estado de bloqueio e permitindo a entrega dos envios pendentes4.
Conclusões e Recomendações Estratégicas
A arquitetura do Evolution Go oferece um ganho substancial de desempenho em comparação com soluções baseadas em Node.js, otimizando o uso de recursos computacionais e reduzindo a latência no processamento de eventos1. Contudo, a utilização eficiente desta engine exige a estrita observância das convenções de rotas HTTP e uma gestão rigorosa do protocolo de rede do WhatsApp4.
Para assegurar a continuidade operacional e prevenir sanções, recomendam-se as seguintes ações prioritárias:
Adequação de Rotas e Payloads: Atualizar todas as chamadas da aplicação de integração para utilizar a nova convenção de rotas /send/*, incluindo o parâmetro instance no corpo da requisição e validando o correto encapsoamento de mensagens citadas9.
Adoção do Modelo Inbound-First: Reestruturar os processos de comunicação para incentivar a atração receptiva, eliminando disparos em massa para contactos sem histórico de conversação16.
Tratamento Resiliente do Erro 463: Incorporar mecanismos de Circuit Breaker e recuo exponencial na fila de envio da aplicação, interrompendo automações quando bloqueios por reach-out time-lock forem identificados4.
Isolamento de Infraestrutura e Licenciamento: Configurar proxies individuais por instância, ativar o ambiente no painel de licenciamento antes de liberar o tráfego da API e consumir os eventos de forma assíncrona utilizando filas RabbitMQ1.
Referências citadas
estuddar detalhado a documentação https://docs.evolutionfoundation.com.br/evolution-go e outros artigos dela para eu usera como documentação no meu projeto, uploaded:estuddar detalhado a documentação https://docs.evolutionfoundation.com.br/evolution-go e outros artigos dela para eu usera como documentação no meu projeto
Evolution Foundation - GitHub, https://github.com/evolution-foundation
Deep Dive: Building Self-Hosted WhatsApp Automation with Evolution API - Medium, https://medium.com/@kevinkiarie7/deep-dive-building-self-hosted-whatsapp-automation-with-evolution-api-1fa434b98ce1
Error 463 (NackCallerReachoutTimelocked) — tctoken/cstoken not persisted after receiving messages #50 - GitHub, https://github.com/evolution-foundation/evolution-go/issues/50
evolution-foundation/evolution-go: Evolution API / Evolution Go is an open-source WhatsApp integration API - GitHub, https://github.com/evolution-foundation/evolution-go
evolution-go/docs/wiki/recursos-avancados/events-system.md at main - GitHub, https://github.com/evolution-foundation/evolution-go/blob/main/docs/wiki/recursos-avancados/events-system.md
Releases · evolution-foundation/evolution-api - GitHub, https://github.com/evolution-foundation/evolution-api/releases
evolution-api-v2 | Skills Marketplace - LobeHub, https://lobehub.com/skills/openclaw-skills-evolution-api
evolution api error : r/n8n - Reddit, https://www.reddit.com/r/n8n/comments/1rw935o/evolution_api_error/
feat: Add quoted reply support to POST /send/text (missing vs Evolution API v2) #27 - GitHub, https://github.com/evolution-foundation/evolution-go/issues/27
evolution-go/CHANGELOG.md at main - GitHub, https://github.com/EvolutionAPI/evolution-go/blob/main/CHANGELOG.md
Releases · evolution-foundation/evolution-go - GitHub, https://github.com/evolution-foundation/evolution-go/releases
Button and List messages do not render on consumer WhatsApp — only Carousel works (v0.7.1) #59 - GitHub, https://github.com/evolution-foundation/evolution-go/issues/59
[GOWS] Error 463 on send to cold contacts — tctoken/cstoken not included in outgoing messages · Issue #1992 · devlikeapro/waha - GitHub, https://github.com/devlikeapro/waha/issues/1992
[INVESTIGATION] 463 error investigation · Issue #2441 · WhiskeySockets/Baileys - GitHub, https://github.com/WhiskeySockets/Baileys/issues/2441?timeline_page=1
Por que o WhatsApp bane números de API (e o que realmente reduz o risco) - Wafly, https://wafly.com.br/comparativos/numero-banido-whatsapp-api/
[BUG] Mensagens enviadas pelo Chatwoot retornam status 1 e logo após são alteradas para status 0 com messageStubParameters ["463"] (LID/JID) · Issue #2588 · evolution-foundation/evolution-api - GitHub, https://github.com/evolution-foundation/evolution-api/issues/2588
Bug Report: Outgoing messages stuck in PENDING, never delivered (Evolution API 2.4.0, Baileys) · Issue #2597 - GitHub, https://github.com/evolution-foundation/evolution-api/issues/2597
Instalando a Evolution Go com Portainer, Traefik e PostgreSQL em uma VPS Linux, https://dev.to/junior_carvalho/instalando-a-evolution-go-com-portainer-traefik-e-postgresql-em-uma-vps-linux-2d4b
[Feature] Novo endpoint POST /message/markplayed (microfone azul em áudios) · Issue #45 · evolution-foundation/evolution-go - GitHub, https://github.com/evolution-foundation/evolution-go/issues/46/linked_closing_reference?reference_location=REPO_ISSUES_INDEX
Instance settings silently reset to defaults (rabbitmqEnable, events, https://github.com/evolution-foundation/evolution-go/issues/111
