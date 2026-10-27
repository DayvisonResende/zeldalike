# A Lâmina do Vale

Ação e aventura 2D em pixel art, a caminho de um MMO pequeno para jogar com os amigos.
A demo original, em um único HTML, fica em `A Lâmina do Vale.html` como referência.

## Rodar

```bash
npm install
npm start          # compila o jogo e sobe tudo: http://localhost:2567 (o endereço para os amigos)
npm run dev        # para programar: servidor + jogo com recarga ao salvar em http://localhost:5173
npm test           # testes (inclui rede, com servidor e clientes de verdade)
npm run check      # tipos + testes
```

`npm run server` sobe só o servidor. Ele também entrega o jogo em http://localhost:2567,
mas na última versão compilada (`npm run build`); mudanças no cliente só aparecem lá depois de compilar de novo.

- Abra o jogo em duas janelas para ver dois jogadores no mesmo mundo.
- `?offline` roda tudo no navegador, sem servidor. Se o servidor estiver fora do ar, o jogo cai nesse modo sozinho.
- `?server=ws://host:porta` conecta em outro servidor; `VITE_SERVER_URL` faz o mesmo no build.
- `PORT=xxxx` muda a porta do servidor (é o que as hospedagens usam).
- `CONFIG=arquivo.yaml` usa outra configuração (por exemplo, uma de produção ou de teste).
- `COLYSEUS_LATENCY=100 npm run server` simula 100 ms de latência, bom para testar a sensação online.

## Estrutura

```
packages/
  shared/    regras do jogo: mapa, colisão, jogadores, inimigos, combate, regeneração.
             Sem tela, sem rede, sem banco — roda igual no servidor e no navegador.
  server/    Colyseus. Sala única do mundo, fila de inputs, snapshots por área de interesse, config.yaml.
  client/    canvas, sprites, câmera, som, input, interface.
             session/ esconde se o mundo está no servidor (net) ou no navegador (local).
content/
  maps/      mapas do mundo (Tiled: vale.tmj, caverna.tmj), tileset e projeto do Tiled
packages/tools/   gerar o tileset, conferir o mapa
```

Regras para manter o projeto saudável:

1. `shared` não importa nada de `client` nem de `server`.
2. A simulação não desenha nem toca som: ela emite eventos (`GameEvent`) e o cliente decide o que mostrar.
3. Números de balanceamento ficam em `packages/server/config.yaml`, não no código.
4. Regra nova em `shared` ganha teste em `packages/shared/test`.

## Como o online funciona

- O cliente manda só os comandos (3 números por passo, 60 por segundo). O servidor aplica cada um
  exatamente uma vez e devolve, 20 vezes por segundo, o que está perto daquele jogador.
- Você se move na hora: o cliente roda a mesma simulação de `shared` só para você e, quando o
  servidor responde, confere e reaplica os comandos que ele ainda não viu.
- Os outros jogadores e os monstros aparecem ~130 ms no passado, interpolados entre dois snapshots,
  para o movimento sair liso.
- Nome e aparência não vão em todo snapshot: o servidor manda um perfil quando alguém entra,
  muda (no máximo uma vez por segundo) ou sai.

## No jogo

`Enter` (ou 💬) abre o chat: **Perto** chega a quem está na tela e vira balão sobre a cabeça; **Todos**
(`Tab` troca, ou comece com `/t`) chega ao servidor inteiro. Limites e anti-spam ficam no `config.yaml`.

**PvP:** o modo do servidor fica no `config.yaml`. No `optional`, cada um liga o seu com `V` (ou no menu);
depois de ligar só desliga após o cooldown, e não desliga logo depois de uma briga. Nome vermelho = pode lutar.
Zonas seguras (a Clareira, por padrão) não têm PvP nem monstros.

**Dia e noite:** um dia inteiro dura `daynight.cycle` (24 min por padrão); o relógio aparece no HUD e o chat avisa
quando anoitece e amanhece. À noite o mundo escurece, cada jogador carrega uma luz pequena e as tochas iluminam.

**Levantar amigos:** `E` de frente para outro jogador levanta; `E` de novo arremessa (passa por cima de rio e barranco;
cair em monstro machuca o monstro). No colo de alguém, aperte as teclas rápido para se soltar. Desliga em `fun.liftPlayers`.

**Galinhas:** inofensivas e imortais (classe `chicken` no Tiled). Bata 5 vezes na mesma e um bando vem bicar só você
por alguns segundos; a zona segura é o único refúgio. Números em `fun` no config.

**Equipamento e magias:** os botões A e C recebem qualquer arma, e cada um monta do seu jeito, trocando quando
quiser pelo inventário. Espada e arco todo mundo tem; Cajado de Fogo (bola de fogo / explosão), Cajado de Luz
(cura em volta / cura maior que empurra monstros) e Grimório Sombrio (lentidão + roubo de vida / maldição) são
itens — vendidos pela Rosa e às vezes deixados pelo Rei Geleca. Segurar e soltar solta a magia forte. Gastam mana
(números em `magic` no config); sem mana, viram bastão. O equipado fica salvo no personagem.

**Magia no mundo:** o fogo queima arbustos e mato (crescem de novo) e acende **tochas apagadas** (tile `j`); com
todas as tochas apagadas de um grupo acesas (até 6 tiles uma da outra), os **portões** (`G`) a até 8 tiles abrem. Depois
de `regrow.torch` as tochas apagam e o portão fecha. O Cajado de Luz deixa um clarão no escuro e revela **paredes
ilusórias** (`I`, iguais às da caverna) por perto. Na Caverna Funda há um baú atrás de um portão e uma sala escondida.

**Blocos e placas:** andar contra um **bloco** (`B`) por meio segundo o empurra um tile. Uma **placa de pressão** (`P`)
fica apertada com um bloco em cima ou com alguém de pé nela; com todas as placas de um grupo (até 6 tiles uma da
outra) apertadas, os portões (`G`) a até 8 tiles abrem, e fecham quando uma solta. Blocos fora do lugar voltam
sozinhos depois de `regrow.block` sem ninguém perto. Nas Ruínas de Aurel há uma cripta com um baú.

**Loja:** um NPC vira lojista com a propriedade `loja` no Tiled (o id de uma loja em `shops` no config). Falar com ele
abre a loja depois da fala: Comprar (o que ele vende, `buy`) e Vender (o que ele compra, `sell`), com preços em ouro.
O servidor confere ouro, espaço no inventário e se você está perto do lojista. A Mercadora Rosa fica na Clareira.

**Controle de videogame:** qualquer controle que o navegador reconheça (Bluetooth ou USB, no celular ou no PC).
Analógico/direcional anda, botão de baixo é a espada, direita a ação, esquerda o arco, cima/RB o dash, analógico
direito mira; LT coração, RT poção, LB bomba; Start menu, Select inventário. Menus, inventário e loja se navegam
pelo direcional. Com controle conectado no celular, os botões de toque somem.

**Celular:** em telas de toque aparece um controle (joystick flutuante, botões A/B/C/D, atalhos de coração, poção e
bomba). Deitado, a tela do jogo ocupa a altura toda e o controle vai para as laterais. Tamanho dos botões e vibração
ficam em Menu → Opções. Dá para instalar como app (manifest em `packages/client/public`), que abre em tela cheia.

**Rei Geleca** (chefão da Caverna Funda, classe `king` no Tiled, números em `enemies.king`): fica na toca e pula
atrás de quem chega perto. Ao cair, solta uma onda de choque que machuca quem está no chão (pular ou rolar na hora
escapa) e esmaga pedras e arbustos. A cada três pulos chama gelecas; com metade da vida fica vermelho e furioso.
Todo mundo que bateu nele ganha o XP inteiro e um loot só seu. Se todos fogem, ele se cura. A barra de vida dele
aparece no alto da tela; quando cai ou renasce, o servidor inteiro fica sabendo pelo chat.

**Invasão de gelecas** (evento do servidor, `events.invasion` no config): de tempos em tempos (`every`) sai um
aviso no chat e, `warning` depois, uma horda de `count` gelecas marcha até a zona `zone`. Enquanto dura, a zona deixa de
proteger contra monstros (o PvP continua proibido lá). Limpou a horda antes de `duration`: quem derrubou pelo menos
uma ganha `reward` e o melhor defensor é anunciado; se o tempo acabar, elas recuam. Um contador aparece no HUD. Para
testar sem esperar, ponha `every: 1m`; `every: 0` desliga.

**Bombas:** `3` põe uma bomba acesa (cai de besouros e de baús). `E` de frente para ela levanta, `E` de novo arremessa;
segurar demais explode na mão. A explosão abre paredes rachadas (tiles "Paredão rachado" e "Parede de caverna rachada",
que se fecham de novo depois de `regrow.secret`), quebra arbustos, mato e pedras, fere monstros e empurra todo mundo
(em outro jogador só causa dano se o PvP deixar).

**Pesca:** de frente para a água, `E` ou `F` lança a linha. No "!", aperte de novo para fisgar; depois aperte com o
cursor na zona verde (peixes difíceis têm zona menor e cursor mais rápido). Peixes: lambari, tilápia, truta dourada,
peixe-lua (só à noite), peixe-cego (só na caverna) e a bota velha. Cada peixe tem tamanho; o maior de cada espécie
vira recorde do servidor (anunciado no chat, e na aba Recordes do menu). A barra roda dentro do passo da jogadora,
então o cliente vê exatamente o que o servidor julga: o atraso da rede não atrapalha o timing.

**Progresso:** monstros dão XP e soltam loot no chão (só quem derrubou pega nos primeiros segundos).
`I` (ou 🎒) abre o inventário; `1` usa um coração e `2` uma poção de mana. Largar um item no chão é o jeito
de passar para um amigo. XP, curva de nível, tabelas de drop e taxas ficam no `config.yaml`.

`Esc` (ou o botão ☰ na tela) abre o menu: personagem (nome, capa, cabelo), opções
(nomes sobre a cabeça: todos, só dos outros ou nenhum; som; caminhos dos monstros) e controles.
Tudo fica salvo no navegador.

## Editar o mapa (Tiled)

O mundo é um mapa do [Tiled](https://www.mapeditor.org) (grátis): `content/maps/vale.tmj`.

1. No Tiled, abra o projeto `content/maps/vale.tiled-project` (Arquivo → Abrir projeto) e depois o `vale.tmj`.
2. Edite as camadas:
   - **terreno** — pinte com os tiles do tileset (grama, trilha, água, árvores…). As bordas de grama,
     margens da água e beiradas de penhasco o jogo desenha sozinho.
   - **regioes** — retângulos com classe `regiao`; o nome do retângulo aparece na tela ao entrar.
     A propriedade `id` (opcional) é o que o `config.yaml` usa em `respawnPoint` e `safeZones`.
   - **monstros** — pontos com classe `slime`, `beetle` ou `bat` (morcego, voa por cima de água e arbustos).
     Propriedade opcional `quando`: `noite` ou `dia` (o monstro só existe nesse período).
   - **placas** — pinte o tile de placa no terreno e ponha um ponto com classe `placa` em cima;
     escreva na propriedade `texto` (linha em branco = próxima página).
   - **pontos** — um ponto chamado `partida` (onde se nasce neste mapa) e outros pontos com nome,
     usados como chegada de portais.
   - **baus** — pontos com classe `bau` em chão livre. Propriedades: `conteudo` (ex.: `gold:10-20, heart:2, shell:1@50%`
     — quantidade, faixa ou chance; itens: gold, heart, mana, jelly, shell) e `renasce` (ex.: `10m`). Cada personagem abre
     cada baú uma vez e espera ele encher de novo; abre com `E` de frente para ele.
   - **npcs** — pontos com classe `npc`; o nome do objeto é o nome do NPC. Propriedades: `texto` (a conversa;
     linha em branco = próxima página), `capa` e `cabelo` (nome da cor, como `Carmim` e `Ruivo`, ou o número),
     `olha` (baixo, cima, esquerda, direita). Conversa com `E` de frente para ele; ele se vira para você.
   - **portais** — retângulos com classe `portal`: quem pisa vai para o ponto `chegada` do mapa `destino`
     (o id do mapa em `world.maps` no config; vazio = este mesmo mapa). Dica: ponha a chegada de forma que
     quem chega já esteja andando para longe do portal de volta (entrou indo para o norte → a saída fica atrás).
3. Salve e rode `npm run map:check`: ele lista erros e avisos em português (placa sem texto, monstro dentro
   de árvore, região que o config cita e não existe…).
   - **Mapa escuro** (caverna): Mapa → Propriedades do mapa → propriedade booleana `escuro` marcada. Fica sempre de noite lá.
   - **Tochas**: o tile de tocha ilumina à noite e no escuro.
4. Reinicie o servidor. Quem entrar recebe o mapa novo (o servidor envia o mapa a cada jogador).

O mapa pode ter qualquer tamanho. Vários mapas: liste em `world.maps` no `config.yaml` (cada um é um mundo
separado, com monstros e chat "Perto" próprios) e ligue com portais; `world.start` é o mapa principal, onde
renasce quem cai em qualquer mapa. O `npm run map:check` confere todos os mapas e os portais entre eles.
Tipo de tile novo: acrescente no fim de `TILE_KINDS` (shared/src/world/tiles.ts), desenhe em
client/src/render/tiles.ts e rode `npm run map:tileset` para atualizar o tileset do Tiled.

## Contas e banco de dados

- **SQLite** num arquivo só: `packages/server/data/vale.db` (fora do git). Backup = copiar o arquivo com o servidor parado.
- O acesso ao banco fica todo em `server/src/persistence/` (Kysely). Trocar por PostgreSQL mexe só ali.
- Mudança no banco = migração nova em `persistence/migrations.ts`, nunca editar uma antiga.
- Senhas guardadas só como hash scrypt; tokens de sessão guardados só como sha256.
- Nome de personagem único sem diferenciar maiúsculas nem acentos ("Íris" = "iris").
- O servidor salva quem está online a cada `accounts.saveEvery`, ao sair e ao desligar.

## Configuração do servidor

`packages/server/config.yaml` controla regeneração do mundo, inimigos (vida, dano, renascimento),
jogadores (vida, mana, regeneração, ponto e tempo de renascimento), PvP, taxas de XP e drop.
Salve o arquivo com o servidor rodando e ele aplica na hora; se houver erro, o servidor
mostra o campo e a linha e continua com a configuração anterior.

## Etapas

1. **Base modular** ✅ — monorepo, lógica em `shared`, mundo contínuo com câmera, regeneração, config.
2. **Online** ✅ — o mundo roda no servidor; o cliente prevê o próprio movimento e interpola o resto.
3. **Nomes e aparência** ✅ — perfil por jogador, nomes sobre a cabeça, menu de opções.
4. **Vida e mana** ✅ — barras de vida e mana, dano dos monstros, regeneração, morte e renascimento.
5. **Chat** ✅ — canais Perto e Todos, balões de fala, avisos de entrada e saída, anti-spam.
6. Colocar no ar para os amigos.
7. **PvP** ✅ — modos off, optional e open, zonas seguras, travas para desligar, anúncio de quedas.
8. **Contas** ✅ — criar conta, login, até 3 personagens por conta, tudo salvo no banco.
9. **XP, níveis, drops e inventário** ✅ — XP por monstro, níveis com vida e mana maiores, loot no chão com dono temporário, inventário de 20 espaços.
10. Teste de carga com bots.
