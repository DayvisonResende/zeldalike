package com.dayvison.mossblade

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.ActivityInfo
import android.graphics.Color
import android.hardware.input.InputManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.window.OnBackInvokedDispatcher

/**
 * O app é só uma janela para o jogo: abre BuildConfig.GAME_URL numa WebView em tela cheia.
 * Toque e mira funcionam como no navegador do celular; o controle de videogame passa pelo GamepadBridge.
 * O botão Voltar do Android abre e fecha o menu do jogo (a tecla Esc). Servidor fora do ar: manutencao.html.
 */
class MainActivity : Activity(), InputManager.InputDeviceListener {
    private lateinit var web: WebView
    private val pad = GamepadBridge()
    private val main = Handler(Looper.getMainLooper())
    private val home: Uri = Uri.parse(BuildConfig.GAME_URL)

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE   // sempre deitado (as duas posições), mesmo com a rotação travada
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)   // a tela não apaga no meio do jogo

        web = WebView(this).apply {
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
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)   // depurar pelo chrome://inspect no build de teste
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
            // Servidor fora do ar (sem resposta, ou erro 5xx de um proxy na frente): tela de manutenção.
            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (request.isForMainFrame) showMaintenance(view)
            }
            override fun onReceivedHttpError(view: WebView, request: WebResourceRequest, response: WebResourceResponse) {
                if (request.isForMainFrame && response.statusCode >= 500) showMaintenance(view)
            }
        }
        setContentView(web)
        hideSystemBars()

        pad.refresh()
        (getSystemService(Context.INPUT_SERVICE) as InputManager).registerInputDeviceListener(this, main)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU)
            onBackInvokedDispatcher.registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT) { pressEscape() }

        if (savedInstanceState != null) web.restoreState(savedInstanceState) else web.loadUrl(BuildConfig.GAME_URL)
    }

    private fun showMaintenance(view: WebView) {
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
        (getSystemService(Context.INPUT_SERVICE) as InputManager).unregisterInputDeviceListener(this)
        web.destroy()
        super.onDestroy()
    }
}
