import { BUTTON, VIEW_H, VIEW_W, emptyInput, type Button, type InputState } from '@vale/shared';

type Key = 'up' | 'down' | 'left' | 'right' | Button;
type Source = 'kb' | 'mouse' | 'touch';
const MAP: Record<string, Key> = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  KeyJ: 'a', KeyZ: 'a', Space: 'a', KeyE: 'b', KeyK: 'b', KeyX: 'b', KeyL: 'c', KeyC: 'c', ShiftLeft: 'd', ShiftRight: 'd', KeyQ: 'd'
};
export interface InputHooks { started(): boolean; start(): void; toggleMute(): void; togglePaths(): void; toggleMenu(): void; openChat(): void; togglePvp(): void; toggleBag(): void; quickUse(n: 1 | 2): void }
// Cliques e teclas dentro do menu são do menu, não do jogo.
export const UI_SELECTOR = '.menu, .menubtn, .chatbar, .chatbtn, .chatlog, .account, .bag, .bagbtn';
const inMenu = (t: EventTarget | null) => !!(t as Element | null)?.closest?.(UI_SELECTOR);
const typing = (t: EventTarget | null) => !!(t as Element | null)?.closest?.('input, textarea, select');

// Junta teclado, mouse e toque num único InputState por passo.
// Cada fonte guarda o próprio estado, para soltar uma tecla não cancelar o mesmo botão segurado em outra.
export class Input {
  private src: Record<Source, Set<Key>> = { kb: new Set(), mouse: new Set(), touch: new Set() };
  private codes = new Set<string>();
  private tap = 0;
  readonly mouse = { x: 0, y: 0, active: false };   // em pixels da tela do jogo

  constructor(stage: HTMLElement, canvas: HTMLCanvasElement, private hooks: InputHooks) {
    window.addEventListener('keydown', e => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;                                          // deixa os atalhos do navegador em paz
      if (e.code === 'Escape') { if (!e.repeat) hooks.toggleMenu(); e.preventDefault(); return; }
      if (typing(e.target)) return;                                                            // digitando o nome no menu
      if ((e.code === 'Space' || e.code === 'Enter') && (e.target as Element).closest?.('button')) return;   // botões da página continuam funcionando
      if (e.code === 'Enter' || e.code === 'NumpadEnter') { if (!e.repeat) { e.preventDefault(); if (hooks.started()) hooks.openChat(); else hooks.start(); } return; }
      if (e.code === 'KeyM') { if (!e.repeat) hooks.toggleMute(); return; }
      if (e.code === 'KeyP') { if (!e.repeat) hooks.togglePaths(); return; }
      if (e.code === 'KeyV') { if (!e.repeat && hooks.started()) hooks.togglePvp(); return; }
      if (e.code === 'KeyI') { if (!e.repeat && hooks.started()) hooks.toggleBag(); return; }
      if (e.code === 'Digit1' || e.code === 'Digit2') { if (!e.repeat && hooks.started()) hooks.quickUse(e.code === 'Digit1' ? 1 : 2); return; }
      const k = MAP[e.code]; if (!k) return;
      e.preventDefault();
      if (!hooks.started()) { hooks.start(); return; }
      this.codes.add(e.code); this.syncKeyboard();
    });
    window.addEventListener('keyup', e => { if (this.codes.delete(e.code)) this.syncKeyboard(); });
    window.addEventListener('blur', () => { this.codes.clear(); for (const s of Object.values(this.src)) s.clear(); });

    // Mouse: a mira só vale com o cursor sobre a tela do jogo.
    const toGame = (e: PointerEvent) => { const b = canvas.getBoundingClientRect(); if (b.width) { this.mouse.x = (e.clientX - b.left) / b.width * VIEW_W; this.mouse.y = (e.clientY - b.top) / b.height * VIEW_H; } };
    stage.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse' || inMenu(e.target)) return;
      toGame(e);
      if (!this.mouse.active) { this.mouse.active = true; stage.classList.add('aim'); }
      if (hooks.started()) this.syncMouse(e.buttons);   // segundo botão apertado chega como pointermove
    });
    stage.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { this.mouse.active = false; stage.classList.remove('aim'); } });
    stage.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse' || !hooks.started() || inMenu(e.target)) return;
      e.preventDefault(); toGame(e); this.syncMouse(e.buttons);
    });
    window.addEventListener('pointerup', e => { if (e.pointerType === 'mouse') this.syncMouse(e.buttons); });
    stage.addEventListener('contextmenu', e => e.preventDefault());
  }

  private set(src: Source, k: Key, v: boolean) {
    const before = this.held(k);
    if (v) this.src[src].add(k); else this.src[src].delete(k);
    if (!before && v && k in BUTTON) this.tap |= BUTTON[k as Button];
  }
  private held(k: Key) { return this.src.kb.has(k) || this.src.mouse.has(k) || this.src.touch.has(k); }
  private syncKeyboard() {
    const want = new Set([...this.codes].map(c => MAP[c]));
    for (const k of Object.values(MAP)) this.set('kb', k, want.has(k));
  }
  private syncMouse(buttons: number) { this.set('mouse', 'a', (buttons & 1) !== 0); this.set('mouse', 'c', (buttons & 2) !== 0); }
  touch(k: Key, v: boolean) { this.set('touch', k, v); }

  // Estado para o próximo passo. `aim` vem de fora porque depende da câmera.
  sample(aim: number | null): InputState {
    const s = emptyInput();
    for (const k of ['up', 'down', 'left', 'right', 'a', 'b', 'c', 'd'] as const) s[k] = this.held(k);
    s.tap = this.tap; s.aim = aim; this.tap = 0;
    return s;
  }
  clearTaps() { this.tap = 0; }
}

// Joystick e botões virtuais (só aparecem em telas de toque).
export function bindTouch(input: Input, hooks: InputHooks) {
  const stick = document.getElementById('stick')!, knob = document.getElementById('knob')!;
  let stickId: number | null = null;
  const setStick = (dx: number, dy: number) => {
    const r = stick.clientWidth / 2, l = Math.hypot(dx, dy), m = Math.min(l, r * 0.6), a = Math.atan2(dy, dx);
    knob.style.transform = l ? `translate(${Math.cos(a) * m}px,${Math.sin(a) * m}px)` : '';
    let vx = 0, vy = 0;
    if (l > r * 0.28) { const sec = Math.round(a / (Math.PI / 4)); vx = Math.round(Math.cos(sec * Math.PI / 4)); vy = Math.round(Math.sin(sec * Math.PI / 4)); }
    input.touch('left', vx < 0); input.touch('right', vx > 0); input.touch('up', vy < 0); input.touch('down', vy > 0);
  };
  const onStick = (e: PointerEvent) => { const b = stick.getBoundingClientRect(); setStick(e.clientX - b.left - b.width / 2, e.clientY - b.top - b.height / 2); };
  stick.addEventListener('pointerdown', e => { e.preventDefault(); hooks.start(); stickId = e.pointerId; try { stick.setPointerCapture(e.pointerId); } catch { } onStick(e); });
  stick.addEventListener('pointermove', e => { if (e.pointerId === stickId) onStick(e); });
  for (const t of ['pointerup', 'pointercancel'] as const) stick.addEventListener(t, e => { if (e.pointerId === stickId) { stickId = null; setStick(0, 0); } });
  for (const [id, k] of [['btnA', 'a'], ['btnB', 'b'], ['btnC', 'c'], ['btnD', 'd']] as const) {
    const el = document.getElementById(id)!;
    el.addEventListener('pointerdown', e => { e.preventDefault(); if (!hooks.started()) { hooks.start(); return; } el.classList.add('on'); input.touch(k, true); });
    for (const t of ['pointerup', 'pointercancel', 'pointerleave'] as const) el.addEventListener(t, () => { el.classList.remove('on'); input.touch(k, false); });
  }
  document.getElementById('pad')!.addEventListener('contextmenu', e => e.preventDefault());
}
