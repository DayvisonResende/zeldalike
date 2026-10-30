# Guia da Oficina

A Oficina é onde os itens do Mossblade são criados: poções, materiais, espadas, arcos e cajados. Tudo por formulário,
sem programar. Este guia explica, passo a passo, como criar um item, como conferir se ele ficou equilibrado e como
colocá-lo no servidor onde a galera joga.

> Resumo em uma frase: você cria o item no seu PC, testa no jogo do seu PC e depois "sobe" os arquivos para o servidor
> (commit, push e um `git pull` no servidor). O item aparece para todo mundo na hora, sem reiniciar nada.

## 1. O que você precisa

- **O projeto do jogo no seu PC**, com o Node instalado e as dependências baixadas (uma vez só, na pasta do jogo:
  `npm install`).
- **Uma conta no jogo do seu PC.** O jogo do seu PC tem o próprio banco de dados, separado do servidor. Crie uma conta
  nele como faria no jogo de verdade.
- **Ser administrador.** O nome de usuário dessa conta precisa estar na lista `admins` do arquivo
  `packages/server/config.yaml`, assim: `admins: [kaulzz, seu-usuario]`. Quem não está na lista não entra na Oficina.

## 2. Abrir a Oficina

1. Abra um terminal na pasta do jogo e rode `npm run dev`. Ele liga o servidor e o jogo no seu PC (deixe o terminal
   aberto enquanto estiver usando).
2. No navegador, abra **http://localhost:5173/oficina.html**.
3. Entre com o usuário e a senha da sua conta.

> A Oficina só funciona no `npm run dev` do PC. No servidor de produção ela fica desligada de propósito: assim ninguém
> consegue mudar o jogo direto lá, e tudo passa pelo seu PC (onde dá para testar antes).

## 3. A tela

- **À esquerda, a lista de itens**, com o ícone, o nome e o id de cada um. A caixa **Procurar…** filtra pelo nome.
- **À direita, o formulário** do item escolhido. Clique num item da lista para editar, ou em **+ Novo item** para criar.
- **Embaixo, "Onde aparece"** (só para itens que já existem): lojas, monstros que derrubam e baús.
- No alto: **Como usar** (este guia), **Voltar ao jogo** e **Sair**.

## 4. Criar um item, passo a passo

1. Clique em **+ Novo item**.
2. **Nome:** como aparece no jogo, por exemplo "Espada de Ferro".
3. **Id:** sai sozinho do nome (`espada-de-ferro`). É o "RG" do item: o banco de dados e os inventários guardam o id.
   **Depois de criado, ele nunca muda.** O nome pode mudar à vontade.
4. **Descrição:** uma frase curta, que aparece no inventário.
5. **Tipo:** Consumível, Material ou Equipamento (veja a seção 5).
6. **Ícone:** clique em **Escolher PNG…** e escolha a imagem (veja a seção 6).
7. Confira **Como aparece no jogo** (a prévia do inventário) e a **Calculadora de equilíbrio** (seção 7).
8. Clique em **Criar item**. Aparece "Criado. Já está no jogo.": quem estiver jogando no seu PC já recebe o item.
9. Para o item aparecer no mundo, preencha **Onde aparece** (seção 8). Sem isso ele existe, mas ninguém o encontra.

Para mudar um item, clique nele na lista, mude o que quiser e clique em **Salvar**.

## 5. Os tipos

### Consumível

Usar recupera vida ou mana (como o coração e a poção). Preencha **Cura (vida)**, **Mana** ou os dois.
Para comparar: o coração cura 25, a poção de mana dá 20, e quem começa tem 100 de vida e 50 de mana.

### Material

Não faz nada sozinho: serve para guardar e vender na loja (como a geleia de geleca e a carapaça de besouro).
Bom para drops de monstros e, no futuro, para receitas.

### Equipamento

Vai no botão A ou no C. Aparecem mais campos:

- **Comporta-se como:** o jeito de lutar. O item usa a animação e os golpes da arma escolhida.

| Escolha | O que faz |
| --- | --- |
| Espada | golpe, giro carregado (segurar e soltar) e dash |
| Arco | atira flechas na mira |
| Cajado de Fogo | bola de fogo; segurando, explosão |
| Cajado de Luz | cura você e quem estiver perto; segurando, cura maior que empurra |
| Grimório Sombrio | sombra que deixa lento e rouba vida; segurando, maldição |
| Gancho | corrente (8 tiles) que prende em pilares e puxa você até lá, por cima de água e buracos; atordoa monstros e traz itens |

- **Dano por golpe** (só espada e arco): a espada inicial tira 10, o arco inicial tira 10 por flecha. Vazio = o da arma
  inicial. Na espada, o giro e o dash crescem junto (dano 15 dá giro 30 e dash 30), e no PvP também.
- **Atributos:** o que o item dá enquanto estiver no botão A ou no C. Vazio = 0.

| Atributo | O que faz |
| --- | --- |
| Ataque | dano a mais em cada golpe de espada e flecha |
| Poder mágico | dano a mais nas magias e cura a mais no Cajado de Luz |
| Velocidade de ataque (%) | golpear, atirar, conjurar e carregar mais rápido (até 50%) |
| Defesa | leva menos dano: 100 de defesa = metade do dano |
| Vida e Mana | máximo a mais (equipar não cura, só aumenta o máximo) |
| Vida e mana por segundo | regeneração a mais |

- **Cor própria:** marque e escolha a cor. Na espada, muda a lâmina; no cajado, a pedra da ponta; no arco, a madeira.

> Entre jogadores (PvP) os atributos valem a metade. Assim um item bom ajuda, mas não decide a briga sozinho.

### Vestir

Cabeça, corpo, pés, colar ou anel. No jogo, o item sai da mochila e vai para o boneco do inventário (um de cada por
vez; vestir outro no mesmo lugar troca os dois). Os campos:

- **Onde se veste:** cabeça, corpo, pés, colar ou anel.
- **Atributos:** os mesmos do equipamento, valendo enquanto estiver vestido. Defesa é o natural para cabeça, corpo e
  pés; colar e anel combinam com poder mágico, velocidade de ataque e regeneração.
- **Sorteio e efeito:** iguais aos do equipamento (veja abaixo). Efeito de vestir só pode ser roubo de vida, veneno ou
  explode ao derrubar, e soma com o da arma.

Por enquanto o que se veste não aparece desenhado no personagem: só o ícone (16×16) no inventário.

### Raridade, sorteio e efeitos

Todo item tem uma **raridade** (campo "Raridade", logo abaixo do tipo). Ela muda a cor do nome, a borda no inventário e
o brilho do item no chão, e decide se ele tem sorteio ou efeito:

| Raridade | Cor | O que tem |
| --- | --- | --- |
| Comum | branco | o básico; equipamento comum às vezes vem com 1 atributo sorteado |
| Incomum | verde | equipamento vem com 1 atributo sorteado |
| Raro | azul | equipamento vem com 2 atributos sorteados |
| Épico | roxo | fixo (sem sorteio), com um efeito; achar é anunciado no chat |
| Lendário | dourado | fixo e único, com um efeito; achar é anunciado no chat |

- **Sorteio** (comum, incomum e raro): em "Sorteio", preencha o mínimo e o máximo de cada atributo que pode sair
  (por exemplo, Ataque de 2 a 4 e Defesa de 5 a 10). Cada exemplar que cai de um monstro ou sai de um baú sorteia
  entre eles, então duas "Espada de Ferro" podem ser diferentes. Na loja, o item sai sem sorteio. No inventário, um
  "+" verde marca o exemplar sorteado. Equipamento não empilha: cada exemplar fica no seu espaço.
- **Efeito** (épico e lendário): muda o jeito de lutar, não só o número. Vale enquanto o item está no A ou no C, contra
  monstros.

| Efeito | O número quer dizer | Só para |
| --- | --- | --- |
| Roubo de vida | % do dano que você dá que volta como vida | qualquer arma |
| Veneno | dano por segundo no monstro atingido, por 3 s | qualquer arma |
| Flecha que atravessa | quantos monstros a flecha atravessa antes de parar | arco |
| Onda ao girar | dano da onda que o giro carregado solta em volta | espada |
| Explode ao derrubar | dano da explosão do monstro que você derruba | qualquer arma |

> **Regra do lendário:** todo lendário precisa de um caminho garantido, além da sorte: numa loja, num monstro com
> 100% (um chefe, por exemplo) ou num baú com 100%. Se faltar, "Onde aparece" avisa em amarelo.

## 6. O ícone

- **Tamanho: 16 × 16 pixels**, em **PNG com fundo transparente**. Outro tamanho é recusado (a Oficina diz o tamanho
  que a imagem tem).
- O desenho pode ser menor que o quadro: a borda vazia some no jogo. Os ícones de hoje usam uns 10 × 9 no meio.
- Contorno escuro (como os ícones atuais) ajuda o item a aparecer no chão.
- Programas grátis para desenhar pixel art: **Piskel** (no navegador), **LibreSprite** ou **Aseprite**. Crie uma
  imagem de 16 × 16, desenhe e exporte em PNG.
- Dica: para começar rápido, abra um ícone que já existe (estão em `content/items/`, um `.png` por item), mude as cores
  e salve com outro nome.

## 7. A calculadora de equilíbrio

Enquanto você digita, a calculadora mostra o que os números significam na prática:

- **Golpes para derrubar** cada monstro. Para comparar, com a espada inicial: Geleca 2, Besouro 3, Morcego 1,
  Rei Geleca 40.
- **Dano por segundo**, comparado com a arma inicial (a velocidade de ataque entra na conta).
- **PvP:** em quantos golpes derruba quem está começando (100 de vida).
- **Defesa:** quanto dano a menos leva.
- Nos consumíveis: a cura em corações e em % da vida.

As linhas com **⚠** são avisos: o número saiu muito do padrão (por exemplo, derrubar o Rei em 10 golpes ou menos,
o dobro do dano da espada inicial, defesa de 100 ou mais). Não é proibido: um item lendário pode ser forte. Mas aí ele
deve ser raro, caro ou difícil de conseguir.

> A calculadora só faz a conta. No jogo, esquiva, empurrão e erro mudam tudo: sempre teste (seção 9).

## 8. Onde aparece

Depois de criar o item, a seção **Onde aparece** diz como os jogadores conseguem ele:

- **Lojas:** **Vende por** é o preço que o jogador paga na loja; **Compra por** é quanto a loja paga quando o jogador
  vende. Em ouro. Vazio = a loja não vende (ou não compra).
- **Monstros que derrubam:** **Chance (%)** de cair quando o monstro morre e a quantidade (**Mín.** e **Máx.**).
  Chance vazia = o monstro não derruba.
- **Baús:** mostra em quais baús do mapa o item está. Para mudar, é no Tiled (no baú, a propriedade `conteudo`).

Clique em **Salvar onde aparece**. A Oficina grava no `config.yaml` só as linhas desse item (o resto do arquivo,
inclusive os comentários, fica igual) e confere o arquivo inteiro antes: se algo estiver errado, não grava e diz o
motivo.

## 9. Testar no jogo do seu PC

1. Abra o jogo do seu PC: **http://localhost:5173** (com o `npm run dev` ligado) e entre com a sua conta.
2. No chat (Enter), dê o item a você mesmo: `/dar espada-de-ferro` (ou `/dar espada-de-ferro 5` para 5 unidades).
   O `/dar` é comando de administrador.
3. Abra o inventário (**I**), escolha o item e veja os números. Equipamento: **Equipar no A** ou **Equipar no C**.
4. Teste de verdade: lute com gelecas e besouros, compre e venda na loja da Mercadora Rosa, veja se o monstro derruba.
5. Não ficou bom? Volte à Oficina, mude e salve: o jogo recebe a mudança na hora.

## 10. Subir para o servidor de produção

O que a Oficina cria são arquivos no seu PC:

- `content/items/<id>.json` (os dados) e `content/items/<id>.png` (o ícone), um par por item;
- `packages/server/config.yaml`, se você mexeu em "Onde aparece".

Para o servidor receber, esses arquivos vão para o GitHub e o servidor baixa de lá.

### No seu PC (VS Code)

1. Abra a aba **Controle do Código-Fonte** (o ícone de ramos, à esquerda).
2. Confira a lista de arquivos alterados: devem estar os `.json` e `.png` dos itens e, talvez, o `config.yaml`.
   Se aparecer algo que você não reconhece, pare e pergunte antes.
3. Escreva uma mensagem curta, por exemplo `itens: Espada de Ferro`.
4. Clique em **Commit** e depois em **Sincronizar** (ou **Push**).

### No servidor

1. Abra um terminal na pasta do jogo, no servidor.
2. Rode `git pull`.
3. Pronto. O servidor percebe sozinho os arquivos novos de itens e o `config.yaml` novo, e manda tudo para quem
   estiver jogando. **Não precisa reiniciar.**
4. Confira no terminal onde o servidor está rodando: deve aparecer `[itens] recarregados` e, se o config mudou,
   `[config] recarregada`.

> Reiniciar só é preciso quando o **código** do jogo mudou (programação nova, não itens). Aí: pare o servidor (Ctrl+C)
> e rode `npm start` de novo.

## 11. Regras de ouro

- **O id nunca muda.** Quer outro nome? Mude o nome, não o id.
- **Não apague item que alguém pode ter.** Para tirar um item de circulação, tire das lojas e dos monstros em "Onde
  aparece": quem já tem continua com ele. Se apagar os arquivos de um item que ainda está numa loja, num drop ou num
  baú, o servidor ignora a mudança e mantém o item.
- **Sempre teste no seu PC antes de subir.** Um número errado no servidor muda o jogo de todo mundo na hora.
- **Um item de cada vez.** Crie, teste, suba. Fica fácil de achar o problema se algo der errado.
- **Não edite arquivos direto no servidor.** Tudo nasce no PC e vai pelo GitHub; senão o `git pull` pode dar conflito.

## 12. Problemas comuns

**"A Oficina está desligada neste servidor."** Você abriu a Oficina no servidor de produção ou no `npm start`. Use o
`npm run dev` no seu PC e o endereço http://localhost:5173/oficina.html.

**"A Oficina é só para administradores."** O seu usuário não está em `admins` no `config.yaml` do seu PC. Ponha lá e
recarregue a página.

**"Sessão expirada. Entre de novo."** O login venceu (ou o banco do PC foi apagado). Entre de novo; se a conta não
existir mais, crie pelo jogo do PC.

**"O ícone precisa ter 16×16."** A imagem tem outro tamanho. Abra no programa de desenho e redimensione o quadro (a
tela) para 16 × 16, sem esticar o desenho.

**"Consumível precisa de cura ou mana."** Preencha Cura ou Mana, ou mude o tipo para Material.

**"Já existe um item com o id…"** Outro item já usa esse id. Mude o nome ou o id.

**No terminal do servidor: "[itens] mudança ignorada…" ou "[config] mudança ignorada…".** Algo nos arquivos está
errado (a mensagem diz o arquivo e o campo, em português). O jogo continua com a versão anterior. Corrija no PC, teste
e suba de novo.

**O item não aparece para ninguém.** Ele existe, mas não está em nenhum lugar: preencha "Onde aparece" (loja, monstro)
ou dê com `/dar`.
