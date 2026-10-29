# Sprints

Cada sprint tem um objetivo, termina com uma sessão de jogo com os amigos (ver "Roteiro e playtest" em `docs/IDEIAS.md`)
e só fecha quando o que entrou foi testado. A próxima começa depois. Detalhes de cada item: `docs/PENDENCIAS.md`,
`docs/IDEIAS.md` e `docs/OFICINA.md`.

Tamanho: **P** cabe numa sessão de trabalho, **M** uma sessão inteira, **G** várias sessões.

| Sprint | Objetivo | Tamanho |
| --- | --- | --- |
| 0 | Ponto seguro: subir o que já está feito | P |
| 1 | Estabilidade: ninguém fica travado | M |
| 2 | Operação: cuidar do servidor | M |
| 3 | Itens: pegar e receber melhor | M |
| 4 | Jogar junto: mapa do mundo, marcador, levantar amigo caído | M |
| 5 | Grupo (party) | M |
| 6 | Atributos | G |
| 7 | Oficina: base e construtor de itens | G |
| 8 | Instâncias e a primeira masmorra | G |
| 9 | Raridade | M |

## Sprint 0: ponto seguro

- [x] Revisar e commitar o que está pendente no `zeldalike`: app Android, nome Mossblade, logo e ícones, tela de manutenção,
      reconexão automática, crescimento por nível menor, documentos.
- [x] Subir para o GitHub e atualizar o servidor.
- [x] Avisar a galera: a vida máxima por nível diminuiu (personagens de nível alto perdem vida máxima).

## Sprint 1: estabilidade

- [x] Reconexão com limite: uns 30 segundos tentando; depois, verifica o servidor.
- [x] Servidor no ar mas a conexão falhou: volta ao login ou aos personagens, com o motivo.
- [x] Servidor fora do ar: tela de manutenção (no app, a `manutencao.html`; no navegador, embutida no jogo).
- [x] Entrar no mundo com tempo limite (uns 10 segundos); os botões nunca travam.
- [x] Sessão expirada na tela de personagens leva ao login; "Sair" sempre visível nas telas de conta.
- [x] Tela de fundo antes de jogar: cena de título com a logo atrás do login e dos personagens; o mundo só aparece ao entrar.
- [x] Testar: servidor reiniciado, servidor desligado, sessão que deixou de valer (testados no navegador).
- [x] App Android sem servidor: tela de abertura e manutenção em até 5 s (antes ficava preto; testado no celular).
- [ ] Testar no celular: celular dormindo, troca de Wi-Fi para 4G (na sessão de jogo com os amigos).

## Sprint 2: operação

- [x] Backup automático do banco: cópia periódica do SQLite, guardando as últimas N.
- [x] Administradores numa lista no `config.yaml`.
- [x] Comandos de administrador no chat: `/anunciar`, `/expulsar`, `/invasao` (começar agora), `/dar` (item).
- [x] Moderação básica: filtro de palavrões (desligável), silenciar um jogador.
- [x] Também: `/silenciar` e `/dessilenciar`, `/backup`, `/quem`, `/ajuda` e `/ignorar` (pessoal, no jogo).
- [ ] Pôr o seu usuário em `admins` no `config.yaml` do servidor e testar os comandos com os amigos.
- HTTPS com Caddy: fica para o fim (decisão de 2026-10-28).

## Sprint 3: itens

- [x] Item no chão é pego com o botão de Ação ("Pegar"); segurar pega tudo em volta; setinha em cima do item.
- [x] Baú manda tudo para a mochila; decidido: o baú guarda o resto, só para quem abriu (salvo no personagem).
- [x] Decidido: o ouro continua caindo no chão (e é pego com o botão, como os itens).
- [x] Drop de monstro: continua no chão. Sugestão para depois: saquinho pessoal só no chefe (ver `docs/IDEIAS.md`).

## Ajustes entre o sprint 3 e o 4

- [x] Cajado: em pé ao lado do corpo, sobe e inclina para a mira ao conjurar (antes parecia um arco apontado).
- [x] PvP na tela: espadas cruzadas no selo "PvP ligado" do HUD; caveira ao lado do nome de quem está com PvP.
- [x] Tela cheia no PC: botão ⛶ no canto (no celular continua no controle de toque; no app já é tela cheia).

## Sprint 4: jogar junto

- [x] Mapa do mundo (tecla M, botão 🗺, L3 no controle), desenhado a partir do próprio mapa, **explorado** (se revela
      andando, salvo no personagem): regiões, você, quem está no mapa, marcadores, lojas, portais, zona segura e baús.
      O som saiu do M e ficou só em Opções.
- [x] Minimapa opcional no canto (liga e desliga em Opções; tocar abre o mapa).
- [x] Marcar no mapa: tocar ou clicar põe "venham aqui!" (todos no mesmo mapa veem por 1 minuto; quando o grupo existir, só o grupo).
      No mundo, alfinete; fora da tela, seta na borda.
- [x] Levantar amigo caído: segurar o botão de Ação ao lado por 1,5 s levanta com metade da vida; a contagem para enquanto
      alguém levanta. Decidido: continua 5 s caído (mais tensão).
- [ ] Primeiros minutos guiados: missão curta do Velho Tomé (andar, atacar, pegar item, falar com a Rosa).

## Sprint 5: grupo

- [ ] Convidar para um grupo, sair do grupo.
- [ ] Vida dos amigos no HUD e seta na borda da tela apontando para cada um.
- [ ] XP e loot divididos no grupo.
- [ ] Lista de amigos online e em que região.

## Sprint 6: atributos

- [ ] Dano em pontos em vez de golpes (vida dos monstros e dano das armas em números, mantendo a sensação de hoje).
- [ ] Atributos: ataque, defesa, poder mágico, velocidade de ataque, vida, mana, regenerações e os demais de `docs/OFICINA.md`.
- [ ] Ficha "Atributos" no menu; números no item; diferença em verde e vermelho ao equipar.
- [ ] Atributos nas armas atuais; fator de PvP no config.

## Sprint 7: Oficina (base e itens)

- [ ] Conteúdo como dados em `content/` (validado, erros em português, recarregado ao salvar).
- [ ] Itens tirados do código para arquivos, com ícone em PNG; o jogo continua igual.
- [ ] Oficina com login de administrador.
- [ ] Construtor de itens (com atributos), sala de testes e calculadora de equilíbrio.

## Sprint 8: instâncias e masmorra

- [ ] Instâncias: uma cópia do mapa por grupo, criada ao entrar e descartada ao esvaziar.
- [ ] Primeira masmorra (6 a 10 salas): chaves (contador), sala que tranca até matar os monstros, minichefe, chefe.
- [ ] Item de exploração (por exemplo, o gancho) que também abre partes do Vale.
- [ ] Fragmentos de vida escondidos no Vale.

## Sprint 9: raridade

- [ ] Cinco raridades (comum a lendário), cores, brilho no chão, som e anúncio no chat.
- [ ] Lendários fixos criados na Oficina; sorteio leve nos comuns, incomuns e raros.
- [ ] Todo lendário com um caminho garantido.

## Depois (sem data)

Notificações no app Android, horta e fazenda, troca entre jogadores, construtores de NPCs, monstros e magias, receitas,
missões, minijogos, clima, música por região, eventos de temporada, acessibilidade.
