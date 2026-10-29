import { BUTTON, VIEW_H, VIEW_W, emptyInput, type Button, type InputState } from '@vale/shared';

type Key = 'up' | 'down' | 'left' | 'right' | Button;
type Source = 'kb' | 'mouse' | 'touch' | 'pad';
const MAP: Record<string, Key> = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  KeyJ: 'a', KeyZ: 'a', Space: 'a', KeyE: 'b', KeyK: 'b', KeyX: 'b', KeyF: 'b', KeyL: 'c', KeyC: 'c', ShiftLeft: 'd', ShiftRight: 'd', KeyQ: 'd'
};
export interface InputHooks { started(): boolean; start(): void; toggleMap(): void; openParty(): void; togglePaths(): void; toggleMenu(): void; openChat(): void; togglePvp(): void; toggleBag(): void; quickUse(n: 1 | 2 | 3): void }
// Cliques e teclas dentro do menu são do menu, não do jogo.
export const UI_SELECTOR = '.menu, .menubtn, .chatbar, .chatbtn, .chatlog, .account, .bag, .bagbtn, .fsbtn, .mapbtn, .minimap, .worldmap, .invite';
const inMenu = (t: EventTarget | null) => !!(t as Element | null)?.closest?.(UI_SELECTOR);
const typing = (t: EventTarget | null) => !!(t as Element | null)?.closest?.('input, textarea, select');

// Junta teclado, mouse e toque num único InputState por passo.
// Cada fonte guarda o próprio estado, para soltar uma tecla não cancelar o mesmo botão segurado em outra.
export class Input {
  private src: Record<Source, Set<Key>> = { kb: new Set(), mouse: new Set(), touch: new Set(), pad: new Set() };
  private codes = new Set<string>();
  private tap = 0;
  usingTouch = false;   // o último comando veio da tela de toque (liga a ajuda na mira)
  usingPad = false;     // ...ou do controle de videogame (idem)
  readonly mouse = { x: 0, y: 0, active: false };   // em pixels da tela do jogo

  constructor(stage: HTMLElement, canvas: HTMLCanvasElement, private hooks: InputHooks) {
    window.addEventListener('keydown', e => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;                                          // deixa os atalhos do navegador em paz
      if (e.code === 'Escape') { if (!e.repeat) hooks.toggleMenu(); e.preventDefault(); return; }
      if (typing(e.target)) return;                                                            // digitando o nome no menu
      if ((e.code === 'Space' || e.code === 'Enter') && (e.target as Element).closest?.('button')) return;   // botões da página continuam funcionando
      if (e.code === 'Enter' || e.code === 'NumpadEnter') { if (!e.repeat) { e.preventDefault(); if (hooks.started()) hooks.openChat(); else hooks.start(); } return; }
      if (e.code === 'KeyM') { if (!e.repeat && hooks.started()) hooks.toggleMap(); return; }
      if (e.code === 'KeyG') { if (!e.repeat && hooks.started()) hooks.openParty(); return; }
      if (e.code === 'KeyP') { if (!e.repeat) hooks.togglePaths(); return; }
      if (e.code === 'KeyV') { if (!e.repeat && hooks.started()) hooks.togglePvp(); return; }
      if (e.code === 'KeyI') { if (!e.repeat && hooks.started()) hooks.toggleBag(); return; }
      if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3') { if (!e.repeat && hooks.started()) hooks.quickUse(Number(e.code.slice(5)) as 1 | 2 | 3); return; }
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
    if (v) { this.src[src].add(k); this.usingTouch = src === 'touch'; this.usingPad = src === 'pad'; } else this.src[src].delete(k);
    if (!before && v && k in BUTTON) this.tap |= BUTTON[k as Button];
  }
  private held(k: Key) { return this.src.kb.has(k) || this.src.mouse.has(k) || this.src.touch.has(k) || this.src.pad.has(k); }
  private syncKeyboard() {
    const want = new Set([...this.codes].map(c => MAP[c]));
    for (const k of Object.values(MAP)) this.set('kb', k, want.has(k));
  }
  private syncMouse(buttons: number) { this.set('mouse', 'a', (buttons & 1) !== 0); this.set('mouse', 'c', (buttons & 2) !== 0); }
  touch(k: Key, v: boolean) { this.set('touch', k, v); }
  pad(k: Key, v: boolean) { this.set('pad', k, v); }

  // Estado para o próximo passo. `aim` vem de fora porque depende da câmera.
  sample(aim: number | null): InputState {
    const s = emptyInput();
    for (const k of ['up', 'down', 'left', 'right', 'a', 'b', 'c', 'd'] as const) s[k] = this.held(k);
    s.tap = this.tap; s.aim = aim; this.tap = 0;
    return s;
  }
  clearTaps() { this.tap = 0; }
  // Direção que o jogador está apertando (-1, 0 ou 1 em cada eixo).
  moving() { return { x: +this.held('right') - +this.held('left'), y: +this.held('down') - +this.held('up') }; }
  // O botão está segurado ou foi tocado desde o último passo?
  wants(k: Button) { return this.held(k) || (this.tap & BUTTON[k]) !== 0; }
}

// Tela cheia (e deitado, onde o navegador deixa). No iPhone não existe para páginas: lá é "Adicionar à Tela de Início";
// no app Android, o app já é tela cheia (o navegador interno diz que não tem, e os botões somem).
export async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) { await document.exitFullscreen(); return; }
    await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    await (screen.orientation as ScreenOrientation & { lock?(o: string): Promise<void> }).lock?.('landscape');
  } catch { }
}
// Joystick e botões virtuais (só aparecem em telas de toque).
// O joystick é flutuante: encostar em qualquer lugar da área dele põe o centro ali, e soltar o devolve ao lugar.
export function bindTouch(input: Input, hooks: InputHooks, vibrate: () => boolean) {
  const zone = document.getElementById('stickZone')!, stick = document.getElementById('stick')!, knob = document.getElementById('knob')!;
  const buzz = () => { if (vibrate()) try { navigator.vibrate?.(12); } catch { } };
  let stickId: number | null = null, ox = 0, oy = 0;
  const setStick = (dx: number, dy: number) => {
    const r = stick.clientWidth / 2, l = Math.hypot(dx, dy), m = Math.min(l, r * 0.6), a = Math.atan2(dy, dx);
    knob.style.transform = l ? `translate(${Math.cos(a) * m}px,${Math.sin(a) * m}px)` : '';
    let vx = 0, vy = 0;
    if (l > r * 0.28) { const sec = Math.round(a / (Math.PI / 4)); vx = Math.round(Math.cos(sec * Math.PI / 4)); vy = Math.round(Math.sin(sec * Math.PI / 4)); }
    input.touch('left', vx < 0); input.touch('right', vx > 0); input.touch('up', vy < 0); input.touch('down', vy > 0);
  };
  zone.addEventListener('pointerdown', e => {
    e.preventDefault(); if (!hooks.started()) { hooks.start(); return; }
    if (stickId !== null) return;
    const b = zone.getBoundingClientRect(), r = stick.clientWidth / 2;
    // centro onde o dedo encostou, sem deixar o joystick sair da área
    ox = Math.max(r, Math.min(b.width - r, e.clientX - b.left)); oy = Math.max(r, Math.min(b.height - r, e.clientY - b.top));
    stick.style.left = ox + 'px'; stick.style.top = oy + 'px'; stick.classList.add('on');
    stickId = e.pointerId; try { zone.setPointerCapture(e.pointerId); } catch { }
    setStick(e.clientX - b.left - ox, e.clientY - b.top - oy);
  });
  zone.addEventListener('pointermove', e => { if (e.pointerId !== stickId) return; const b = zone.getBoundingClientRect(); setStick(e.clientX - b.left - ox, e.clientY - b.top - oy); });
  for (const t of ['pointerup', 'pointercancel'] as const) zone.addEventListener(t, e => {
    if (e.pointerId !== stickId) return;
    stickId = null; setStick(0, 0); stick.style.left = stick.style.top = ''; stick.classList.remove('on');
  });
  for (const [id, k] of [['btnA', 'a'], ['btnB', 'b'], ['btnC', 'c'], ['btnD', 'd']] as const) {
    const el = document.getElementById(id)!;
    el.addEventListener('pointerdown', e => { e.preventDefault(); if (!hooks.started()) { hooks.start(); return; } el.classList.add('on'); input.touch(k, true); buzz(); });
    for (const t of ['pointerup', 'pointercancel', 'pointerleave'] as const) el.addEventListener(t, () => { el.classList.remove('on'); input.touch(k, false); });
  }
  // Atalhos de item: coração, poção e bomba (as teclas 1, 2 e 3)
  document.getElementById('btnBomb')!.addEventListener('pointerdown', e => { e.preventDefault(); if (hooks.started()) { hooks.quickUse(3); buzz(); } });
  for (const n of [1, 2, 3] as const) document.getElementById('q' + n)!.addEventListener('pointerdown', e => { e.preventDefault(); if (hooks.started()) { hooks.quickUse(n); buzz(); } });
  const fs = document.getElementById('fsBtn')!;
  fs.hidden = !document.fullscreenEnabled;
  fs.addEventListener('click', toggleFullscreen);
  // Encostou o dedo na tela: os controles de toque voltam, mesmo com um controle conectado (ou um celular que se diz controle).
  window.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') document.body.classList.remove('gamepad'); }, true);
  const pad = document.getElementById('pad')!;
  pad.addEventListener('contextmenu', e => e.preventDefault());
  pad.addEventListener('pointerdown', () => { input.usingTouch = true; input.usingPad = false; }, true);   // qualquer toque no controle já liga a ajuda na mira
}
