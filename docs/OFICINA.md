# Oficina: construtores de conteúdo

A Oficina é uma área só para administradores, servida pelo próprio servidor, onde itens, monstros, NPCs, magias
e outros conteúdos são criados por formulários, sem programar. Abre no PC ou no celular.

Tudo que a Oficina cria vira arquivo em `content/` (dados + imagens PNG): entra no jogo na hora, sem reiniciar
o servidor (como o `config.yaml` hoje), e fica versionado no Git junto com os mapas.

## A regra de todos os construtores

O construtor combina **peças que o jogo já sabe fazer**. Um comportamento novo (um monstro que cava, uma magia
que teletransporta, um bumerangue que volta) precisa ser programado uma vez; depois vira peça e aparece na lista
de todos os construtores que a usam.

## Como é hoje

| O que | Onde está hoje | Para a Oficina funcionar |
| --- | --- | --- |
| Itens (nome, descrição, cura) | código (`packages/shared/src/items.ts`) | dados: um arquivo por item |
| Ícones e sprites | desenhados pixel a pixel no código | imagens PNG enviadas pela Oficina |
| Monstros (tipos e comportamento) | código (`systems/ai.ts`, `systems/boss.ts`) | dados + escolha de comportamento numa lista |
| Números dos monstros, lojas, drops, magias | `config.yaml` | já são dados: falta a tela |
| NPCs | objetos no Tiled (nome, texto, aparência, loja) | definidos na Oficina; o Tiled só posiciona |
| Magias | três fixas no código (`systems/magic.ts`) | montadas por peças (forma + efeitos) |
| Ataque, defesa e outros atributos | **não existem** (o dano é contado em golpes) | sistema novo |
| Receitas de criação | **não existem** | sistema novo |

## Os construtores principais

| Construtor | O que dá para fazer sem programar | Peças que o jogo já tem | Depende de |
| --- | --- | --- | --- |
| **Itens** | nome, descrição, ícone, tipo (consumível, material, equipamento), cura e mana, preço, onde cai, comportamento de arma com os números (dano, mana, alcance) | consumível, material, espada, arco, Cajado de Fogo, de Luz, Grimório | itens como dados; atributos para "ataque", "defesa" e bônus |
| **Monstros** | nome, sprite, vida, dano, velocidade, alcance de visão, XP, drops, só de dia ou de noite, tempo para renascer | saltador (geleca), patrulheiro (besouro), voador (morcego), galinha, chefão (pulos, onda de choque, filhotes, fúria) | sprites em PNG com quadros de animação |
| **NPCs** | nome, aparência, falas, para onde olha, loja | conversa, loja | o NPC ser definido na Oficina e só posicionado no Tiled |
| **Magias** | forma, efeitos, números, visual (cor das partículas, som) e a versão carregada | formas: projétil, área em volta · efeitos: dano, cura, lentidão, roubo de vida, empurrão, queimar, acender tocha, revelar parede ilusória | magias montadas por peças em vez de três fixas |

Exemplo de magia sem código: projétil + dano + lentidão + partículas azuis = uma magia de gelo.

### Item: o formulário

1. Nome, descrição e ícone (PNG).
2. Tipo: consumível, material ou equipamento (botão A ou C; armadura no futuro).
3. Equipamento: comportamento de uma lista (como espada, como arco, como Cajado de Fogo…) e os números dele.
4. Atributos que ele dá: +ataque, +defesa, +vida, +mana, +velocidade (depois que os atributos existirem).
5. Preço na loja, de quais monstros ou baús cai, e a receita (depois que as receitas existirem).
6. **Criar**: o item entra no jogo na hora.

## O item faz o personagem

Decisão: **quem deixa o personagem forte é o item, não o nível.** O nível ajuda um pouco (+vida e +mana) e dá a sensação
de progresso, mas não deixa ninguém "roubado". É o "você é o que veste" do Albion e o "o item é o poder" do Zelda.

Por que: ninguém fica para trás por ter jogado menos. Um amigo que entrou ontem, com um bom equipamento, vai para a
caverna com quem joga desde o começo. Diferença de nível separaria o grupo, e isso está na lista do que evitar em
`docs/IDEIAS.md`.

Na prática:

- **Nível dá pouco:** +2 de vida e +1 de mana por nível (`leveling` no `config.yaml`). No nível 50: 198 de vida e 99 de mana,
  2 vezes o início (antes eram +10 e +5, quase 6 vezes).
- **O nível vale de outro jeito:** título, aparência (capas e cores liberadas por nível), acesso a lugares. Sem poder demais.
- **Maestria** (ficar melhor com a arma que mais usa), se entrar, dá bônus pequenos pelo mesmo motivo.
- **Equipamento inicial decente:** quem chega dá conta das gelecas e dos besouros com a espada e o arco iniciais.
- **O ritmo de conseguir itens vira o ritmo do jogo:** de onde o item vem e quão difícil é conseguir passa a ser a progressão.
- **PvP:** com o item decidindo, o fator de PvP no config passa a ser essencial.

### De onde vêm os itens

Chefe, baú, receita, loja, drop de monstros, missão, e o que mais vier (eventos, pesca, horta). Cada origem tem uma
faixa típica de raridade (ver "Raridade").

## Atributos

Atributos são o que faz um item ser diferente de outro. Sem eles, uma espada é igual a qualquer outra espada.
No construtor de itens, são campos do formulário: ao criar o item, digitam-se os números.

Exemplo (fictício): **Espada do Administrador**, marcada como "só admin".

| Atributo | Valor |
| --- | --- |
| Ataque | +1 |
| Defesa | +1 |
| Velocidade de ataque | +15% |
| Redução de recarga | +10% |
| Vida | +10 |
| Mana | +10 |
| Regeneração de vida | +1 por segundo |
| Regeneração de mana | +1 por segundo |

### O que cada atributo faz

| Grupo | Atributo | No jogo |
| --- | --- | --- |
| Ataque | Ataque | dano a mais em cada golpe, flecha e magia de dano |
| | Poder mágico | aumenta dano e cura das magias; separado do ataque, para mago e guerreiro não disputarem o mesmo item |
| | Velocidade de ataque | golpe, giro carregado, arco e conjuração mais rápidos (com teto, por exemplo 50%) |
| | Crítico (chance e dano) | um golpe às vezes tira o dobro |
| | Roubo de vida | uma parte do dano volta como vida |
| | Alcance | flecha e magia vão mais longe |
| | Empurrão | inimigos voam mais longe ao apanhar |
| Defesa | Defesa | reduz o dano recebido (monstros, onda de choque, PvP), com retorno decrescente |
| | Espinhos | quem bate em você leva parte do dano |
| | Resistência a lentidão | sombra e maldição duram menos em você |
| | Fôlego | mais tempo invencível depois de levar dano |
| Recursos | Vida / Mana | +máximo de vida e de mana (hoje já crescem por nível) |
| | Regeneração de vida / mana | +pontos por segundo (hoje 2 e 3 por segundo, no config) |
| | Redução de recarga | dash, carregar o giro ou a magia forte e o intervalo entre itens mais curtos (com teto) |
| | Custo de mana | magias mais baratas |
| Movimento e exploração | Velocidade de movimento | anda mais rápido |
| | Dash | dash mais longo ou mais rápido |
| | Luz | luz maior à noite e na caverna |
| Calma e economia | Sorte | mais chance de drop |
| | Pescaria | zona verde da pesca maior |
| | Bônus de XP / ouro | ganha mais |
| | Mochila | mais espaços no inventário |

### O que muda no jogo

1. **Dano em pontos, não em golpes.** Hoje a geleca leva 2 golpes, qualquer que seja a espada. A vida dos monstros e o dano
   das armas passam a ser números (por exemplo, geleca com 20 de vida e espada com 10 de dano), numa escala que mantém a
   sensação de hoje.
2. **De onde vêm:** do equipamento nos botões A e C, da futura armadura (capuz, peito, botas) e do nível; depois, de
   efeitos temporários (uma comida que dá +velocidade por 5 minutos).
3. **Regras de soma:** valores fixos somam; percentuais somam até um teto, para nada chegar a 100%.
4. **Onde o jogador vê:** uma ficha "Atributos" no menu, os números de cada item no inventário e, ao equipar, a diferença
   em verde ou vermelho ("+5 ataque, −2 defesa").
5. **O servidor calcula tudo.** O cliente recebe o resultado, para prever o próprio movimento e a velocidade de ataque sem atraso.
6. **PvP:** hoje o dano entre jogadores é uma tabela fixa no config. Com atributos, item forte vira vantagem no PvP; um
   fator de PvP no config ajusta isso.
7. **Itens "só admin":** nunca caem, não se vendem e não aparecem na loja.
8. **Redução de recarga** só ganha peso quando as magias tiverem recarga; hoje quase nada tem.

## Raridade

A raridade é o que faz o coração bater quando algo brilha no chão. Ela **não é só um número maior**: cada raridade traz
mais atributos, e as altas trazem efeitos que mudam o jeito de jogar.

| Raridade | Cor | O que tem |
| --- | --- | --- |
| Comum | branco | o básico, sem atributos extras |
| Incomum | verde | 1 atributo extra (+vida, +velocidade…) |
| Raro | azul | 2 ou 3 atributos extras |
| Épico | roxo | atributos extras e um efeito (veneno, roubo de vida, explode ao matar…) |
| Lendário | dourado | um efeito único: não é uma espada mais forte, é uma espada diferente (solta uma onda ao girar, flecha que atravessa…) |

### Fixo ou sorteado

- **Lendários e épicos especiais são fixos,** criados na Oficina com nome e identidade ("Lâmina do Musgo" é sempre igual).
- **Comuns, incomuns e raros podem ter um sorteio leve:** um atributo extra entre alguns possíveis, definidos na Oficina.
  Dá surpresa nos drops do dia a dia, sem virar "matar o mesmo chefe 50 vezes atrás do sorteio perfeito".

### Raridade por origem

| Origem | Raridade típica |
| --- | --- |
| Loja | comum e incomum: a base que todo mundo consegue |
| Drop de monstros | comum a raro, chance pequena de épico |
| Baú | incomum a raro; baús de segredo, épico |
| Receita | o que for definido na Oficina; bom caminho para o épico garantido juntando materiais |
| Missão | épico ou lendário garantido como recompensa |
| Chefe | raro a épico, chance de lendário |

**Regra:** todo lendário tem pelo menos um caminho garantido (missão, segredo ou receita), além da chance de sorte.
Quem joga e explora sempre consegue; a sorte só adianta.

### Para ficar gostoso de ver

- No chão, o item brilha na cor da raridade, com uma luz subindo nos épicos e lendários.
- Som diferente para épico e lendário.
- No chat do servidor: "Joel encontrou **Lâmina do Musgo** (lendária)!".
- No inventário, a borda do espaço na cor da raridade.

**Só raridade, sem níveis de equipamento (I, II, III):** os dois juntos confundem ("raro nível II" é melhor que "épico nível I"?).
Raridade, atributos e efeitos fazem o trabalho. Para o jogo não inflar, item novo traz um jeito diferente de jogar, não
só um número maior.

## Outros construtores possíveis

| Construtor | O que faria | Situação |
| --- | --- | --- |
| Lojas | o que cada lojista vende e compra, e os preços | já é dado no config; falta a tela |
| Tabelas de drop e baús | o que cai de quem, com que chance | já é dado; falta a tela |
| Receitas | "3 carapaças + 50 de ouro no ferreiro = Escudo" | sistema novo, simples |
| Missões | "fale com X", "traga 5 geleias", "derrote o Rei", e a recompensa | sistema novo |
| Diálogos com escolhas | conversa que ramifica e leva a uma missão ou à loja | evolução dos NPCs |
| Eventos | invasões com outros monstros, horários e prêmios | a invasão já existe; generalizar |
| Cosméticos | capas, cabelos e chapéus à venda | precisa da arte |
| Tiles | tile novo com regras de uma lista (sólido, cortável, queimável, empurrável…) | possível; os mapas continuam no Tiled |
| Painel do servidor | ajustar o `config.yaml` por botões, anunciar, expulsar, iniciar um evento | as ferramentas de administrador pendentes |

**Fora do escopo:** um editor de mapas. O Tiled já faz isso bem; a Oficina só ajuda a usar no Tiled o que foi criado nela.

## Mais ideias para a Oficina

Quatro grupos: testar com segurança, criar mais rápido, envolver os amigos e ligar a Oficina ao jogo.
As marcadas com ★ são as mais valiosas.

### Testar antes de publicar

- ★ **Sala de testes:** "Testar" leva a uma cópia particular do mapa, invisível para os outros. Lá se recebe o item,
  chama o monstro ou solta a magia e vê funcionando, sem afetar ninguém. Usa as instâncias planejadas para a masmorra
  e a fazenda (ver `docs/IDEIAS.md`).
- ★ **Calculadora de equilíbrio:** enquanto os números são digitados, a Oficina mostra o efeito prático ("mata uma geleca
  em 2 golpes", "o Rei Geleca em 18 golpes", "dano por segundo 40% acima da espada inicial") e avisa em amarelo o que
  sair muito do padrão.
- **Rascunho e publicado:** cria-se com calma; só "Publicar" coloca no jogo. Dá para agendar ("a Espada de Gelo aparece
  sexta às 20h"), por exemplo no início de um evento.
- **Histórico e desfazer:** cada mudança fica registrada com quem fez e quando; um botão volta à versão anterior.

### Criar mais rápido

- ★ **"Baseado em…":** criar a Geleca de Gelo a partir da Geleca mudando poucos campos, ou gerar as versões incomum, rara
  e épica de uma espada a partir da comum.
- ★ **Efeitos reaproveitáveis:** veneno, queimadura, lentidão, força, escudo viram peças com nome, usadas por itens, magias,
  comidas e monstros. O "Veneno" criado uma vez serve para uma adaga, uma geleca venenosa e uma poção.
- **Editor de pixel embutido:** um editor simples de 16×16 com a paleta do jogo, para quem não tem Aseprite, incluindo
  trocar as cores de um sprite existente (a geleca roxa vira azul de gelo em um clique).
- **Tabelas de tesouro compartilhadas:** "tesouro comum", "tesouro raro" definidas uma vez e usadas por baús, monstros e missões.

### Envolver os amigos

- ★ **Amigos sugerem, o administrador aprova:** um amigo cria um monstro ou uma arma e isso vai para uma fila de aprovação.
  O administrador revisa, testa na sala de testes e publica com o nome do criador ("Geleca Raivosa, criada por Joel").
  O grupo inteiro fazendo o jogo junto.
- **Papéis:** administrador (tudo), criador (propõe), jogador (nada).
- **Pacotes de conteúdo:** exportar um conjunto ("Evento de Halloween: 3 monstros, 2 itens, 1 missão") e importar de novo
  no ano seguinte.

### Ligar a Oficina ao jogo

- ★ **"Onde isso aparece?":** cada item mostra em que lojas está, quais monstros e baús o derrubam e quais receitas e
  missões o usam. Impede apagar algo que ainda está em uso.
- **Números reais do jogo:** quantos jogadores têm o item, quantas vezes a magia foi usada, qual monstro mais derruba
  gente. É o retorno que o playtest do `docs/IDEIAS.md` pede, sem precisar perguntar.
- **Pronto para o Tiled:** monstros e NPCs criados na Oficina aparecem sozinhos na paleta do Tiled, para arrastar ao mapa.
- **Zonas de caça:** em vez de um ponto por monstro, uma área desenhada no Tiled e, na Oficina, "aqui nascem até 6 gelecas
  e 2 besouros".
- **Inspecionar no jogo:** como administrador, segurar uma tecla sobre um monstro ou item abre a ficha dele na Oficina.
- **Conquistas e títulos:** "Pescou 50 peixes" dá o título "Pescador" ao lado do nome. Usa o que o jogo já conta.

**Para entrar junto com a base:** sala de testes, calculadora de equilíbrio e "amigos sugerem, o administrador aprova".
As duas primeiras evitam que um número errado estrague o jogo de todo mundo; a terceira transforma a Oficina num motivo
a mais para jogar junto.

## Ordem

1. **Base:** conteúdo como dados em `content/` (validado, com erros em português, recarregado ao salvar) e a Oficina vazia,
   com login de administrador. É a parte mais trabalhosa, porque mexe em como o jogo carrega itens, monstros e NPCs;
   por fora, o jogo continua igual. Feita uma vez, cada construtor depois sai bem mais rápido.
2. **Itens**: o mais usado, e testa a base.
3. **NPCs e lojas**: rápidos, e já mudam o mundo.
4. **Monstros**: pede sprites em PNG (casa com o plano de desenhar os próprios sprites).
5. **Magias por peças.**
6. Depois, conforme o grupo pedir: receitas, missões, eventos e o painel do servidor.

**Atributos** (ver a seção acima) podem vir logo depois dos itens, porque itens sem atributos ficam pobres. A primeira
parte é o dano em pontos, a ficha de atributos e os atributos nas armas atuais.

Cada etapa segue o critério de `docs/IDEIAS.md`: entra atrás de uma chave no config, termina com uma sessão de jogo
com os amigos, e a próxima só começa se a anterior ficou boa.

## Cuidados

- **Ids estáveis:** o nome de um item pode mudar; o id (`cajado-de-fogo`) não, porque inventários e o banco guardam o id.
- **Apagar com cuidado:** um item apagado pode estar no inventário de alguém. A Oficina avisa e oferece "desativar" em vez de apagar.
- **Validar antes de valer:** um item com erro (ícone faltando, número fora do limite) não entra; a Oficina mostra o erro em português,
  como o `config.yaml` faz hoje.
- **Equilíbrio:** número novo muda o jogo para todos na hora. Vale testar num servidor de teste antes.
