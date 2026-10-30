# Mossblade

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

**Mapa do mundo:** `M` (ou o botão 🗺, ou tocar no minimapa do canto) abre o mapa do mapa atual, desenhado a partir dos
tiles. Ele começa escuro e se revela conforme você anda (o explorado fica salvo no personagem). Mostra regiões, zonas
seguras, lojas, portais, baús, quem está no mapa e os marcadores: tocar ou clicar põe o seu "venham aqui!", que vale por
1 minuto (no mundo, um alfinete; fora da tela, uma seta na borda). Em grupo, só o grupo vê; sem grupo, todos no mapa. O minimapa liga e desliga em Opções.
O som agora fica só em Opções (o `M` é do mapa).

**Atributos:** ataque, poder mágico, velocidade de ataque, defesa, vida, mana e regenerações. Vêm do que está nos
botões A e C (seção `gear` do `config.yaml`; as armas atuais estão zeradas, os números virão com os itens da Oficina);
o nível dá só vida e mana. O dano em monstros é em pontos de vida (`weapons` e `magic`). Entre jogadores, os atributos
valem `pvp.factor` (0,5 = metade do ataque, do poder mágico e da defesa). Menu → Atributos mostra a
ficha e o que cada botão faz; no inventário, escolher uma arma mostra os números dela e o que muda ao equipar no A ou
no C (verde melhora, vermelho piora), e escolher algo de vestir mostra o que muda no lugar do que está vestido.

**Raridade:** comum (branco), incomum (verde), raro (azul), épico (roxo) e lendário (dourado), definida no item
(Oficina ou `"rarity"` no `.json`). O nome, a borda no inventário e o brilho no chão (com uma luz subindo nos épicos e
lendários) ficam na cor dela. Equipamento comum, incomum ou raro pode trazer atributos sorteados (`gear.rolls`: comum às
vezes 1, incomum 1, raro 2) e cada exemplar é único (não empilha; o sorteio vai junto com ele para o banco e para a
rede). Épico e lendário são fixos e trazem um efeito (`gear.effect`): roubo de vida, veneno, flecha que atravessa,
onda ao girar ou explosão ao derrubar. Achar um épico ou lendário toca um som especial e é anunciado no chat.
Todo lendário deve ter um caminho garantido (loja, baú ou monstro com 100%); a Oficina avisa quando falta.

**Gancho:** equipamento (no A ou no C) que atira uma corrente na mira até 8 tiles. Preso num pilar, puxa você até
ele, por cima de água e buracos; em monstro, tira um pouco e atordoa; num item do chão, traz até você. Fica no baú do
Covil do Besouro, na Masmorra do Musgo. Qualquer item da Oficina pode se comportar como gancho (`"like": "hook"`).

**Grupo:** `G` (ou Menu → Grupo) mostra quem está online, em que região, com "Convidar". O convite aparece no alto da
tela (Aceitar/Recusar) e na aba Grupo; também dá pelo chat: `/convidar nome`, `/aceitar`, `/recusar`, `/sairdogrupo`,
`/grupo`. Até `party.maxSize` (4) por grupo; quem convidou lidera (pode convidar e tirar; saindo, o mais antigo lidera).
No grupo: a vida de cada um aparece embaixo da sua (e onde está, se estiver em outro mapa), uma seta verde na borda da
tela aponta para quem está longe, o nome fica verde, o XP de monstro é dividido igualmente com quem estiver até
`party.xpRange` pixels (arredondado para cima), ninguém fere ninguém (nem com PvP) e há o canal de chat "Grupo"
(`Tab` ou `/p mensagem`). O loot continua como antes. O grupo dura enquanto estiverem online (sobrevive a uma queda de
conexão; quem sai do jogo sai do grupo).

**Amigo caído:** quem cai fica no chão por `player.respawnDelay`. Um amigo que segura o botão de Ação ao lado dele por
`player.revive` (1,5 s) o levanta ali mesmo, com metade da vida; enquanto alguém está levantando, a contagem para.

**Pegar itens:** o que cai no chão (ouro e itens) fica lá até alguém apertar o botão de Ação perto: um toque pega o
mais perto (uma setinha mostra qual; no celular o botão vira "Pegar"), segurar pega tudo em volta. O loot continua
reservado a quem derrubou por `loot.ownerTime`. **Baús** mandam tudo direto para a mochila (ouro, para a carteira); o que
não couber fica guardado no baú só para quem abriu, e abrir de novo entrega o resto (salvo no personagem).

**Loja:** um NPC vira lojista com a propriedade `loja` no Tiled (o id de uma loja em `shops` no config). Falar com ele
abre a loja depois da fala: Comprar (o que ele vende, `buy`) e Vender (o que ele compra, `sell`), com preços em ouro.
O servidor confere ouro, espaço no inventário e se você está perto do lojista. A Mercadora Rosa fica na Clareira.

**Controle de videogame:** qualquer controle que o navegador reconheça (Bluetooth ou USB, no celular ou no PC).
Analógico/direcional anda, botão de baixo é a espada, direita a ação, esquerda o arco, cima/RB o dash, analógico
direito mira; LT coração, RT poção, LB bomba; Start menu, Select inventário. Menus, inventário e loja se navegam
pelo direcional. Com controle conectado no celular, os botões de toque somem. A ajuda na mira do celular
vale também no controle (o analógico direito, quando usado, mira livre).

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
`I` (ou 🎒) abre o inventário: em cima as armas do A e do C e o boneco com o que está vestido (cabeça, corpo, pés,
colar e anel; o item sai da mochila enquanto vestido e soma os atributos), embaixo a mochila com abas por tipo e o
botão Organizar. `1` usa um coração e `2` uma poção de mana. Troca rápida de arma sem abrir o inventário: os botões
A e C no canto do HUD (embaixo da barra de XP; no celular deitado, no canto de cima à esquerda, fora da tela do jogo)
ou as teclas `4` (A) e `5` (C), passando pelas armas que você tem. Largar um item no chão é o jeito
de passar para um amigo. XP, curva de nível, tabelas de drop e taxas ficam no `config.yaml`.

`Esc` (ou o botão ☰ na tela) abre o menu: personagem (nome, capa, cabelo), opções
(nomes sobre a cabeça: todos, só dos outros ou nenhum; som; caminhos dos monstros) e controles.
Tudo fica salvo no navegador.

## Itens (`content/items/`)

Cada item é um par de arquivos: `<id>.json` com os dados e `<id>.png` com o ícone (16×16, fundo transparente). O id é o
nome do arquivo (letras minúsculas, números e hífen) e nunca deve mudar: o banco e os inventários guardam o id. O nome
pode mudar à vontade.

```json
{ "name": "Coração", "desc": "Recupera 25 de vida.", "heal": 25 }
```

Campos: `name`, `desc`, `heal` (vida ao usar), `mana` (mana ao usar) e `gear` para equipamento (vai no A ou no C):

```json
{ "name": "Espada de Ferro", "desc": "Pesada.", "gear": { "like": "sword", "damage": 15, "stats": { "defense": 10 }, "color": "#5fa8ff" } }
```

`like`: como se comporta (`sword`, `bow`, `firestaff`, `lightstaff`, `darktome`). `damage`: dano próprio (só espada e
arco; giro, dash e PvP crescem na mesma proporção; sem ele, o da arma de base). `stats`: atributos (os mesmos da seção
`gear` do `config.yaml`). `color`: lâmina da espada, pedra do cajado ou madeira do arco. O servidor valida a
pasta ao ligar e a cada mudança (com erros em português, como o `config.yaml`); com o servidor ligado, o item novo chega
aos jogadores na hora. Um item usado numa loja, num drop ou num baú não pode sumir: a mudança é ignorada e o erro aparece
no terminal. Para pôr o item no jogo, use o id no `config.yaml` (lojas e drops) ou num baú do mapa.

### Oficina

O passo a passo completo, para qualquer pessoa, está em [docs/GUIA-DA-OFICINA.md](docs/GUIA-DA-OFICINA.md) (e dentro
da própria Oficina, no botão "Como usar").

Com `npm run dev` (no PC), a Oficina fica em http://localhost:5173/oficina.html: entre com a mesma conta do jogo (precisa
estar em `admins` no `config.yaml`). Ela mostra os itens e cria ou muda consumíveis, materiais e equipamentos (nome,
descrição, cura, mana, ícone; no equipamento, como se comporta, dano, atributos e cor), gravando os arquivos em `content/items/`. Em "Onde aparece", põe o item em lojas e nos drops dos monstros, gravando no
`config.yaml` só as linhas do item, e mostra em quais baús ele está. Depois é commitar e subir para o servidor. No servidor do home
lab (`npm start`) a Oficina fica desligada; para ligá-la à força: `OFICINA=1 npm start`.

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
   - **especiais** — objetos de masmorra (servem em qualquer mapa):
     - `chave` (ponto): chave no chão. As chaves são do mapa (numa masmorra, do grupo): quem pegar, qualquer um usa.
     - `sala` (retângulo): sala que tranca. Quem entra com monstros vivos dentro dela fica trancado (as grades
       `Grade aberta` dentro ou na borda da sala viram `Grade fechada`) até derrubar todos. Propriedade opcional
       `recompensa`: `chave` ou o id de um item, que cai no meio da sala quando ela é limpa.
     - `fragmento` (ponto): fragmento de vida. Cada personagem pega uma vez; dá `player.fragment` (5) de vida máxima para sempre.
   - **Monstros**: propriedade `minichefe` = `sim` deixa o monstro 1,5× maior, com 6× a vida, 1,5× o dano e 5× o XP.
   - **Tiles de masmorra**: `Porta trancada` (abre com uma chave, botão de Ação de frente para ela), `Grade aberta` e
     `Grade fechada` (das salas que trancam), e o `Pilar`, onde o gancho prende.
3. Salve e rode `npm run map:check`: ele lista erros e avisos em português (placa sem texto, monstro dentro
   de árvore, região que o config cita e não existe…).
   - **Mapa escuro** (caverna): Mapa → Propriedades do mapa → propriedade booleana `escuro` marcada. Fica sempre de noite lá.
   - **Tochas**: o tile de tocha ilumina à noite e no escuro.
4. Reinicie o servidor. Quem entrar recebe o mapa novo (o servidor envia o mapa a cada jogador).

O mapa pode ter qualquer tamanho. Vários mapas: liste em `world.maps` no `config.yaml` (cada um é um mundo
separado, com monstros e chat "Perto" próprios) e ligue com portais; `world.start` é o mapa principal, onde
renasce quem cai em qualquer mapa. O `npm run map:check` confere todos os mapas e os portais entre eles.
**Masmorras:** os mapas listados em `world.instanced` têm uma cópia por grupo (sozinho, uma só sua), criada ao entrar
pelo portal e descartada 1 minuto depois de vazia. Na cópia, monstro derrubado não volta, as chaves e as portas são
do grupo, e baús e fragmentos contam por personagem (abrir de novo noutra cópia não vale). Quem cai lá dentro volta ao
Vale; quem sai do jogo lá dentro volta pela porta da masmorra. A primeira é a **Masmorra do Musgo**
(`content/maps/masmorra.tmj`), com a entrada na escada atrás do Rei Geleca, no alto da Caverna Funda.
Tipo de tile novo: acrescente no fim de `TILE_KINDS` (shared/src/world/tiles.ts), desenhe em
client/src/render/tiles.ts e rode `npm run map:tileset` para atualizar o tileset do Tiled.

## Contas e banco de dados

- **SQLite** num arquivo só: `packages/server/data/vale.db` (fora do git).
- **Backup automático** com o servidor rodando: a cada 6 h em `packages/server/data/backups/`, guardando as 28 mais novas
  (`database.backup` no config; `/backup` no chat faz uma na hora). Para restaurar: servidor parado, copiar o backup por cima do `vale.db`.
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

## Administração e chat

Administradores são os usuários (o login da conta) da lista `admins` no `config.yaml`. No chat:

| Comando | Quem | O que faz |
| --- | --- | --- |
| `/ajuda` | todos | lista os comandos |
| `/quem` | todos | quem está online e onde |
| `/ignorar nome` (`/designorar`, `/ignorados`) | todos | esconde as mensagens de alguém, só para você (fica no navegador) |
| `/anunciar texto` | admin | aviso para todo o servidor (chat e tela) |
| `/expulsar nome [motivo]` | admin | tira do servidor (pode voltar) |
| `/silenciar nome [minutos]`, `/dessilenciar nome` | admin | sem chat por um tempo (padrão 10 min) |
| `/invasao` | admin | começa uma invasão de gelecas agora (mesmo com `every: 0`) |
| `/dar [nome] item [quantidade]` | admin | dá item (nome ou id: `coracao`, `cajado-de-fogo`, `firestaff`) ou `ouro`; sem nome, para você |
| `/backup` | admin | cópia do banco agora |

Comandos nunca aparecem para os outros. Filtro de palavrões: `chat.filter` (lista embutida + `chat.blockedWords`).

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
