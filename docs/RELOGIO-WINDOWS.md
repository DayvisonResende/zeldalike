# Relógio de 1 ms no servidor Windows (pacote koffi)

## Para que serve

O Windows, por padrão, só "acorda" os programas a cada ~15,6 ms. O servidor do jogo precisa de um passo a cada
16,7 ms, então os passos saem amontoados e os pacotes chegam aos jogadores em rajadas (as gravações do `/debug` de
29/10/2026 mostraram envios a cada 70–80 ms, quando deveriam ser 50). No celular, isso aparece como monstros
travando e golpes atrasados.

O arquivo `packages/server/src/timer.ts` já pede ao Windows um relógio de 1 ms quando o servidor liga. Ele só precisa
do pacote **koffi**, que deixa o Node chamar essa função do Windows. Em Linux, ou sem o pacote, nada muda.

São duas partes: instalar no PC (Linux) e levar para o servidor (Windows).

## 1. No PC (Linux), na pasta do jogo (já feito em 29/10/2026)

1. Abra um terminal na pasta do jogo (`Game dos sonhos`).
2. Instale o pacote no servidor do jogo:

   ```
   npm install koffi -w @vale/server
   ```

   Instalar no Linux serve para os dois: o `package-lock.json` registra a versão de cada sistema (a de Windows é a
   `@koromix/koffi-win32-x64`), e o `npm install` do servidor baixa a dele.
3. Confira que tudo continua funcionando:

   ```
   npm test
   ```

4. No VS Code, aba **Controle do Código-Fonte**: devem aparecer `packages/server/package.json` e
   `package-lock.json` alterados. Faça o commit (por exemplo, `servidor: relógio de 1 ms no Windows`) e o push.

> No Linux o servidor não usa o koffi (o relógio do Linux já é preciso). Por isso, no PC, nada muda ao rodar o jogo.

## 2. No servidor do home lab (Windows)

1. Pare o servidor (Ctrl+C no terminal onde ele está rodando).
2. Na pasta do jogo, baixe a versão nova:

   ```
   git pull
   ```

3. Instale o pacote novo. **Este passo é obrigatório**: sem ele, o `git pull` traz o código, mas não o koffi.

   ```
   npm install
   ```

4. Ligue o servidor de novo:

   ```
   npm start
   ```

5. Confira no terminal, logo no começo, a linha do relógio:

   - `[relógio] relógio do Windows em 1 ms (passos e envios no ritmo)`: funcionou.
   - `[relógio] relógio do Windows em 15,6 ms: rode "npm install koffi -w @vale/server"...`: o pacote não foi
     instalado; volte ao passo 3.
   - `[relógio] o Windows recusou o relógio de 1 ms`: raro; me avise com a mensagem.

## 3. Testar o relógio (no Windows, sem jogar)

Na pasta do jogo, no servidor Windows (pode ser com o servidor do jogo parado ou rodando):

```
npm run clock:check
```

Ele mede o ritmo do relógio três vezes: como o Windows vem, com o relógio de 1 ms e, por fim, **com a janela
minimizada** (quando ele pedir, minimize a janela e volte depois de uns 15 segundos). A última é a que importa: o
servidor costuma ficar com a janela escondida, e o Windows 11 economiza energia com programas assim, ignorando o
relógio de 1 ms. O servidor pede para ficar fora dessa economia; a linha `[relógio]` diz se o Windows aceitou.
O laço do jogo precisa de um passo a cada 16,7 ms. Algo assim mostra que funcionou:

```
Relógio padrão       : mediana 15.6 ms · 90% até 31.2 ms · pior 31.9 ms · 120 de 240 passos atrasados (mais de 25 ms)
Com o relógio de 1 ms: mediana 16.7 ms · 90% até 17.1 ms · pior 18.0 ms · 0 de 240 passos atrasados (mais de 25 ms)
Com a janela minimizada: mediana 16.7 ms · 90% até 17.2 ms · pior 19.0 ms · 0 de 480 passos atrasados (mais de 25 ms)
```

- **A segunda e a terceira linhas com mediana perto de 16,7 ms e quase nenhum passo atrasado:** funcionou.
- **Só a terceira linha ruim:** o Windows não aceitou tirar o servidor da economia de energia; me mande a linha
  `[relógio]`.
- **As duas linhas iguais e ruins:** o relógio não ligou; veja a linha `[relógio]` que aparece entre elas.
- **A primeira linha já boa:** este Windows já estava com o relógio preciso (algum programa aberto, como o Chrome,
  pode ter pedido). O servidor pede de novo ao ligar, então continua valendo mesmo se esse programa fechar.

## 4. Conferir no jogo

1. Entre pelo celular e grave com `/debug 5` (jogue normalmente por 5 minutos).
2. O arquivo fica em `packages/server/data/telemetria/` no servidor. Traga para análise.
3. O que deve mudar na gravação:

| Medida | Antes | Esperado |
| --- | --- | --- |
| `esperaEntrePassosMax` (servidor) | 32–47 ms | perto de 17 ms |
| `intervaloEnvioMax` (servidor) | 70–80 ms | perto de 50 ms |
| `gap` (celular, entre pacotes) | ~123 ms | menor (a rede ainda soma um pouco) |
| `delay` (celular, atraso da cena) | ~190–230 ms | menor |

## Se algo der errado

- **`npm install` falha no Windows:** confira se o Node é o mesmo do resto do projeto (`node -v`) e rode de novo
  com o terminal aberto como usuário normal (não precisa de administrador).
- **Quero desfazer:** `npm uninstall koffi -w @vale/server`, commit e, no servidor, `git pull` e `npm install`.
  O servidor volta ao relógio padrão do Windows e continua funcionando.
