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
| 4 | Jogar junto: levantar amigo caído e marcar no mapa | M |
| 5 | Grupo (party) | M |
| 6 | Atributos | G |
| 7 | Oficina: base e construtor de itens | G |
| 8 | Instâncias e a primeira masmorra | G |
| 9 | Raridade | M |

## Sprint 0: ponto seguro

- [ ] Revisar e commitar o que está pendente no `zeldalike`: app Android, nome Mossblade, logo e ícones, tela de manutenção,
      reconexão automática, crescimento por nível menor, documentos.
- [ ] Subir para o GitHub e atualizar o servidor.
- [ ] Avisar a galera: a vida máxima por nível diminuiu (personagens de nível alto perdem vida máxima).

## Sprint 1: estabilidade

- [x] Reconexão com limite: uns 30 segundos tentando; depois, verifica o servidor.
- [x] Servidor no ar mas a conexão falhou: volta ao login ou aos personagens, com o motivo.
- [x] Servidor fora do ar: tela de manutenção (no app, a `manutencao.html`; no navegador, embutida no jogo).
- [x] Entrar no mundo com tempo limite (uns 10 segundos); os botões nunca travam.
- [x] Sessão expirada na tela de personagens leva ao login; "Sair" sempre visível nas telas de conta.
- [x] Tela de fundo antes de jogar: cena de título com a logo atrás do login e dos personagens; o mundo só aparece ao entrar.
- [x] Testar: servidor reiniciado, servidor desligado, sessão que deixou de valer (testados no navegador).
- [ ] Testar no celular: celular dormindo, troca de Wi-Fi para 4G (na sessão de jogo com os amigos).

## Sprint 2: operação

- [ ] Backup automático do banco: cópia periódica do SQLite, guardando as últimas N.
- [ ] Administradores numa lista no `config.yaml`.
- [ ] Comandos de administrador no chat: `/anunciar`, `/expulsar`, `/invasao` (começar agora), `/dar` (item).
- [ ] Moderação básica: filtro de palavrões (desligável), silenciar um jogador.
- [ ] (Paralelo, no seu home lab) HTTPS com Caddy.

## Sprint 3: itens

- [ ] Item no chão é pego com o botão de Ação ("Pegar"); segurar pega tudo em volta.
- [ ] Baú manda tudo para a mochila; decidir a regra de espaço (tudo ou nada, ou o baú guarda o resto).
- [ ] Decidir se o ouro vai direto para a carteira.
- [ ] Drop de monstro: continua no chão até a decisão (chão, dentro da criatura ou saquinho) em `docs/IDEIAS.md`.

## Sprint 4: jogar junto

- [ ] Levantar amigo caído: segurar o botão de Ação em cima dele o levanta com metade da vida.
- [ ] Marcar no mapa: "venham aqui!" que os outros veem.
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
