# Pendências

Correções e melhorias técnicas que já se sabe que precisam ser feitas. Ideias de jogo ficam em `docs/IDEIAS.md`;
ferramentas de criação de conteúdo, em `docs/OFICINA.md`.

## Correções

### Monstros travando e golpe atrasado no celular (corrigido em 2026-10-29, falta testar no celular)

**O que acontecia:** no PC e no localhost, tudo liso. No celular, os monstros (principalmente o slime pulando)
congelavam por um instante no ar e depois seguiam, e o golpe não parecia instantâneo: o monstro piscava e o som
de acerto vinha um tempo depois.

**Causas encontradas:**

1. **Buffer fixo de interpolação.** Monstros e outros jogadores são desenhados ~133 ms no passado (8 passos),
   entre dois snapshots. No celular, quando um snapshot atrasava mais de ~80 ms, não havia o próximo para
   interpolar: o monstro parava no último lugar conhecido e pulava quando o snapshot chegava.
2. **Golpe decidido só no servidor.** A previsão do cliente roda sem monstros, então a resposta do golpe
   (som, piscar) só vinha depois de uma ida e volta da rede mais os 133 ms da interpolação.
   O servidor também não compensa o atraso: ele confere o golpe contra a posição atual do monstro, não contra
   a que você está vendo.

Descartado: CPU do servidor. Um passo leva em média 0,1 ms com os mapas reais (o limite é 16 ms).

**O que foi feito** (`packages/client/src/session/interpolate.ts` e `net.ts`):

- `SnapshotClock`: o atraso de exibição cresce sozinho quando os snapshots chegam irregulares e volta devagar
  quando a rede acalma. Muda aos poucos, para a cena não voltar no tempo. No PC continua em 8 passos.
- Extrapolação curta: sem snapshot novo, monstros e jogadores seguem no mesmo rumo por até 5 passos (~83 ms)
  em vez de congelar. Saltos grandes (renascer) não são extrapolados.
- Golpe com resposta na hora: quando a sua espada encosta num monstro como você o vê, o som de acerto toca e ele
  pisca no mesmo instante. O dano continua decidido pelo servidor; o som do servidor que chega depois é descartado.
  Galinhas ficam de fora (o golpe nelas tem outra reação).

**Primeira medição no celular (2026-10-29, prints do `/debug`):** não resolveu. São dois problemas juntos:

- **Aparelho:** 15 a 53 fps; quadros de até 183 ms; só o nosso código leva 10 a 50 ms por quadro (o limite para 60 fps é 16 ms).
- **Rede:** em geral um snapshot a cada 80 ms, mas com paradas de 0,3 a 4 s sem nada chegar.
- **Efeito colateral da correção:** o `SnapshotClock` mede o atraso contando passos do jogo; com o celular lento, confunde
  lentidão do aparelho com atraso da rede e o atraso da cena sobe para 350 a 430 ms (o golpe parece ainda mais atrasado).

**Gravação para medir (`/debug`):** `/debug` grava 1 minuto, `/debug 5` grava 5 (até 30), `/debug parar` encerra, `/marca` ou o
botão "Marcar travada" marca o momento. Também `?debug` no endereço. Cada segundo vira uma linha em
`packages/server/data/telemetria/<data>_<nome>.jsonl`, com o lado do cliente (fps, pior quadro, tempo de cada parte do quadro,
snapshots, eventos como ataque e acerto) e o do servidor (tempo dos passos, envios, bytes). No fim, um resumo aparece no chat.

**Ainda em aberto:**

- [ ] Gravar alguns minutos no celular com `/debug 5` e analisar o arquivo.
- [x] `SnapshotClock`: mede pelo relógio real (não pelos passos), olha só os últimos ~2 s e soma no máximo 100 ms ao
      atraso da cena. Como efeito, a cena dos outros anda a cada quadro, não a cada passo (mais liso em telas de 90/120 Hz).
- [ ] Servidor engasga às vezes (gravação no PC: passo de até 45 ms, até 320 ms sem rodar). A gravação agora anota
      laço de eventos travado, limpeza de memória (GC), salvamento no banco e tempo de montar os snapshots.
- [ ] Retorno instantâneo do golpe nunca disparou na gravação do PC; a gravação agora separa o ataque por arma
      ("ataque sword", "ataque bow"…) para saber se era o arco.
- [x] Gravação no celular (4G, 2 min): o servidor estava perfeito; os monstros parados acompanham os buracos da rede
      (correlação 0,83); o celular refazia ~87 passos de previsão por segundo (até 780) e o ataque era quase todo de arco.
- [x] Previsão mais leve: o mundo da previsão não calcula mais o mapa de caminhos dos monstros (não tem monstros), e
      a previsão só é refeita quando o servidor discorda dela (`ownSimKey`; teste em `protocol.test.ts` garante que, com
      os mesmos inputs, servidor e previsão chegam ao mesmo estado). A previsão usa o input como o servidor recebe
      (mira arredondada).
- [x] Flecha com resposta na hora: acertou um monstro na sua tela, toca o som e ele pisca, como a espada.
- [ ] Gravar de novo no celular para medir a previsão mais leve.

### Rede por UDP (WebTransport)

Os buracos de 0,3 a 0,7 s no 4G vêm do TCP (WebSocket): um pacote perdido segura os seguintes. Navegador não abre UDP
"cru"; o caminho por UDP é o **WebTransport** (QUIC sobre UDP).

**Teste feito (2026-10-29):** a biblioteca de QUIC que o Colyseus usa (`@fails-components/webtransport`) instala e roda
neste PC (Windows): servidor e cliente locais trocaram 20 de 20 datagramas de 1 KB. Cada datagrama comporta até
**1.211 bytes**. A biblioteca foi removida depois do teste; entra no projeto quando o canal for feito.

**Por que não o `@colyseus/h3-transport` oficial:** ele substitui o WebSocket (não roda junto), põe o servidor inteiro
em HTTPS (página, API e jogo), exige certificado reconhecido pelo navegador e não tem volta automática: quem estiver
numa rede que bloqueia UDP (ou no iPhone, se não suportar) fica sem jogo.

**Desenho proposto: canal paralelo só para os snapshots.**

- O WebSocket continua com tudo (entrar, comandos, chat, eventos). Um canal WebTransport ao lado leva só as posições
  (snapshots), como datagramas: perdeu um, o próximo chega 50 ms depois, sem segurar nada.
- Sem certificado do domínio: o servidor gera um certificado próprio de até 14 dias e manda a impressão digital pelo
  WebSocket (`serverCertificateHashes`); renova sozinho. Biblioteca para gerar: `@peculiar/x509`.
- O snapshot se divide em duas partes: posições (datagrama, pode perder) e o que não pode perder (eventos, inventário,
  baús, mensagens), que continua pelo WebSocket.
- Snapshot maior que 1.211 bytes vai em pedaços (hoje têm ~1,4 KB em média); perdeu um pedaço, perde aquele snapshot.
- Sem WebTransport (UDP bloqueado, aparelho sem suporte): tudo continua pelo WebSocket, como hoje.
- Precisa: liberar uma porta **UDP** no roteador (além da TCP 2567 de hoje).

- [ ] Implementar o canal paralelo (servidor, cliente, divisão do snapshot, volta automática).
- [ ] Liberar a porta UDP no roteador.
- [ ] Medir com `/debug` no 4G antes e depois.
- [ ] HTTPS continua pendente pelas senhas, mas deixou de ser pré-requisito do UDP.

## Melhorias

### Tela de fundo antes de jogar (feito no sprint 1)

Hoje as telas de login, de personagens e de criação aparecem por cima do mundo do jogo, já rodando no fundo.
A ideia é esconder o jogo até o jogador entrar de fato: uma tela de fundo própria (uma cena de título em pixel art com
a logo do Mossblade, no estilo da tela de manutenção) atrás das telas de conta. O mundo só aparece ao entrar com o personagem.

### Infraestrutura (já conhecidas)

- **HTTPS** (fica para o fim): hoje as senhas trafegam sem criptografia. Caddy na frente do servidor (`reverse_proxy localhost:2567`).
  Com HTTPS, o app Android pode tirar a liberação de `http://` (`res/xml/network_security_config.xml`).
- ~~**Backup automático do banco.**~~ Feito no sprint 2.
- ~~**Ferramentas de administrador:**~~ comandos no chat feitos no sprint 2; o "painel do servidor" visual continua em `docs/OFICINA.md`.
- **Teste de carga:** simular uns 100 jogadores antes de chamar todo mundo.
