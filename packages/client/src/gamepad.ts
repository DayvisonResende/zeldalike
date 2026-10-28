import type { Input, InputHooks } from './input';

// Controle de videogame (Bluetooth ou USB, no celular ou no PC), pelo mapeamento "standard" dos navegadores:
//   analógico esquerdo ou direcional: andar      analógico direito: mira livre (como o mouse)
//   botão de baixo (A no Xbox, X no PlayStation): espada     direita: ação/levantar     esquerda: arco     cima: dash
//   LB/L1: bomba   LT/L2: coração   RT/R2: poção   RB/R1: dash   Start: menu   Select: inventário
// Com um painel aberto (menu, inventário, loja), o direcional anda entre os botões, baixo confirma e direita fecha.
const DEAD = 0.4, AIM_DEAD = 0.5;
const B = { south: 0, east: 1, west: 2, north: 3, lb: 4, rb: 5, lt: 6, rt: 7, select: 8, start: 9, up: 12, down: 13, left: 14, right: 15 } as const;
const FOCUSABLE = 'button:not(:disabled):not([hidden]), input:not(:disabled), [tabindex="0"]';

export interface PadHooks extends InputHooks { panel(): HTMLElement | null; closePanel(): void; connected(name: string | null): void }

export class Gamepads {
  aim: number | null = null;   // ângulo do analógico direito, ou null
  private prev: boolean[] = [];
  private id: string | null = null;
  constructor(private input: Input, private hooks: PadHooks) {
    window.addEventListener('gamepadconnected', e => this.hooks.connected(e.gamepad.id));
    window.addEventListener('gamepaddisconnected', () => { if (!this.first()) { this.hooks.connected(null); this.release(); } });
  }
  get active() { return this.id !== null; }
  private first() { return [...(navigator.getGamepads?.() ?? [])].find(g => g && g.connected) ?? null; }
  private release() { for (const k of ['up', 'down', 'left', 'right', 'a', 'b', 'c', 'd'] as const) this.input.pad(k, false); this.aim = null; this.id = null; }

  // Uma vez por passo, antes de amostrar o Input.
  poll() {
    const gp = this.first();
    if (!gp) { if (this.id) this.release(); return; }
    this.id = gp.id;
    const now = gp.buttons.map(b => b.pressed || b.value > 0.5), was = this.prev; this.prev = now;
    const hit = (i: number) => now[i] && !was[i];
    if (now.some((v, i) => v && !was[i])) { this.input.usingTouch = false; this.input.usingPad = true; this.input.mouse.active = false; document.body.classList.add('gamepad'); }   // usou o controle: a ajuda na mira segue com ele (e o mouse parado não rouba a mira)

    const panel = this.hooks.panel();
    if (panel) { this.release(); this.navigate(panel, hit); return; }
    if (hit(B.start)) { this.hooks.toggleMenu(); return; }
    if (!this.hooks.started()) { if (now.some((v, i) => v && !was[i])) this.hooks.start(); return; }
    if (hit(B.select)) { this.hooks.toggleBag(); return; }
    if (hit(B.lb)) this.hooks.quickUse(3);
    if (hit(B.lt)) this.hooks.quickUse(1);
    if (hit(B.rt)) this.hooks.quickUse(2);

    const [lx = 0, ly = 0, rx = 0, ry = 0] = gp.axes;
    let x = Math.abs(lx) > DEAD ? lx : 0, y = Math.abs(ly) > DEAD ? ly : 0;
    if (now[B.left]) x = -1; else if (now[B.right]) x = 1;
    if (now[B.up]) y = -1; else if (now[B.down]) y = 1;
    if (x || y) {   // 8 direções, como o joystick de toque
      const a = Math.atan2(y, x), sec = Math.round(a / (Math.PI / 4));
      x = Math.round(Math.cos(sec * Math.PI / 4)); y = Math.round(Math.sin(sec * Math.PI / 4));
    }
    this.input.pad('left', x < 0); this.input.pad('right', x > 0); this.input.pad('up', y < 0); this.input.pad('down', y > 0);
    this.input.pad('a', now[B.south]); this.input.pad('b', now[B.east]); this.input.pad('c', now[B.west]); this.input.pad('d', now[B.north] || now[B.rb]);
    this.aim = Math.hypot(rx, ry) > AIM_DEAD ? Math.atan2(ry, rx) : null;
  }

  // Painel aberto: direcional/analógico anda entre os botões, baixo confirma, direita (ou Start) fecha.
  private navigate(panel: HTMLElement, hit: (i: number) => boolean) {
    if (hit(B.east) || hit(B.start)) { this.hooks.closePanel(); return; }
    const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(e => e.offsetParent !== null);
    if (!items.length) return;
    const cur = items.indexOf(document.activeElement as HTMLElement);
    if (hit(B.south)) { if (cur >= 0) items[cur].click(); else items[0].focus(); return; }
    const step = hit(B.down) || hit(B.right) ? 1 : hit(B.up) || hit(B.left) ? -1 : 0;
    if (step) items[cur < 0 ? 0 : (cur + step + items.length) % items.length].focus();
  }
}
