# Pendências

Correções e melhorias técnicas que já se sabe que precisam ser feitas. Ideias de jogo ficam em `docs/IDEIAS.md`;
ferramentas de criação de conteúdo, em `docs/OFICINA.md`.

## Correções

### Travado depois de uma desconexão longa

**O que aconteceu:** o personagem reconectou sozinho uma vez, mas depois de muito tempo parado desconectou de novo.
O jogo ficou travado na parte do personagem, sem conseguir voltar à tela de login para entrar de novo.

**Causas prováveis (a confirmar):**

1. A reconexão automática tenta para sempre: não desiste e nunca devolve o jogador ao login (`connectionLost` e `retry`
   em `packages/client/src/main.ts`).
2. Entrar no mundo não tem tempo limite: se o servidor não responde direito, o "Jogar" da tela de personagens fica
   esperando para sempre, com os botões desabilitados (`enterWorld` e `play`).
3. Sessão expirada na tela de personagens: o erro aparece, mas o jogador não é levado de volta ao login.

**Como deve ficar:**

- Reconexão com limite: tenta por uns 30 segundos. Se não voltar, verifica o servidor:
  - **servidor no ar** (a conexão falhou por outro motivo, como sessão expirada ou personagem em uso): volta para a tela
    de login ou de personagens, com uma mensagem dizendo o motivo;
  - **servidor fora do ar:** vai para a tela de manutenção. No app Android, a `manutencao.html` que já existe; no
    navegador, uma tela de manutenção embutida no próprio jogo (o servidor fora do ar não consegue entregar a página).
- Entrar no mundo com tempo limite (uns 10 segundos): passou disso, mostra o erro e libera os botões.
- Na tela de personagens, sessão expirada (erro 401) leva direto ao login.
- Um caminho sempre visível para voltar ao login ("Sair"), em qualquer tela de conta.

## Melhorias

### Tela de fundo antes de jogar

Hoje as telas de login, de personagens e de criação aparecem por cima do mundo do jogo, já rodando no fundo.
A ideia é esconder o jogo até o jogador entrar de fato: uma tela de fundo própria (uma cena de título em pixel art com
a logo do Mossblade, no estilo da tela de manutenção) atrás das telas de conta. O mundo só aparece ao entrar com o personagem.

### Infraestrutura (já conhecidas)

- **HTTPS** (adiado): hoje as senhas trafegam sem criptografia. Caddy na frente do servidor (`reverse_proxy localhost:2567`).
  Com HTTPS, o app Android pode tirar a liberação de `http://` (`res/xml/network_security_config.xml`).
- **Backup automático do banco.**
- **Ferramentas de administrador:** anunciar, expulsar, iniciar um evento (o "painel do servidor" em `docs/OFICINA.md`).
- **Teste de carga:** simular uns 100 jogadores antes de chamar todo mundo.
