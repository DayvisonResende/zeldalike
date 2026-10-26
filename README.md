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
  maps/      mapas do mundo (JSON)
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

**Progresso:** monstros dão XP e soltam loot no chão (só quem derrubou pega nos primeiros segundos).
`I` (ou 🎒) abre o inventário; `1` usa um coração e `2` uma poção de mana. Largar um item no chão é o jeito
de passar para um amigo. XP, curva de nível, tabelas de drop e taxas ficam no `config.yaml`.

`Esc` (ou o botão ☰ na tela) abre o menu: personagem (nome, capa, cabelo), opções
(nomes sobre a cabeça: todos, só dos outros ou nenhum; som; caminhos dos monstros) e controles.
Tudo fica salvo no navegador.

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
