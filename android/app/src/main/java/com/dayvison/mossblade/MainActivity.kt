package com.dayvison.mossblade

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.ActivityInfo
import android.graphics.Color
import android.hardware.input.InputManager
import android.net.ConnectivityManager
import android.net.Network
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.window.OnBackInvokedDispatcher
import java.net.HttpURLConnection
import java.net.URL

/**
 * O app é só uma janela para o jogo: abre BuildConfig.GAME_URL numa WebView em tela cheia.
 * Toque e mira funcionam como no navegador do celular; o controle de videogame passa pelo GamepadBridge.
 * O botão Voltar do Android abre e fecha o menu do jogo (a tecla Esc). Servidor fora do ar: manutencao.html.
 *
 * Ao abrir: tela de abertura (ícone e "Conectando…") enquanto o app pergunta ao servidor se ele está no ar
 * (/api/health, até 5 s). Está: abre o jogo, com até 15 s para aparecer. Não está (ou demorou): manutenção.
 * Sem isso, com o servidor desligado de vez, a WebView ficava mais de um minuto esperando, com a tela preta.
 */
class MainActivity : Activity(), InputManager.InputDeviceListener {
    private lateinit var web: WebView   // trocada por uma nova se o navegador interno cair
    private lateinit var root: FrameLayout
    private lateinit var splash: View
    private val pad = GamepadBridge()
    private val main = Handler(Looper.getMainLooper())
    private val home: Uri = Uri.parse(BuildConfig.GAME_URL)
    private var checking = false   // perguntando ao servidor se ele está no ar
    private var visible = false    // a página atual já apareceu na tela
    private val loadTimeout = Runnable { if (!visible) { web.stopLoading(); showMaintenance(web) } }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE   // sempre deitado (as duas posições), mesmo com a rotação travada
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)   // a tela não apaga no meio do jogo
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)   // depurar pelo chrome://inspect no build de teste

        web = buildWebView()
        splash = buildSplash()
        root = FrameLayout(this).apply { setBackgroundColor(Color.BLACK); addView(web); addView(splash) }
        setContentView(root)
        hideSystemBars()

        pad.refresh()
        (getSystemService(Context.INPUT_SERVICE) as InputManager).registerInputDeviceListener(this, main)
        (getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager).registerDefaultNetworkCallback(network)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU)
            onBackInvokedDispatcher.registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT) { pressEscape() }

        if (savedInstanceState != null) { web.restoreState(savedInstanceState); splash.visibility = View.GONE } else openGame()
    }

    // Tela de abertura: fundo da cor do ícone, o ícone, "Conectando…" e uma rodinha. Some quando a página aparece.
    private fun buildSplash(): View = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        gravity = Gravity.CENTER
        setBackgroundColor(Color.rgb(14, 12, 34))
        val dp = resources.displayMetrics.density
        addView(ImageView(context).apply { setImageResource(R.mipmap.ic_launcher) }, LinearLayout.LayoutParams((96 * dp).toInt(), (96 * dp).toInt()))
        addView(TextView(context).apply {
            text = getString(R.string.connecting); setTextColor(Color.rgb(246, 242, 252)); textSize = 16f
            setPadding(0, (12 * dp).toInt(), 0, (12 * dp).toInt())
        })
        addView(ProgressBar(context).apply { isIndeterminate = true })
    }

    // Pergunta ao servidor (fora da tela principal) e decide: jogo ou manutenção.
    private fun openGame() {
        if (checking) return
        checking = true; visible = false
        splash.visibility = View.VISIBLE
        Thread {
            val up = try {
                val c = URL(BuildConfig.GAME_URL.trimEnd('/') + "/api/health").openConnection() as HttpURLConnection
                c.connectTimeout = 5000; c.readTimeout = 5000; c.useCaches = false
                // qualquer resposta do servidor (até 404, de um servidor antigo sem /api/health) quer dizer "no ar";
                // erro 5xx é de um proxy na frente com o jogo parado
                try { c.responseCode < 500 } finally { c.disconnect() }
            } catch (e: Exception) { false }
            main.post {
                checking = false
                if (!up) { showMaintenance(web); return@post }
                main.removeCallbacks(loadTimeout)
                main.postDelayed(loadTimeout, 15000)
                web.loadUrl(BuildConfig.GAME_URL)
            }
        }.start()
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun buildWebView(): WebView {
        val web = WebView(this).apply {
            setBackgroundColor(Color.BLACK)
            overScrollMode = View.OVER_SCROLL_NEVER
            isFocusable = true
            isFocusableInTouchMode = true
        }
        with(web.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true                     // a sessão (login) fica guardada no navegador do app
            mediaPlaybackRequiresUserGesture = false     // efeitos sonoros sem precisar tocar antes
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false
            cacheMode = WebSettings.LOAD_DEFAULT
            userAgentString = "$userAgentString MossbladeApp/${BuildConfig.VERSION_NAME}"
        }
        web.addJavascriptInterface(pad, "AndroidGamepad")
        web.webViewClient = object : WebViewClient() {
            // O jogo abre no app; links para fora (GitHub, por exemplo) abrem no navegador.
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val u = request.url
                if (u.scheme == "file" || (u.host == home.host && u.port == home.port)) return false
                startActivity(Intent(Intent.ACTION_VIEW, u))
                return true
            }
            override fun onPageFinished(view: WebView, url: String) {
                view.evaluateJavascript(GamepadBridge.SHIM, null)
            }
            // A página (jogo ou manutenção) apareceu: some a tela de abertura e o tempo limite.
            override fun onPageCommitVisible(view: WebView, url: String) {
                visible = true
                main.removeCallbacks(loadTimeout)
                splash.visibility = View.GONE
            }
            // Servidor fora do ar (sem resposta, ou erro 5xx de um proxy na frente): tela de manutenção.
            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (request.isForMainFrame) showMaintenance(view)
            }
            override fun onReceivedHttpError(view: WebView, request: WebResourceRequest, response: WebResourceResponse) {
                if (request.isForMainFrame && response.statusCode >= 500) showMaintenance(view)
            }
            // O navegador interno travou ou foi fechado pelo sistema (falta de memória): em vez de o app cair,
            // monta uma tela nova e abre o jogo de novo (a sessão de login continua guardada).
            override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                if (view !== this@MainActivity.web) return true
                (view.parent as? ViewGroup)?.removeView(view)
                view.destroy()
                this@MainActivity.web = buildWebView()
                root.addView(this@MainActivity.web, 0)
                openGame()
                return true
            }
        }
        return web
    }

    // A internet voltou: o jogo tenta reconectar na hora; na tela de manutenção, tenta abrir o jogo.
    private val network = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(n: Network) {
            main.post {
                if (web.url?.startsWith("file:") == true) openGame()
                else web.evaluateJavascript("window.__reconnectNow && window.__reconnectNow()", null)
            }
        }
    }

    private fun showMaintenance(view: WebView) {
        main.removeCallbacks(loadTimeout)
        if (view.url?.startsWith("file:///android_asset/manutencao.html") == true) { splash.visibility = View.GONE; return }
        visible = false
        view.loadUrl("file:///android_asset/manutencao.html?u=" + Uri.encode(BuildConfig.GAME_URL))
    }

    // Voltar (Android 12 e antes): também vira Esc.
    @Deprecated("Android 13+ usa o OnBackInvokedDispatcher registrado no onCreate")
    override fun onBackPressed() { pressEscape() }

    private fun pressEscape() {
        web.evaluateJavascript(
            "['keydown','keyup'].forEach(function(t){window.dispatchEvent(new KeyboardEvent(t,{code:'Escape',key:'Escape',bubbles:true}))})", null
        )
    }

    // Controle de videogame: o app lê e entrega à página pelo GamepadBridge.
    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        val wasConnected = pad.connected
        if (pad.onKey(event)) { if (!wasConnected) notifyPad(); return true }
        return super.dispatchKeyEvent(event)
    }
    override fun dispatchGenericMotionEvent(event: MotionEvent): Boolean {
        val wasConnected = pad.connected
        if (pad.onMotion(event)) { if (!wasConnected) notifyPad(); return true }
        return super.dispatchGenericMotionEvent(event)
    }
    override fun onInputDeviceAdded(deviceId: Int) { pad.refresh(); notifyPad() }
    override fun onInputDeviceRemoved(deviceId: Int) { pad.refresh(); notifyPad() }
    override fun onInputDeviceChanged(deviceId: Int) { pad.refresh(); notifyPad() }
    private fun notifyPad() { web.evaluateJavascript("window.__androidPad && window.__androidPad.changed()", null) }

    // Tela cheia de verdade: some com as barras do sistema (deslizar da borda mostra por um instante).
    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideSystemBars()
    }
    private fun hideSystemBars() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.setDecorFitsSystemWindows(false)
            window.insetsController?.let {
                it.hide(WindowInsets.Type.systemBars())
                it.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = (View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or View.SYSTEM_UI_FLAG_FULLSCREEN
                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN)
        }
    }

    override fun onResume() { super.onResume(); web.onResume(); web.resumeTimers() }
    override fun onPause() { web.onPause(); web.pauseTimers(); super.onPause() }   // pausado: o som para e a bateria agradece
    override fun onSaveInstanceState(outState: Bundle) { super.onSaveInstanceState(outState); web.saveState(outState) }
    override fun onDestroy() {
        main.removeCallbacks(loadTimeout)
        (getSystemService(Context.INPUT_SERVICE) as InputManager).unregisterInputDeviceListener(this)
        (getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager).unregisterNetworkCallback(network)
        web.destroy()
        super.onDestroy()
    }
}
