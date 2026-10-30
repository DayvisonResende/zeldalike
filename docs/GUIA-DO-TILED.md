# Guia do Tiled

O Tiled é o programa onde se desenham os mapas do jogo: o Vale, a Caverna Funda e a Masmorra do Musgo. Ele faz muito
mais do que o jogo usa, e é isso que assusta no começo. Este guia ensina só o que o jogo usa: **uma camada para pintar o
chão e sete camadas de objetos** (monstros, placas, baús, NPCs…). No fim há um exercício guiado: criar uma salinha
do zero e ligá-la ao Vale.

> Dica: faça o exercício (seção 10) com o guia aberto ao lado. Ler ajuda, mas é fazendo que o Tiled fica fácil.

## 1. O que você precisa

- O **Tiled**, versão 1.10 ou mais nova (grátis): https://www.mapeditor.org. No Linux também há pela loja de aplicativos
  (Snap). Este PC já tem a 1.12.
- O projeto do jogo aberto no VS Code, para rodar a conferência do mapa (`npm run map:check`) e o jogo no seu PC.
- Saber onde ficam os arquivos: tudo de mapa está em `content/maps/`.

| Arquivo | O que é |
| --- | --- |
| `vale.tiled-project` | o **projeto**: abra sempre por ele (traz as classes de objeto prontas, com cores e campos) |
| `vale.tmj`, `caverna.tmj`, `masmorra.tmj` | os mapas |
| `vale.tsj` e `tileset.png` | o **tileset**: a paleta de tiles (grama, água, árvore…). Não edite à mão |
| `vale-rascunho.tmj` | rascunho seu; o jogo não lê |

## 2. Abrir do jeito certo

1. Abra o Tiled.
2. **Arquivo → Abrir arquivo ou projeto** (File → Open File or Project) e escolha `content/maps/vale.tiled-project`.
3. No painel **Projeto**, à esquerda, aparecem os mapas. Dois cliques em `vale.tmj`.

> Por que pelo projeto? Porque é ele que sabe que existe a classe "slime", "placa", "npc"… com os campos certos (texto,
> capa, cabelo). Abrindo o `.tmj` solto, você teria que digitar tudo à mão e errar mais.

Se o Tiled estiver em inglês e você preferir português: **Editar → Preferências → Geral → Idioma** (Edit → Preferences →
General → Language) e reabra o Tiled. Este guia dá os nomes nos dois idiomas.

## 3. A tela do Tiled

- **No meio:** o mapa. Cada quadradinho é um **tile** de 16×16 pixels.
- **À direita, em cima:** o painel **Camadas** (Layers). É a coisa mais importante da tela.
- **À direita, embaixo:** o painel **Tilesets**, com a paleta de tiles do jogo.
- **À esquerda:** o painel **Propriedades** (Properties), que mostra o que está selecionado (um objeto, uma camada, o mapa).
- **Em cima:** a barra de ferramentas. As ferramentas mudam conforme a camada escolhida: pincéis numa camada de tiles,
  ferramentas de objeto numa camada de objetos.

Para se mexer no mapa:

| Ação | Como |
| --- | --- |
| Aproximar e afastar | Ctrl + roda do mouse |
| Arrastar a vista | segurar a barra de espaço e arrastar (ou o botão do meio do mouse) |
| Desfazer / refazer | Ctrl+Z / Ctrl+Y |
| Salvar | Ctrl+S |

## 4. A regra de ouro: a camada certa

Tudo o que você faz vai para a **camada selecionada** no painel Camadas. O erro mais comum é pôr um monstro com a
camada "placas" selecionada, ou tentar pintar com uma camada de objetos selecionada (o pincel nem aparece).

**Antes de cada coisa, olhe o painel Camadas e clique na camada certa.** Se errar, não tem problema: botão direito no
objeto → **Mover para a camada** (Move Object to Layer). O `map:check` também avisa quando algo está na camada errada.

As camadas que o jogo lê (os nomes têm que ser exatamente estes):

| Camada | Tipo | O que vai nela |
| --- | --- | --- |
| `terreno` | tiles | o chão, a água, as árvores, as paredes… tudo que é pintado |
| `regioes` | objetos | retângulos com o nome de cada lugar ("Clareira", "Margem do Rio") |
| `monstros` | objetos | pontos onde os monstros nascem |
| `placas` | objetos | o texto de cada placa |
| `portais` | objetos | áreas que levam a outro mapa ou a outro lugar |
| `pontos` | objetos | pontos com nome: onde se nasce e onde se chega pelos portais |
| `baus` | objetos | baús e o que tem dentro |
| `npcs` | objetos | personagens que conversam (e lojistas) |
| `especiais` | objetos | coisas de masmorra: chave, sala que tranca, fragmento de vida |

Uma camada a mais é ignorada (o `map:check` avisa). Uma camada que falta só significa "nada disso neste mapa". O
mínimo de todo mapa: a camada `terreno` e **pelo menos uma região** na camada `regioes`.

## 5. Pintar o chão (camada terreno)

1. Clique na camada **terreno**.
2. No painel Tilesets, clique no tile que quer usar (passe o mouse para ver o nome).
3. Escolha a ferramenta e pinte:

| Ferramenta | Atalho | Para quê |
| --- | --- | --- |
| Carimbo (Stamp Brush) | B | pintar tile a tile, clicando ou arrastando |
| Balde (Bucket Fill) | F | encher uma área inteira do mesmo tile |
| Preencher forma (Shape Fill) | P | desenhar um retângulo cheio |
| Borracha (Eraser) | E | apagar (o jogo transforma tile vazio em grama) |
| Conta-gotas | clique direito no mapa | pega o tile que está ali, para pintar com ele |

**O jogo desenha sozinho as bordas:** a margem da água, a beirada do penhasco e a transição da grama. Você pinta só
"água" e "grama", e o jogo cuida do resto. Por isso o mapa no Tiled parece mais quadrado do que no jogo.

Os tiles e o que fazem no jogo:

| Tile | O que faz |
| --- | --- |
| Grama, Grama densa, Flores, Trilha, Terra, Piso de pedra, Chão de caverna | chão: anda-se por cima |
| Mato alto | chão; a espada corta (e cresce de novo) |
| Árvore, Penhasco, Parede de caverna | sólidos: ninguém passa (servem de parede) |
| Arbusto | sólido; a espada corta, `E` levanta e arremessa |
| Pedra | sólida; `E` levanta e arremessa, a bomba quebra |
| Água | só o morcego e as flechas passam; dá para pescar de frente para ela |
| Ponte | atravessa a água |
| Placa | sólida; precisa de um objeto na camada `placas` em cima, com o texto |
| Pilar | sólido; o gancho prende nele e puxa você até lá |
| Entrada de caverna, Escada | só desenho: a passagem de verdade é um portal em cima |
| Tocha | ilumina à noite e no escuro |
| Tocha apagada | o fogo acende; com todas as de um grupo acesas, os portões perto abrem |
| Portão | fechado até as tochas ou as placas de pressão perto abrirem |
| Paredão rachado, Parede de caverna rachada | parecem parede; a bomba abre (fecham de novo depois de um tempo) |
| Parede ilusória | parece parede; a luz do Cajado de Luz revela |
| Bloco (empurra) | andar contra ele por meio segundo empurra um tile |
| Placa de pressão | apertada com um bloco ou alguém em cima; todas apertadas abrem os portões perto |
| Bloco na placa | um bloco que já começa em cima da placa |
| Porta trancada | abre com uma chave (botão de Ação de frente) |
| Grade aberta, Grade fechada | as grades das salas que trancam (ver seção 8) |

> Não gire nem espelhe tiles (as teclas X, Y e Z do carimbo fazem isso): no jogo eles aparecem na posição normal.

## 6. Pôr objetos

Objeto é tudo que não é pintado: um monstro, um baú, uma placa. Existem dois formatos:

- **Ponto:** um lugar exato. Ferramenta **Inserir ponto** (Insert Point), atalho **I**. Serve para monstro, baú, NPC,
  placa, chave, fragmento e os pontos de chegada.
- **Retângulo:** uma área. Ferramenta **Inserir retângulo** (Insert Rectangle), atalho **R**. Serve para região, portal
  e sala que tranca.

Para pôr um objeto:

1. Clique na camada certa (seção 4).
2. Escolha a ferramenta (I para ponto, R para retângulo).
3. Clique no mapa (ou arraste, para o retângulo).
4. No painel **Propriedades**, no campo **Classe** (Class), escolha a classe na lista: `slime`, `bau`, `npc`…
5. Os campos daquela classe aparecem logo abaixo, em **Propriedades personalizadas** (Custom Properties). Preencha.

Para mexer depois: ferramenta **Selecionar objetos** (Select Objects), atalho **S**. Clique para escolher, arraste
para mover, Delete para apagar.

> **Encaixar na grade:** ligue **Ver → Encaixar → Encaixar na grade** (View → Snapping → Snap to Grid). Assim os pontos
> caem certinho num tile. O jogo usa o tile onde o ponto está.

## 7. Cada camada de objetos

### regioes

Retângulos com classe `regiao`. O **nome do retângulo** aparece na tela quando alguém entra ("Margem do Rio").

- Propriedade `id` (opcional): um nome curto sem acento (`clareira`). O `config.yaml` usa esse id para o lugar onde se
  renasce (`respawnPoint`) e as zonas seguras (`safeZones`).
- Duas regiões não podem ter o mesmo id.

### monstros

Pontos. A **classe** é o monstro:

| Classe | Monstro |
| --- | --- |
| `slime` | geleca |
| `beetle` | besouro |
| `bat` | morcego (voa por cima de água e arbustos) |
| `chicken` | galinha (inofensiva; não bata 5 vezes na mesma) |
| `king` | Rei Geleca (chefão) |

Propriedades opcionais:

- `quando`: `noite` ou `dia`. O monstro só existe nesse período. Vazio = sempre.
- `minichefe`: `sim`. Fica 1,5× maior, com 6× a vida, 1,5× o dano e 5× o XP.

Não ponha monstro em cima de árvore ou parede: o `map:check` avisa.

### placas

1. Na camada **terreno**, pinte o tile **Placa**.
2. Na camada **placas**, ponha um ponto com classe `placa` em cima dele.
3. Escreva o texto na propriedade `texto`. Uma **linha em branco** começa a próxima página. Para escrever várias
   linhas, clique nos "…" ao lado do campo.

### portais

Retângulos com classe `portal`. Quem pisa nele vai para outro lugar.

- `destino`: o id do mapa para onde vai (`vale`, `caverna`, `masmorra`; é o nome usado em `world.maps` no
  `config.yaml`). Vazio = um lugar no mesmo mapa.
- `chegada`: o nome de um ponto (camada `pontos`) no mapa de destino.

> Ponha a chegada de forma que quem chega já esteja **se afastando** do portal de volta. Se você entra numa caverna
> andando para o norte, a chegada fica um tile **ao norte** da escada de volta. Senão a pessoa volta sem querer.

### pontos

Pontos **com nome** (o nome do objeto, não a classe):

- `partida`: onde se nasce neste mapa (um por mapa).
- Qualquer outro nome (`entrada`, `caverna`, `masmorra`…): chegada de portais.

Os nomes não podem se repetir no mesmo mapa, e o ponto não pode estar em cima de algo sólido.

### baus

Pontos com classe `bau`, em chão livre.

- `conteudo`: o que tem dentro, separado por vírgula. Exemplo: `gold:10-20, heart:2, shell:1@50%`.
- `renasce`: em quanto tempo enche de novo para cada personagem: `30s`, `10m`, `2h`, `24h`.

Como ler o conteúdo:

| Escrito | Quer dizer |
| --- | --- |
| `heart:2` | 2 corações |
| `gold:10-20` | de 10 a 20 de ouro |
| `shell:1@50%` | 1 carapaça, com 50% de chance |

Os ids dos itens são os da Oficina (o nome do arquivo em `content/items/`). Item de equipamento ou de vestir sai
com sorteio, como no monstro.

### npcs

Pontos com classe `npc`. O **nome do objeto** é o nome que aparece em cima da cabeça.

- `texto`: a conversa (linha em branco = próxima página).
- `capa` e `cabelo`: o nome da cor. Capas: Turquesa, Carmim, Floresta, Real, Ameixa, Âmbar, Grafite, Neve.
  Cabelos: Ameixa, Castanho, Preto, Ruivo, Loiro, Grisalho, Rosa, Azul.
- `olha`: `baixo`, `cima`, `esquerda` ou `direita` (para onde ele olha quando ninguém está falando com ele).
- `loja` (opcional): o id de uma loja do `config.yaml` (por exemplo `clareira`). Vira lojista.

### especiais

Coisas de masmorra (funcionam em qualquer mapa):

- `chave` (ponto): uma chave no chão. Abre uma **Porta trancada**. As chaves são do mapa (na masmorra, do grupo).
- `sala` (retângulo): uma sala que tranca (seção 8). Propriedade opcional `recompensa`: `chave` ou o id de um item,
  que aparece no meio da sala quando ela é limpa.
- `fragmento` (ponto): fragmento de vida. Cada personagem pega uma vez e ganha vida máxima para sempre.

## 8. Quebra-cabeças

Todos se montam só pintando tiles e, às vezes, um objeto:

| Quebra-cabeça | Como montar |
| --- | --- |
| Tochas e portão | pinte **Tochas apagadas** perto umas das outras (até 6 tiles) e um **Portão** a até 8 tiles. Acendeu todas com fogo, o portão abre por um tempo |
| Blocos e placas | pinte **Placas de pressão** e **Blocos** (e um Portão perto). Com todas as placas apertadas, o portão abre |
| Parede secreta | pinte **Paredão rachado** (ou Parede de caverna rachada) no meio de uma parede. A bomba abre |
| Parede ilusória | pinte **Parede ilusória** no meio de uma parede de caverna. A luz do Cajado de Luz revela |
| Porta com chave | pinte uma **Porta trancada** e ponha uma `chave` (camada especiais) em algum lugar do mapa |
| Sala que tranca | um retângulo `sala` na camada especiais cobrindo a sala, com monstros dentro e **Grade aberta** nas entradas. Quem entra fica trancado até derrubar todos |
| Travessia com gancho | pinte **Pilares** do outro lado de água ou buraco (o gancho alcança 8 tiles) |

> Dica de desenho: mostre o objetivo antes do caminho. Um baú visível atrás de um portão dá vontade de resolver; um
> portão sem nada atrás, não.

## 9. Propriedades do mapa

Em **Mapa → Propriedades do mapa** (Map → Map Properties), em Propriedades personalizadas:

- `nome` (texto): o nome do mapa ("Caverna Funda").
- `escuro` (booleano, marcado): o mapa é sempre noite. Tochas e o Cajado de Luz iluminam.

Nas mesmas propriedades, confira:

- **Infinito** (Infinite): desmarcado.
- **Formato da camada de tiles** (Tile Layer Format): CSV.
- Tamanho do tile: 16×16.

## 10. Exercício: uma salinha do zero

Vamos criar a **Toca do Treino**: uma sala com chão, paredes, uma placa, um baú, uma geleca e uma porta de volta ao Vale.

### Criar o mapa

1. **Arquivo → Novo → Novo mapa** (File → New → New Map).
2. Orientação **Ortogonal**, formato da camada de tiles **CSV**, ordem **Direita para baixo**.
3. Tamanho do mapa: **Fixo**, 20 de largura e 12 de altura. Tamanho do tile: 16 × 16.
4. Salve como `content/maps/treino.tmj` (o formato `.tmj` é JSON, o que o jogo lê).
5. **Mapa → Adicionar tileset externo** (Map → Add External Tileset) e escolha `content/maps/vale.tsj`.

### Criar as camadas

1. No painel Camadas já existe uma camada de tiles. Dois cliques no nome e renomeie para `terreno`.
2. No botão de nova camada (ícone de folha, embaixo do painel Camadas), crie **Camada de objetos** (Object Layer) e
   chame de `regioes`. Faça o mesmo para `pontos`, `monstros`, `placas`, `baus` e `portais`.

### Pintar

1. Camada **terreno**, tile **Chão de caverna**, ferramenta **Balde** (F): clique no mapa para encher tudo.
2. Tile **Parede de caverna**, ferramenta **Preencher forma** (P) ou **Carimbo** (B): faça a borda inteira de parede.
3. Deixe um buraco na parede de baixo, no meio, e pinte ali uma **Escada**.
4. Pinte uma **Placa** perto da escada e duas **Tochas** nos cantos.

### Pôr os objetos

1. Camada **regioes**, ferramenta **R**: um retângulo cobrindo o mapa inteiro. Classe `regiao`, nome `Toca do Treino`
   (é o que aparece na tela ao entrar).
2. Camada **pontos**, ferramenta **I**: um ponto 2 tiles acima da escada. Nome: `partida`. Outro ponto no mesmo lugar,
   nome: `entrada`.
3. Camada **portais**, ferramenta **R**: um retângulo de 1 tile em cima da escada. Classe `portal`, `destino` = `vale`,
   `chegada` = `partida` (por enquanto, a partida do Vale).
4. Camada **placas**, ferramenta **I**: um ponto em cima do tile de placa. Classe `placa`, `texto` =
   `Toca do Treino. Aqui se aprende o Tiled!`
5. Camada **baus**: um ponto no fundo da sala. Classe `bau`, `conteudo` = `gold:5-10, heart:1`, `renasce` = `10m`.
6. Camada **monstros**: um ponto no meio da sala, classe `slime`.
7. **Mapa → Propriedades do mapa**: propriedade `nome` = `Toca do Treino` e `escuro` marcado.
8. Salve (Ctrl+S).

### Conferir

No terminal do VS Code, na pasta do jogo, rode `npm run map:check content/maps/treino.tmj`.

Se aparecer `✔ treino (treino.tmj): 20×12 tiles` e o resumo, está certo. Se aparecer `✘`, leia a mensagem: ela diz o
que está errado, onde (x e y do tile) e como corrigir. Corrija no Tiled, salve e confira de novo.

### Ligar ao Vale (opcional)

Para entrar na sala pelo jogo:

1. No `packages/server/config.yaml`, em `world.maps`, acrescente a linha `treino: ../../content/maps/treino.tmj`.
2. No `vale.tmj`, num lugar livre, pinte uma **Entrada de caverna** e ponha em cima um `portal` com `destino` = `treino`
   e `chegada` = `entrada`.
3. Rode `npm run map:check` (sem nome de arquivo): ele confere todos os mapas e os portais entre eles.
4. Reinicie o jogo no seu PC (`npm run dev`) e entre pelo portal.

> Isso mexe no Vale de verdade. Se foi só treino, desfaça antes de enviar para o servidor (no VS Code, aba Controle do
> Código-Fonte: botão direito no arquivo → Descartar alterações).

## 11. Conferir sempre: map:check

`npm run map:check` confere todos os mapas do `config.yaml`, os portais entre eles e as regiões que o config usa.
Com um arquivo no fim, confere só aquele mapa. Ele nunca muda nada: só lê e avisa.

- **✘ (erro):** o mapa não carrega no jogo. Precisa corrigir.
- **Aviso:** carrega, mas talvez não seja o que você queria (monstro em cima de árvore, tile vazio virando grama).

## 12. Problemas comuns

| Mensagem ou problema | O que fazer |
| --- | --- |
| "está na camada X, mas é da camada Y" | botão direito no objeto → Mover para a camada → Y |
| "nenhuma região" | desenhe pelo menos um retângulo `regiao` na camada regioes |
| "o mapa está como infinito" | Mapa → Propriedades do mapa → desmarque Infinito |
| "a camada terreno está comprimida" | Mapa → Propriedades do mapa → Formato da camada de tiles = CSV |
| "placa … não está em cima de um tile de placa" | pinte o tile Placa no terreno, embaixo do ponto |
| "está em cima de algo sólido" | mova o objeto para um tile de chão |
| "portal … leva ao ponto X, que não existe" | crie um ponto com esse nome (camada pontos) no mapa de destino |
| "cor desconhecida" no NPC | use um dos nomes de capa ou cabelo da seção 7, com acento e maiúscula |
| O pincel não aparece | a camada selecionada é de objetos: clique na `terreno` |
| Não consigo selecionar um objeto | a camada dele está trancada (cadeado) ou escondida (olho) no painel Camadas |
| Os campos da classe não aparecem | o mapa foi aberto sem o projeto: feche e abra pelo `vale.tiled-project` |
| Mudei o mapa e nada mudou no jogo | os mapas só são lidos ao ligar o servidor: reinicie |

## 13. Enviar para o servidor

Igual aos itens da Oficina (ver o guia da Oficina, "Subir para o servidor de produção"), com uma diferença:

1. No VS Code, confira que só os mapas que você mexeu estão na lista (e o `config.yaml`, se ligou um mapa novo).
2. Commit e Sincronizar.
3. No servidor: `git pull` e **reinicie o servidor**. Diferente dos itens, os mapas não recarregam sozinhos.

> Reiniciar derruba quem está jogando por alguns segundos. Avise no chat antes, ou faça quando ninguém estiver jogando.
