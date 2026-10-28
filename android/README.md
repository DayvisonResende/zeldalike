# App Android

Um app que abre o jogo em tela cheia. O jogo continua sendo o site: atualizar o servidor atualiza o app,
sem gerar outro APK.

## Gerar o APK

1. No Android Studio: **File → Open** e escolha esta pasta (`android`).
2. Para testar: **Run ▶** com o celular ligado no USB (depuração USB ativada), ou **Build → Generate App Bundles or APKs → Generate APKs**.
   O APK sai em `app/build/outputs/apk/debug/app-debug.apk`.
3. Para distribuir aos amigos: **Build → Generate Signed App Bundle or APK → APK**, crie uma chave (guarde o arquivo
   `.jks` e as senhas fora do Git: sem eles não dá para lançar atualizações do app) e escolha `release`.

## Trocar o endereço do jogo

Em `gradle.properties`, mude `GAME_URL` e gere o APK de novo. Enquanto o site for `http://`, o app libera conexões
sem criptografia em `res/xml/network_security_config.xml`; quando o site tiver HTTPS, mude `cleartextTrafficPermitted`
para `false` lá (o arquivo explica).

## O que o app faz

- Tela cheia e sempre deitado (também em tablets e dobráveis com Android 16: o app se declara jogo), sem barras do
  sistema; a tela não apaga durante o jogo.
- Toque e ajuda na mira funcionam como no navegador do celular.
- **Controle de videogame** (Bluetooth ou USB): a WebView do Android nem sempre entende controles, então o app lê
  o controle pelo Android e entrega ao jogo (`GamepadBridge.kt`). O jogo vê um controle normal.
- **Voltar** do Android abre e fecha o menu do jogo (como a tecla Esc).
- Ao abrir: tela de abertura ("Conectando…") enquanto o app pergunta ao servidor se ele está no ar (`/api/health`, até 5 s);
  o jogo tem até 15 s para aparecer.
- Servidor fora do ar (ou sem internet): mostra a tela de manutenção, `manutencao.html` da raiz do projeto, copiada
  para o app a cada build. Ela tenta voltar ao jogo sozinha a cada 15 segundos.
- Links para fora do jogo abrem no navegador.
- **Reconexão:** o jogo volta sozinho para o mesmo personagem depois de uma queda; quando a internet volta, o app
  avisa o jogo para tentar na hora. Se o navegador interno travar, o app monta uma tela nova e abre o jogo de novo.
