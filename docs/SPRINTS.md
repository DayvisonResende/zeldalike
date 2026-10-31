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
| 10 | Correções rápidas (pedidos de 2026-10-29) | P |

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

- Decidido (2026-10-28): a Oficina roda no PC (cria os arquivos; sobe para o servidor por commit). Arma nova: cor sobre
  o desenho atual ou uma imagem própria, que o jogo gira no golpe (sem quadros de animação). Ícones 16×16.
- [x] Itens tirados do código para arquivos: `content/items/<id>.json` e `<id>.png` (16×16), validados com erros em
      português e recarregados ao salvar (com o servidor ligado, o item novo chega aos jogadores na hora). O jogo continua igual.
- [ ] Os demais conteúdos como dados (monstros, NPCs, magias): com os construtores deles, depois.
- [x] Oficina com login de administrador (`/oficina`, só com OFICINA=1, que o `npm run dev` liga; mesma conta do jogo,
      só quem está em `admins`).
- [x] Construtor de itens, etapa A: consumíveis e materiais (nome, id que sai do nome, descrição, cura, mana, ícone PNG
      16×16 com prévia de como fica no inventário). Grava em `content/items/` e o item entra no jogo na hora.
- [x] Etapa B: equipamentos. "Comporta-se como" espada, arco, Cajado de Fogo, de Luz ou Grimório; dano próprio (espada e
      arco: giro, dash e PvP crescem junto); atributos; cor da lâmina, da pedra ou da madeira. Imagem própria: depois.
- [x] Etapa C: onde aparece. Lojas (vende por, compra por) e drops de monstros (chance, mín., máx.) gravados no
      `config.yaml` mexendo só nas linhas do item (comentários e o resto do arquivo ficam iguais; o config inteiro é
      conferido antes de gravar). Baús: a Oficina mostra onde estão; editar continua no Tiled.
- [x] Etapa D: calculadora de equilíbrio (golpes para derrubar cada monstro, dano por segundo e PvP comparados com a arma
      inicial, defesa, cura em corações; avisos em amarelo para o que sai muito do padrão).
- [x] Guia da Oficina (`docs/GUIA-DA-OFICINA.md`), também dentro dela no botão "Como usar": do zero até o item no servidor.
- [ ] Testar com a galera: criar um item de verdade, subir para o servidor e ver aparecer para todos.
- Sala de testes: depende das instâncias (sprint 8); até lá, testar com `/dar`.

## Sprint 8: instâncias e masmorra

- Decidido (2026-10-29): eu monto a primeira masmorra e você ajusta no Tiled; gancho e fragmentos funcionando agora
  (usados na masmorra), e no Vale quando o mapa novo estiver pronto; quem cai na masmorra volta ao Vale.
- [x] Instâncias: `world.instanced` no config; uma cópia por grupo (sozinho, uma só sua), criada ao entrar e descartada
      1 minuto depois de vazia. Na cópia, monstro derrubado não volta.
- [x] Primeira masmorra, a Masmorra do Musgo (7 salas, entrada atrás do Rei Geleca na caverna): chaves do grupo
      (contador no HUD), portas trancadas, salas que trancam até derrubar todos, minichefe (Covil do Besouro), quebra-cabeça
      de bloco e placa, chefe (Rei Geleca no trono). Peças no Tiled: camada `especiais` (chave, sala, fragmento),
      propriedade `minichefe`, tiles Porta trancada e Grades.
- [x] Gancho: atravessa rios puxando-se até pilares, atordoa monstros, traz itens; é o tesouro do Covil. Também como
      comportamento na Oficina ("Gancho").
- [x] Fragmentos de vida (+5 de vida máxima cada, uma vez por personagem, salvos no banco). Um na masmorra.
- [ ] No Vale novo: pilares para o gancho (atalhos e lugares escondidos) e fragmentos escondidos.
- [ ] Testar com a galera: grupo de 3 ou 4 na masmorra, alguém caindo, alguém saindo do jogo lá dentro.

## Sprint 9: raridade

- Decidido (2026-10-29): sorteio agora (cada exemplar é único) e 5 efeitos para começar.
- [x] Cinco raridades (comum a lendário): cor no nome, borda no inventário, brilho no chão (luz subindo nos épicos e
      lendários), som especial e anúncio no chat ao achar épico ou lendário.
- [x] Sorteio nos comuns (às vezes 1 atributo), incomuns (1) e raros (2), entre as faixas definidas na Oficina; o
      exemplar sorteado tem id próprio ("espada-de-ferro#defense=5"), não empilha e a loja vende primeiro o comum.
- [x] Épicos e lendários fixos, com efeito: roubo de vida, veneno, flecha que atravessa, onda ao girar, explode ao
      derrubar (Oficina, com regras: sorteio só até raro, efeito só em épico e lendário, cada efeito na arma certa).
- [x] Todo lendário com um caminho garantido: a Oficina avisa em "Onde aparece" quando falta.
- Corrigido de passagem: a previsão do celular ficava com a mochila vazia e usava a espada e o arco de base no lugar
  de cajados, gancho e equipamentos da Oficina (discordava do servidor e refazia passos).
- [ ] Criar os primeiros lendários de verdade na Oficina (com o caminho garantido de cada um) e testar com a galera.

## Sprint 10: correções rápidas

Os pequenos de `PEDIDOS.md` (itens 2, 11, 15, 1 e 7).

- [x] A hora do mundo fica no banco (a cada gravação e ao desligar) e continua ao reiniciar; mudar o config não faz a hora
      pular. `/hora` mostra; `/hora 18` (admin) muda. Testado reiniciando o servidor: parou às 8h06, voltou às 8h08.
- [x] O ícone 💬 também fecha o chat.
- [x] Placas e conversas: ✕ na caixa, `Esc` ou andar fecham (sem abrir a loja); A e B continuam passando. Direção que já
      estava apertada quando a fala abriu não fecha (só soltar e apertar de novo). Testado no PC e no celular (toque no ✕).
- [x] Portas e entradas (portais) como um arco lilás no mapa do mundo e no minimapa, pulsando; no minimapa, as já vistas
      fora do pedaço ficam presas na borda, apontando o caminho.
- [x] Convite de grupo: grande no meio da tela, nome em destaque, som de campainha, vibração e barra do tempo (60 s).
- [ ] Testar com a galera: convite de verdade (som e vibração no celular) e achar a porta da masmorra pelo minimapa.

## Inventário por tipo (vestir)

- Decidido (2026-10-29): como no Tibia, 7 espaços: A, C, cabeça, corpo, pés, colar e anel (sem escudo por enquanto).
  Armadura ainda não aparece desenhada no personagem.
- [x] Itens de vestir (`wear` no `.json`, tipo "Vestir" na Oficina): atributos, sorteio e efeito como o equipamento;
      efeitos de vestir só roubo de vida, veneno e explosão (somam com os da arma).
- [x] O que se veste sai da mochila e vai para o boneco; vestir no lugar de outro troca os dois; tirar precisa de um
      espaço livre. O servidor confere tudo e guarda no banco (coluna `wear`, migração `011_vestir`).
- [x] Mochila com abas (Tudo, Equipamento, Consumíveis, Materiais) e botão Organizar (armas, vestir, consumíveis,
      materiais; raros primeiro). Escolher algo de vestir mostra o que muda no lugar do atual; dois cliques veste.
- [x] Menu → Atributos lista o que está vestido.
- [ ] Desenhar armadura no personagem (precisa de sprites por direção).

## Depois (sem data)

Pedidos da rodada de 2026-10-29 (tela completa, lanterna, aparência, pesca, moedas, menu ao tocar em alguém…), com
análise e ordem sugerida: `PEDIDOS.md`.

Primeiros minutos guiados (missão curta do Velho Tomé: andar, atacar, pegar item, falar com a Rosa), quando o mapa novo
estiver pronto. Notificações no app Android, horta e fazenda, troca entre jogadores, construtores de NPCs, monstros e magias, receitas,
missões, minijogos, clima, música por região, eventos de temporada, acessibilidade.
