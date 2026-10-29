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
- [x] Pôr o seu usuário em `admins` no `config.yaml` do servidor e testar os comandos (testados no servidor).
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
- Primeiros minutos guiados (missão do Velho Tomé): adiado para depois do mapa novo (decisão de 2026-10-28).

## Sprint 5: grupo

- [x] Convidar para um grupo, sair do grupo (aba Grupo no menu, tecla G, aviso com Aceitar/Recusar e comandos no chat).
      Decidido: até 4 por grupo, alterável em `party.maxSize` no `config.yaml`. Quem convidou lidera e pode tirar alguém.
- [x] Vida dos amigos no HUD e seta verde na borda da tela apontando para cada um (nome verde, pontos verdes no mapa).
- [x] XP dividido igualmente entre quem do grupo está perto (`party.xpRange`). Decidido: loot continua livre, como antes.
- [x] Lista de quem está online e em que região (aba Grupo), com "Convidar".
- [x] Também: chat só do grupo (`Tab` até "Grupo" ou `/p`), sem fogo amigo no grupo, marcador do mapa só para o grupo.
- [ ] Testar com a galera (3 ou 4 no grupo, um em outro mapa, alguém caindo da conexão).

## Sprint 6: atributos

- [x] Dano em pontos em vez de golpes: vida dos monstros ×10 (geleca 20, besouro 30, morcego 10, Rei 400), dano de cada
      ataque na seção `weapons` do `config.yaml` (espada 10, giro 20, dash 20, flecha 10, arremesso 20, bomba 30) e das
      magias em `magic`. O jogo continua igual (geleca em 2 golpes); um teste garante isso.
- Decidido (2026-10-28): sem números de dano saltando na tela e barra de vida só nos chefes (para não poluir o visual);
  o nível continua dando só vida e mana.
- [x] Atributos: ataque, poder mágico, velocidade de ataque (até 50%), defesa (100 = metade do dano), vida, mana e
      regenerações. Vêm do que está nos botões A e C (seção `gear` do `config.yaml`, zerada: o jogo continua igual);
      o servidor calcula e manda ao cliente. Os demais de `docs/OFICINA.md` (crítico, roubo de vida…) ficam para depois.
- [x] Ficha "Atributos" no menu; números das armas no inventário; diferença em verde e vermelho ao escolher uma arma
      (o que muda se for para o A ou para o C). O servidor manda os números ao entrar e quando o config muda.
- Decidido (2026-10-28): as armas atuais ficam com os atributos zerados; os números aparecem nos itens novos, a partir da Oficina.
- [x] Fator de PvP no config (`pvp.factor`, começa em 0,5): entre jogadores vale metade do ataque, do poder mágico e da
      defesa, para item bom ajudar sem decidir a briga sozinho.
- [ ] Testar com a galera: subir com o `config.yaml` novo (vida dos monstros ×10) e conferir que o jogo continua igual.

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

Primeiros minutos guiados (missão curta do Velho Tomé: andar, atacar, pegar item, falar com a Rosa), quando o mapa novo
estiver pronto. Notificações no app Android, horta e fazenda, troca entre jogadores, construtores de NPCs, monstros e magias, receitas,
missões, minijogos, clima, música por região, eventos de temporada, acessibilidade.
