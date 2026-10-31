# Pedidos e análise

Pedidos vindos de quem joga (você, sua esposa, os amigos), com o que existe hoje, uma análise sincera e o tamanho do
trabalho. Ideias de longo prazo continuam em `IDEIAS.md`; correções técnicas, em `PENDENCIAS.md`.

Tamanho: **P** (uma tarde), **M** (alguns dias), **G** (um sprint inteiro ou mais).

## Rodada de 2026-10-29

### Regra geral: tudo que for conteúdo se cria na Oficina

Itens, NPCs, monstros, peixes, colocáveis, eventos: se é conteúdo, tem um construtor na Oficina. Registrado também em
`OFICINA.md` ("A regra de todos os construtores").

**Sinceramente:** a Oficina combina peças que o jogo já sabe fazer. Um comportamento novo (luz, colocar no chão, um
monstro que cava) é programado uma vez e depois vira campo na Oficina. Em cada pedido abaixo, a parte "na Oficina" diz
qual campo novo aparece. Dois limites:

- **Arte:** monstro e NPC precisam de sprite com animação (andar em 4 direções, atacar), não só um ícone 16×16. A
  Oficina pode aceitar a folha de sprites, mas alguém precisa desenhá-la.
- **Lugar no mapa:** onde o NPC ou o monstro fica continua no Tiled (o mapa). A Oficina define *o que* ele é.

### 1. Campo de visão: modo "tela completa" além do "clássico" (M)

**Hoje:** a câmera mostra sempre 256×224 pixels do mundo, a proporção do Super Nintendo. No celular deitado sobram as
faixas pretas dos lados, onde ficam os botões.

**Proposta:** opção em Menu → Opções → Tela: **Clássica** (como hoje) ou **Completa**, em que a câmera mostra mais
mundo para os lados até preencher a tela.

**Sinceramente:**

- Dá para fazer. O tamanho da visão hoje é uma constante (`VIEW_W`); vira um valor por jogador.
- O servidor só manda o que está perto de você (`interest.ts`). Na tela completa, esse raio precisa crescer, ou os
  monstros aparecem do nada na borda. Isso significa um pouco mais de dados por jogador.
- No celular, na tela completa, os botões ficam *em cima* do jogo, porque deixa de haver faixa preta. Eles ficam meio
  transparentes, mas vão cobrir parte da cena.
- No PvP, quem tem tela mais larga vê mais. Entre amigos, isso é aceitável. Se incomodar, limito a largura máxima.
- Para o problema de achar a porta da masmorra, há uma solução mais barata que já ajuda sozinha: **marcar portas e
  entradas no minimapa e no mapa (M)** com um ícone. Recomendo fazer as duas coisas, começando pelo marcador (P). O
  marcador foi feito em 2026-10-30.

### 2. A hora volta para a manhã quando o servidor reinicia (P), um defeito: corrigido em 2026-10-30

**Hoje:** não é de propósito. O relógio do jogo é "hora inicial do `config.yaml` (8h) + tempo desde que o servidor
ligou", e nada é guardado.

**Correção:** guardar a hora do jogo no banco (a cada minuto e ao desligar) e continuar dali ao ligar. Também é a base
do calendário (item 3).

### 3. Calendário: dias, meses e anos, com eventos em datas (M)

**Proposta:** "a festa da uva no reino X, com uvas baratíssimas".

**Sinceramente:** um dia do jogo dura 24 minutos reais, então em um dia real passam 60 dias do jogo. Uma festa por
data *do jogo* aconteceria várias vezes por dia, e quem só joga à noite nunca a pegaria no mesmo horário. Há dois
caminhos:

- **Recomendo:** eventos pelo **calendário real** ("todo sábado, das 19h às 23h", "de 1 a 7 de fevereiro"). Os amigos
  combinam de jogar juntos, e a festa vira um encontro.
- O calendário do jogo (dia, mês e ano com nomes próprios) fica como sabor: aparece na tela, NPCs comentam, as
  estações mudam as cores.

**Na Oficina:** um construtor de eventos com nome, quando acontece, onde, e o que muda (preços de uma loja, monstros,
drops). Hoje a invasão já é um evento de horário; seria o mesmo, generalizado.

### 4. Lanterna: item que ilumina quando equipado (P a M)

**Hoje:** a noite já escurece a tela, e as tochas do mapa já iluminam em volta (há uma camada de luz no desenho).
Falta a luz que anda com o jogador.

**Proposta:** um campo **"Luz (raio)"** nos itens de vestir, na Oficina. A lanterna seria um item de vestir com luz.

**Decidido (2026-10-29):** a lanterna vai num **espaço novo, o Cinto**, que vira o 8º espaço (A, C, cabeça, corpo,
pés, colar, anel e cinto). Outras coisas de cinto podem entrar ali depois (bolsa de iscas, por exemplo).

Os outros jogadores também veem a sua luz, então ela vai junto na rede (um número).

**Sinceramente:** a lanterna só tem graça se existir lugar escuro de verdade. Hoje só a noite é escura. Cavernas e
masmorras escuras (escuras também de dia) precisam entrar junto, como propriedade do mapa.

### 5. Tochas colocáveis no chão (M)

**Proposta:** um item que se coloca no chão e ilumina lugares escuros.

**Sinceramente:** "colocável" é um sistema novo, que serve também para a horta, a fogueira e os móveis da fazenda.
Precisa de regras contra bagunça:

- máximo por jogador;
- a tocha apaga depois de um tempo (ex.: 10 minutos);
- não se coloca em porta, ponte nem zona segura;
- dá para pegar de volta a tocha que você colocou.

**Na Oficina:** tipo "Colocável", com ícone, sprite no chão, luz, duração e se bloqueia a passagem.

### 6. Aparência completa: bota, camisa, capa/cachecol, cabelo e pele (M)

**Hoje:** só a capa e o cabelo, com 8 cores cada.

**Proposta:** escolher a cor de cada parte, com uma paleta de tons de **pele** variada.

**Sinceramente:**

- Dá para fazer. O personagem é desenhado com paletas, então cada parte vira mais uma paleta.
- Precisa de uma migração no banco, e a aparência continua viajando na rede como poucos números.
- Um conflito futuro: quando a armadura for desenhada no personagem, ela cobre a camisa. Proposta: a cor escolhida
  aparece quando não há nada vestido ali, ou a armadura "tinge" com a sua cor.

### 7. Convite de grupo com confirmação (já existe; talvez pouco visível): mais chamativo em 2026-10-30

**Hoje:** quem é convidado recebe um aviso no topo da tela com **Aceitar** e **Recusar**. Ninguém entra no grupo sem
aceitar.

**Resposta (2026-10-29):** passou despercebido. Fazer o aviso chamar atenção (P):

- maior e no centro da tela;
- com som;
- com o nome de quem convidou em destaque;
- sem sumir sozinho rápido demais.

### 8. Tocar ou clicar num personagem ou NPC abre um menu de opções (M; a troca é G)

**Proposta:**

- **Jogador:** Mensagem, Convidar para o grupo, Silenciar, Trocar itens.
- **NPC:** Conversar, Loja (se houver), Missões (se houver).

**Sinceramente:** é a melhoria mais didática da lista, principalmente no celular. Pontos:

- **No celular**, tocar na cena está livre (os controles ficam nas faixas), então funciona bem.
- **No PC**, os botões do mouse já são ataques (A e C). Clicar num amigo para abrir o menu conflita com atacar perto
  dele. Proposta: clicar no **nome** em cima do personagem, ou segurar Shift e clicar.
- **Silenciar** é simples: uma lista guardada na sua conta, e o chat dessa pessoa some para você.
- **Mensagem** abre o chat já em conversa privada (precisa do canal privado, que é pequeno).
- **Trocar itens** é um sistema grande e delicado: dois lados oferecem, os dois confirmam, e o servidor garante que
  ninguém é enganado nem duplica item. Está em `IDEIAS.md` como prioridade 3. Recomendo o menu primeiro e a troca
  depois, num sprint próprio.
- O botão "Missões" no NPC depende do sprint de missões. Os dois combinam: faço o menu junto com as missões.

### 9. Controles explicados e tela de mapeamento (M)

**Proposta:** uma tela com três abas, **Teclado e mouse**, **Toque** e **Controle**, com desenho de cada botão e o que
ele faz, e uma tela para trocar as teclas e os botões do controle.

**Sinceramente:**

- Explicar é fácil e ajuda muito.
- Remapear teclado e controle também é viável (fica guardado no aparelho).
- Mover os botões de toque na tela é outro trabalho (M): fica para depois, se pedirem.

### 10. Pescaria mais rica e relaxante (G, um sprint)

**Hoje:** uma barrinha de tempo, alguns peixes e um recorde de tamanho. Concordo que ainda é pouco.

**Proposta:**

- **O que se pesca** depende do lugar (rio, lago, caverna, mar), da hora (peixes noturnos) e da isca.
- **Nem tudo é peixe:** bota velha, garrafa com mensagem, baú pequeno e, raríssimo, um item bom.
- **Criatura:**
  - uma criatura fraca, com chance baixa (ex.: 1 em 200);
  - um chefe, com chance quase nula (1 em 5.000) e **só em lugares marcados** (um lago específico), nunca em zona
    segura;
  - a criatura nasce ligada a quem pescou, para não virar bagunça no meio da cidade.
- **Caderno de pesca:** cada espécie pescada fica registrada, com o maior exemplar. É o lado "colecionar sem pressa".
- **Relaxante:** sons de água, sem perder nada quando o peixe escapa, e um modo "pescar sentado" que repete sozinho
  enquanto você conversa.
- **Para que serve o peixe:** comida (ver item 13). Peixe cozido numa fogueira cura aos poucos.

**Na Oficina:** a tabela de pesca (o que sai, onde, quando, com que chance), como as tabelas de drop.

### 11. Chat no celular: o teclado cobre o jogo, e o ícone não fecha o chat

**O ícone não fecha (P), um defeito:** corrigido em 2026-10-30.

**O teclado (M):** o teclado é do Android; não dá para diminuí-lo. O que dá para fazer:

- **Frases rápidas e emotes:** uma fileira de botões ("Oi!", "Vem cá", "Obrigado", "Espera", 👍) que mandam sem abrir o
  teclado. Resolve a maior parte do uso no meio do jogo.
- Com o teclado aberto, o jogo não pula de lugar, e o chat fica numa faixa fina logo acima do teclado.
- O chat fecha sozinho depois de enviar (opcional).

### 12. Inventário: "falta algo"

**Em aberto (2026-10-29):** você vai estudar inventários de outros jogos e voltar com o que falta. Até lá, não mexer.
Minhas apostas, de `IDEIAS.md`:

- **Barra rápida configurável:** você escolhe o que vai nos atalhos 1 a 4 (hoje são fixos em coração, mana e
  bomba). É a que mais muda o dia a dia.
- **Ações perto do item:** tocar no item abre um menu pequeno ao lado dele, em vez dos botões embaixo do painel.
- **Vender em lote** na loja ("vender todos os materiais").
- Detalhes de capricho: o item vestido aparece no boneco, e há som ao vestir e ao organizar.

### 13. Regeneração: hoje cura demais (P; o equilíbrio é com a comida)

**Hoje:** 2 de vida por segundo depois de 5 s sem levar dano. Isso enche os 100 de vida em menos de um minuto.

**No Zelda:** o clássico não regenera sozinho. A vida volta por corações que caem, fadas, poções e, no Breath of the
Wild, comida.

**Proposta:**

- baixar a regeneração base (ex.: 0,5 por segundo, ou só em zona segura e perto de fogueira);
- dar à comida (peixe, horta) o papel de curar.

**Sinceramente:** mudar o número é uma linha no `config.yaml`. Mas, sem comida e com poucos corações, o jogo fica
mais difícil para quem está começando. Recomendo baixar junto com a pescaria e a comida, não antes.

### 14. Moedas: cobre, prata, ouro e platina (P a M)

**Proposta:** 100 cobre = 1 prata, 100 prata = 1 ouro, 100 ouro = 1 platina.

**Sinceramente:**

- **Por dentro:** continua um número só, em cobre. A tela mostra separado ("3 ouro, 25 prata").
- **O problema é a escala:** 1 platina daria 1.000.000 de cobre. Com os preços de hoje (coisas de 5 a 50 de ouro),
  ninguém veria platina por muito tempo. Todos os preços e drops precisam ser multiplicados (o "ouro" de hoje vira
  "prata", por exemplo) para as quatro moedas aparecerem.
- Recomendo fazer quando a economia crescer (horta, pesca, receitas). Até lá, ouro e prata bastam.

### 15. Placas: dá para pular o texto (P): feito em 2026-10-30

**Hoje:** é preciso passar todas as páginas.

**Proposta:**

- o botão de ação mostra a página inteira de uma vez;
- um "✕" (ou Esc ou B) fecha;
- afastar-se da placa também fecha.

Vale para os NPCs também.

### 16. Construtor de criaturas, com moldes de quadros (G, dois sprints)

**Proposta:** "vou criar um cachorro".

1. A Oficina diz quais quadros desenhar, quantos e como.
2. Você sobe os quadros e a Oficina os reconhece.
3. Você monta a criatura: nome, vida, velocidade, velocidade de ataque, dano, se o dano é em área, efeitos (veneno,
   lentidão…), se invoca outras criaturas, e os drops.

**Hoje:** os cinco monstros (geleca, besouro, morcego, galinha, Rei Geleca) estão escritos no código, inclusive o
desenho, feito pixel a pixel em `sprites.ts`. Nenhum vem de arquivo. Por isso só eu consigo criar monstro hoje.

**Sinceramente:** é o construtor mais importante depois do de itens, e encaixa na regra da Oficina. A ideia dos
**moldes** é o que torna isso possível para quem não sabe animar.

**Os moldes (tipos de corpo).** Cada molde fixa o tamanho e a lista de quadros:

| Molde | Exemplos | Quadros |
| --- | --- | --- |
| Gelatinoso | geleca, gosma | 2 (parado e esmagado); serve para todas as direções |
| Voador | morcego, abelha, fantasma | 2 (asas em cima e embaixo); serve para todas as direções |
| Quadrúpede | cachorro, lobo, javali | andar: 2 de frente, 2 de costas, 2 de lado; ataque: 1 por direção (3) |
| Humanoide | goblin, esqueleto, NPC | andar: 2 por direção (6); ataque: 1 por direção (3) |

- **O lado esquerdo é o direito espelhado:** você desenha só um lado.
- **Piscar ao levar dano e sumir ao morrer são automáticos.** Não precisam de quadro.
- **O cachorro, então, são 9 quadros de 16×16.** Começar com o molde mais simples (gelatinoso ou voador, 2 quadros)
  ajuda a pegar o jeito.

**Como a Oficina ensina:**

- **Folha-guia para baixar:** um PNG com uma caixa numerada para cada quadro, a silhueta do molde em cinza claro como
  guia e a linha do chão. Você desenha por cima (no Piskel, que é grátis e roda no navegador, ou no Aseprite) e sobe
  a folha inteira. A Oficina corta, confere o tamanho e a transparência, e aponta o quadro que estiver faltando.
- **Prévia animada na hora:** a criatura andando nas 4 direções, atacando e piscando, ao lado do herói para comparar o
  tamanho.
- **Aula de andar:** uma página na Oficina mostra o ciclo de caminhada quadro a quadro, com o próprio herói e a
  diferença entre um quadro e outro destacada ("este pé vai para frente, o corpo desce 1 pixel"). Inclui a técnica de
  ver o quadro anterior transparente por baixo (*onion skin*). É o que mais ajuda a entender o movimento.

**O que se monta (formulário):**

- Nome, molde, cor do brilho ao levar dano.
- **Números:** vida, dano, velocidade, velocidade de ataque, XP, defesa.
- **Comportamento:** peças que já existem e peças novas:
  - andar atrás do jogador;
  - pular (como a geleca);
  - voar em zigue-zague (como o morcego);
  - investida (como o besouro);
  - fugir (como a galinha);
  - ficar parado guardando um lugar.
- **Ataque:** encostar, projétil (flecha, cuspe), área em volta (com aviso no chão antes) ou investida.
- **Efeitos no jogador:** veneno, lentidão, empurrão. Os efeitos de status contra jogadores são novos; hoje o veneno
  é só da arma contra monstros.
- **Invocar:** chama X criaturas de tal tipo a cada N segundos, com limite (o Rei Geleca já faz algo parecido).
- **Drops:** a mesma tela de "Onde aparece" dos itens.
- **Chefe:** barra de vida no topo, música e fases (muda de comportamento abaixo de 50% de vida).

**Os limites:**

- Cada comportamento ou efeito novo é programado uma vez e depois vira opção da lista para todas as criaturas.
- Os cinco monstros de hoje passam a ser criaturas da Oficina também, com os desenhos atuais exportados para PNG.
  Assim viram exemplos para estudar.
- Onde a criatura nasce continua no Tiled (um ponto no mapa com o id dela).
- Vale também para **NPCs**: molde humanoide, e no lugar de combate: falas, loja e missões.

**Ordem dentro dele:**

1. Moldes, folha-guia, prévia e a aula de andar, com o cachorro como primeiro teste.
2. O formulário com as peças de comportamento que já existem.
3. Ataques em área, efeitos no jogador, invocação e fases de chefe.

### 17. Aprender o Tiled (feito em 2026-10-29: `GUIA-DO-TILED.md`, também na Oficina em "Guia do Tiled")

**Hoje:** você acha o Tiled difícil.

**Sinceramente:** o Tiled faz muito mais do que o jogo usa, e isso assusta. O jogo usa só umas 5 camadas e alguns
tipos de objeto.

**Proposta:** um `GUIA-DO-TILED.md`, no estilo do guia da Oficina e aberto dentro dela. Ensina só o que o jogo usa:

- abrir o mapa;
- pintar chão, água e árvores;
- pôr uma porta, uma placa, um baú, um NPC e um ponto de monstro;
- rodar `npm run map:check` e ver o resultado no jogo.

Tudo com prints e um exercício guiado: criar uma sala pequena do zero.

Também dá para a Oficina ajudar o Tiled: listar as criaturas e NPCs criados nela com o id exato para colar no mapa.

### 18. Independência na Oficina (vários sprints, ao longo do caminho)

**Pedido:** "o que incluir na Oficina para eu não depender de você 100%". Detalhe em `OFICINA.md`, seção "Mapa da
independência". O que ainda não está em outro item desta lista:

- **Gatilhos simples:** "quando pisar aqui / falar com X / derrotar todos → abrir porta, dar item, mostrar texto, nascer
  monstro". Permite criar quebra-cabeças e masmorras sem código. Vai junto com as missões ou logo depois.
- **Painel do servidor:** regeneração, XP, ciclo do dia, PvP e tamanho do grupo por formulário, sem editar o `config.yaml`.
- **Conferir mapa na Oficina:** subir o `.tmj` e ver os erros em português, com o lugar marcado. Vai junto com o guia
  do Tiled.
- **Sala de testes, rascunho e desfazer:** testar sem afetar ninguém e voltar à versão anterior.
- **Publicar para a produção por botão:** no lugar de commit, push e `git pull` no servidor. Exige cuidado com a
  segurança.

Estimativa: com tudo isso, uns 80 a 90% do conteúdo sem programação.

### 19. Ateliê: desenhar e animar dentro da Oficina (G, um a dois sprints)

**Proposta:** uma área na Oficina para desenhar sprites e animar, sem programa de fora.

**Sinceramente:** é ambicioso, mas é viável justamente porque a arte do jogo é pequena. Um ícone tem 16×16 pixels e um
quadro de criatura também. Um editor de pixel art para esse tamanho é muito mais simples que um Photoshop, e encaixa com
os moldes de criatura (item 16): em vez de baixar a folha-guia, desenhar e subir, você desenha **direto nos quadros
do molde**.

O que entra:

- **Desenho:** lápis, borracha, balde, conta-gotas, linha e retângulo, espelhar e desfazer. Grade sempre visível e
  zoom grande.
- **Paleta do jogo:** as cores que o jogo já usa, para tudo combinar. Dá para acrescentar cores.
- **Quadros:** uma fileira de quadros embaixo, com duplicar, apagar e reordenar.
- **Ver o quadro anterior por baixo** (*onion skin*), transparente. É o recurso que mais ajuda a animar.
- **Prévia animada:** a animação rodando ao lado, na velocidade do jogo, ao lado do herói para comparar o tamanho.
- **Começar de algo pronto:** abrir um sprite do jogo (a geleca, o herói) para estudar ou para fazer uma variação
  ("a geleca roxa vira azul de gelo" com troca de cores).
- **Salvar direto:** o desenho vira o ícone do item ou os quadros da criatura, sem exportar arquivo nenhum.

O que fica de fora:

- camadas, pincéis suaves e efeitos;
- desenhos grandes (mapas, telas de título);
- desenhar no celular (dá para abrir, mas com o dedo é difícil; pensado para o PC com mouse).

Para isso, o Piskel ou o Aseprite continuam melhores, e a Oficina continua aceitando PNG de fora.

**Atalho: o Piskel embutido (pergunta de 2026-10-30).** O Piskel é de código aberto (licença Apache 2.0, que permite
embutir, mantendo o aviso de licença) e roda no navegador. Dá para servir uma cópia dele junto com a Oficina e abrir
numa janela dentro dela, já com o tamanho e os quadros do molde, e com um botão "Salvar no jogo" que traz os quadros
de volta.

- **A favor:** tudo pronto (camadas, onion skin, prévia, espelho), em dias em vez de semanas.
- **Contra:**
  - o Piskel não tem uma interface oficial para outro site conversar com ele; a ponte usa o código interno dele, que
    pode mudar numa versão nova (por isso fixamos uma versão);
  - a tela dele é em inglês;
  - no celular é ruim;
  - o projeto anda devagar.
- **Recomendação:** começar pelo Piskel embutido, com uma prova rápida antes (abrir um ícone, editar e salvar de
  volta). Se funcionar bem, o Ateliê próprio só vira necessário se o Piskel atrapalhar.

**Quando:** junto com o construtor de criaturas (item 16). Primeiro o editor de um quadro só (que já serve para os
ícones dos itens), depois os quadros e a animação.

## Ordem sugerida

Combinado em 2026-10-29: o que dá independência na criação vem antes do resto.

1. ~~**Correções rápidas**~~ (feito em 2026-10-30, Sprint 10 em `SPRINTS.md`):
   - hora que continua depois de reiniciar (2);
   - o ícone do chat fecha o chat (11);
   - placas e conversas que se pulam (15);
   - portas no minimapa (1);
   - convite que chama atenção (7).
2. ~~Guia do Tiled~~ (17): feito. Falta conferir o mapa pela Oficina (18).
3. **Missões + menu de opções ao tocar em jogador ou NPC** (8, sem a troca de itens). Os dois se completam, e o NPC
   ganha "Missões" no menu.
4. **Construtor de criaturas** (16) com o **Ateliê** (19): você desenha, anima e monta monstros e NPCs sem mim.
5. **Tela e controles:**
   - modo de tela completa (1);
   - tela de controles com mapeamento (9);
   - frases rápidas no chat (11).
6. **Luz:** lanterna no cinto, mapas escuros e tochas colocáveis (4, 5).
7. **Pescaria 2.0 e comida**, com a regeneração mais baixa (10, 13).
8. **Aparência completa** (6).
9. **Troca de itens** entre jogadores (8).
10. **Economia:** quatro moedas e eventos por data (14, 3), quando houver o que comprar e vender.

Os itens do 18 entram junto com os outros:

- conferir mapa, com o guia do Tiled (2);
- gatilhos, com as missões (3);
- sala de testes e desfazer, com as criaturas (4);
- painel do servidor e publicar por botão, em qualquer brecha.

A regra da Oficina vale em todos: cada sistema novo sai com o seu campo ou construtor nela.
