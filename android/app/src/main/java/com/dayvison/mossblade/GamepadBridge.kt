package com.dayvison.mossblade

import android.view.InputDevice
import android.view.KeyEvent
import android.view.MotionEvent
import android.webkit.JavascriptInterface
import kotlin.math.max

/**
 * Controle de videogame lido pelo Android e entregue ao jogo.
 *
 * A WebView nem sempre suporta a Gamepad API. Aqui o app guarda o estado do controle (botões e analógicos)
 * no mesmo formato do mapeamento "standard" dos navegadores, e um pequeno script (SHIM) troca
 * navigator.getGamepads() da página por um que lê daqui. O jogo não percebe a diferença.
 */
class GamepadBridge {
    private val buttons = FloatArray(17)
    private val axes = FloatArray(4)
    @Volatile private var name: String? = null

    val connected get() = name != null

    /** Procura um controle já conectado (ao abrir o app ou quando um entra ou sai). */
    fun refresh() {
        name = InputDevice.getDeviceIds().asSequence().mapNotNull { InputDevice.getDevice(it) }.firstOrNull { isGamepad(it) }?.name
        if (name == null) synchronized(this) { buttons.fill(0f); axes.fill(0f) }
    }

    /** Botão do controle. Devolve true se era de controle (o app consome; a página não rola nem perde o foco). */
    fun onKey(event: KeyEvent): Boolean {
        if (!fromGamepad(event.source)) return false
        val i = BUTTONS[event.keyCode] ?: return false
        if (name == null) name = event.device?.name ?: "Controle"
        val down = event.action == KeyEvent.ACTION_DOWN
        synchronized(this) { buttons[i] = if (down) 1f else 0f }
        return true
    }

    /** Analógicos, gatilhos e o direcional que alguns controles mandam como eixo (HAT). */
    fun onMotion(event: MotionEvent): Boolean {
        if (event.source and InputDevice.SOURCE_JOYSTICK != InputDevice.SOURCE_JOYSTICK || event.action != MotionEvent.ACTION_MOVE) return false
        if (name == null) name = event.device?.name ?: "Controle"
        val hatX = event.getAxisValue(MotionEvent.AXIS_HAT_X)
        val hatY = event.getAxisValue(MotionEvent.AXIS_HAT_Y)
        synchronized(this) {
            axes[0] = event.getAxisValue(MotionEvent.AXIS_X)
            axes[1] = event.getAxisValue(MotionEvent.AXIS_Y)
            axes[2] = event.getAxisValue(MotionEvent.AXIS_Z)
            axes[3] = event.getAxisValue(MotionEvent.AXIS_RZ)
            buttons[6] = max(event.getAxisValue(MotionEvent.AXIS_LTRIGGER), event.getAxisValue(MotionEvent.AXIS_BRAKE))
            buttons[7] = max(event.getAxisValue(MotionEvent.AXIS_RTRIGGER), event.getAxisValue(MotionEvent.AXIS_GAS))
            if (hatX != 0f || hatY != 0f || HAT_DEVICES.contains(event.deviceId)) {
                HAT_DEVICES.add(event.deviceId)   // esse controle usa HAT: o direcional vem só daqui
                buttons[12] = if (hatY < -0.5f) 1f else 0f
                buttons[13] = if (hatY > 0.5f) 1f else 0f
                buttons[14] = if (hatX < -0.5f) 1f else 0f
                buttons[15] = if (hatX > 0.5f) 1f else 0f
            }
        }
        return true
    }

    /** Chamado pela página a cada quadro (window.AndroidGamepad.state()). */
    @JavascriptInterface
    fun state(): String = synchronized(this) {
        val n = name ?: return "{\"connected\":false}"
        val b = buttons.joinToString(",") { it.toString() }
        val a = axes.joinToString(",") { it.toString() }
        "{\"connected\":true,\"id\":${quote(n)},\"buttons\":[$b],\"axes\":[$a]}"
    }

    companion object {
        // Teclas do Android → índice do botão no mapeamento "standard" (0 = botão de baixo, 1 = direita…)
        private val BUTTONS = mapOf(
            KeyEvent.KEYCODE_BUTTON_A to 0, KeyEvent.KEYCODE_BUTTON_B to 1, KeyEvent.KEYCODE_BUTTON_X to 2, KeyEvent.KEYCODE_BUTTON_Y to 3,
            KeyEvent.KEYCODE_BUTTON_L1 to 4, KeyEvent.KEYCODE_BUTTON_R1 to 5, KeyEvent.KEYCODE_BUTTON_L2 to 6, KeyEvent.KEYCODE_BUTTON_R2 to 7,
            KeyEvent.KEYCODE_BUTTON_SELECT to 8, KeyEvent.KEYCODE_BUTTON_START to 9, KeyEvent.KEYCODE_BUTTON_THUMBL to 10, KeyEvent.KEYCODE_BUTTON_THUMBR to 11,
            KeyEvent.KEYCODE_DPAD_UP to 12, KeyEvent.KEYCODE_DPAD_DOWN to 13, KeyEvent.KEYCODE_DPAD_LEFT to 14, KeyEvent.KEYCODE_DPAD_RIGHT to 15,
            KeyEvent.KEYCODE_BUTTON_MODE to 16
        )
        private val HAT_DEVICES = java.util.Collections.synchronizedSet(HashSet<Int>())

        private fun fromGamepad(source: Int) =
            source and InputDevice.SOURCE_GAMEPAD == InputDevice.SOURCE_GAMEPAD || source and InputDevice.SOURCE_JOYSTICK == InputDevice.SOURCE_JOYSTICK

        private fun isGamepad(d: InputDevice) = !d.isVirtual && fromGamepad(d.sources)

        private fun quote(s: String) = "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""

        /** Script posto na página: troca navigator.getGamepads e avisa o jogo quando o controle entra ou sai. */
        const val SHIM = """
(function () {
  if (window.__androidPad || !window.AndroidGamepad) return;
  var pad = { id: '', index: 0, connected: false, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0], buttons: [] };
  for (var i = 0; i < 17; i++) pad.buttons.push({ pressed: false, touched: false, value: 0 });
  var was = false;
  function read() {
    try {
      var s = JSON.parse(window.AndroidGamepad.state());
      pad.connected = !!s.connected;
      if (s.connected) {
        pad.id = s.id; pad.axes = s.axes;
        for (var i = 0; i < 17; i++) { var v = s.buttons[i] || 0; pad.buttons[i] = { pressed: v > 0.5, touched: v > 0, value: v }; }
        pad.timestamp = performance.now();
      }
    } catch (e) { pad.connected = false; }
  }
  navigator.getGamepads = function () { read(); return pad.connected ? [pad] : []; };
  window.__androidPad = {
    changed: function () {
      read();
      if (pad.connected === was) return;
      was = pad.connected;
      var e = new Event(was ? 'gamepadconnected' : 'gamepaddisconnected'); e.gamepad = pad;
      window.dispatchEvent(e);
    }
  };
  window.__androidPad.changed();
})();
"""
    }
}
