# HTTPS no servidor (Windows)

Hoje o jogo abre em `http://pifatec.useconectai.com.br:2567`, sem criptografia: senhas e conversas passam abertas pela
rede, e o navegador marca "Não seguro". Com este guia o jogo passa a abrir em **https://play.useconectai.com.br**.

Quem faz o HTTPS é o **Caddy**, um programa que fica na frente do servidor do jogo. Ele tira o certificado do Let's
Encrypt (gratuito), renova sozinho a cada dois meses e repassa tudo para o jogo, inclusive a conexão em tempo real.
O servidor do jogo continua igual, na porta 2567.

```
amigo → https://play.useconectai.com.br (porta 443) → Caddy → localhost:2567 → jogo
```

São 6 passos: 1 e 2 fora do PC, 3 a 6 no PC do servidor.

## 1. DNS: criar o nome `play` (Registro.br)

1. Entre em registro.br → **useconectai.com.br** → **DNS** → **Editar zona**.
2. **Nova entrada**:
   - Tipo: **CNAME**
   - Nome: **play**
   - Dados: **pifatec.ddns.net** (o mesmo para onde o `pifatec` aponta; o No-IP continua mantendo o IP da casa em dia)
3. Salve. Leva de alguns minutos a uma hora para valer. Para conferir, no Prompt de Comando:

   ```
   nslookup play.useconectai.com.br
   ```

   Precisa responder com o IP da sua casa (o mesmo de `nslookup pifatec.useconectai.com.br`).

## 2. Roteador: abrir as portas 443 e 80

Do mesmo jeito que a 2567 está aberta, crie mais duas regras de redirecionamento de portas (port forwarding / NAT /
servidor virtual), as duas **TCP**, para o **IP do PC do servidor** na rede de casa (o mesmo IP da regra da 2567):

| Porta externa | Porta interna | Protocolo | Para quê |
| --- | --- | --- | --- |
| 443 | 443 | TCP | o jogo com HTTPS |
| 80 | 80 | TCP | o Caddy pegar o certificado e mandar quem digitar `http://` para o `https://` |

Deixe a 2567 aberta por enquanto (veja o passo 6).

Se o roteador recusar a 80 ou a 443 (algumas operadoras usam essas portas para administrar o modem), mude a porta de
administração do roteador ou me avise: há outros caminhos.

## 3. Firewall do Windows

Abra o **PowerShell como administrador** (menu Iniciar → digite PowerShell → botão direito → Executar como
administrador) e rode:

```
New-NetFirewallRule -DisplayName "Mossblade HTTPS (Caddy)" -Direction Inbound -Protocol TCP -LocalPort 80,443 -Action Allow
```

## 4. Instalar o Caddy

1. Crie a pasta `C:\caddy`.
2. Baixe o Caddy para Windows: em **github.com/caddyserver/caddy/releases**, na versão mais nova (a primeira da
   lista, sem "beta" ou "rc"), baixe o arquivo que termina em **`_windows_amd64.zip`**. Abra o zip e copie o
   **`caddy.exe`** para `C:\caddy`.
3. Copie o arquivo **`deploy\Caddyfile`** da pasta do jogo para `C:\caddy` (depois do `git pull`).

### Primeiro teste, na mão

Com o servidor do jogo ligado (`npm start`, como sempre), abra outro Prompt de Comando:

```
cd C:\caddy
caddy run
```

Nas primeiras linhas ele pede o certificado. Funcionou quando aparecer algo como
`certificate obtained successfully` com `play.useconectai.com.br`. Abra **https://play.useconectai.com.br** no
celular (no 4G, fora do Wi-Fi de casa): o jogo precisa abrir com o cadeado, e dá para entrar e jogar.

Erros comuns:

| O que aparece | O que é |
| --- | --- |
| `no such host` ou `NXDOMAIN` | o DNS do passo 1 ainda não vale; espere e tente de novo |
| `timeout during connect` ou `connection refused` | a porta 80 ou 443 não chega no PC: confira o roteador (passo 2) e o firewall (passo 3) |
| `address already in use` / `bind` | outro programa usa a 80 ou a 443 no PC (IIS, Skype antigo, outro servidor); feche-o |
| `too many failed authorizations` | o Let's Encrypt bloqueou por uma hora depois de vários erros; corrija e espere |

Para parar o Caddy: Ctrl+C.

### Ligar sozinho com o Windows

Depois que o teste deu certo, pare o `caddy run` (Ctrl+C) e, no **PowerShell como administrador**:

```
sc.exe create caddy start= auto binPath= "C:\caddy\caddy.exe run --config C:\caddy\Caddyfile"
sc.exe start caddy
```

Pronto: o Caddy vira um serviço do Windows e liga sozinho, mesmo sem ninguém logado. Ele tira o certificado de novo
na primeira vez como serviço (é normal). Para ver se está rodando: `sc.exe query caddy`. Para parar: `sc.exe stop
caddy`. Mudou o `Caddyfile`? `sc.exe stop caddy` e `sc.exe start caddy`.

## 5. Ligar o redirecionamento no jogo

No `packages\server\config.yaml` do servidor, na seção `server`:

```
  publicUrl: "https://play.useconectai.com.br"
```

Salve (o config recarrega sozinho). A partir daí, quem abrir o endereço antigo (`http://pifatec...:2567`, o link
velho do site, o app antigo) é levado para o novo. Pelo IP da rede de casa (`http://192.168...:2567`), para testes,
nada muda.

## 6. Avisar e atualizar o resto

- **Site** (mossblade.useconectai.com.br): troque o link do "Jogar agora" para `https://play.useconectai.com.br`.
- **App Android:** o novo já aponta para o HTTPS (`android/gradle.properties`); gere o APK de novo e mande para a
  galera. O app antigo continua funcionando nesse meio-tempo (o servidor manda a página para o endereço novo).
- **Porta 2567 no roteador:** quando todo mundo estiver com o app novo, apague a regra da 2567. O jogo só precisa dela
  na própria máquina (o Caddy fala com ele por dentro).

## Como saber se está tudo certo

- No navegador, o cadeado ao lado de `play.useconectai.com.br`.
- `/debug` no jogo continua mostrando o ping normal (o Caddy acrescenta menos de 1 ms, está na mesma máquina).
- No terminal do servidor, os logins aparecem como sempre. O limite de tentativas de login continua por pessoa:
  o servidor confia no Caddy para saber o IP de verdade de quem entra (`trust proxy` em `app.ts`).
