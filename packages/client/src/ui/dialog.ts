import { BUTTON } from '@vale/shared';
import { sfx } from '../audio';

// Caixa de texto das placas. É só interface: o mundo continua rodando enquanto você lê.
// A ou B mostra a página inteira e depois passa; ✕, Esc ou andar fecha de vez (sem abrir a loja do lojista).
export class Dialog {
  private pages: string[] = []; private i = 0; private n = 0; private done?: () => void;
  private armed = false;   // andar só fecha depois de soltar a direção que estava apertada quando a fala abriu
  private el = document.getElementById('dialog')!; private text = document.getElementById('dlgText')!; private more = document.getElementById('dlgMore')!;
  private who = document.getElementById('dlgWho')!;
  constructor() { document.getElementById('dlgClose')!.addEventListener('click', e => { e.preventDefault(); this.close(); }); }
  get open() { return this.pages.length > 0; }
  close() { if (!this.open) return; this.pages = []; this.done = undefined; this.el.hidden = true; }
  // title: nome de quem fala (NPC); placas não têm. done: chamado quando a última página fecha (lojista abre a loja).
  show(pages: string[], title?: string, done?: () => void) {
    this.pages = pages; this.done = done; this.i = 0; this.n = 0; this.armed = false; this.el.hidden = false; this.text.textContent = ''; this.more.hidden = true;
    this.who.hidden = !title; this.who.textContent = title ?? '';
  }
  // moving: alguma direção apertada agora.
  update(tap: number, moving = false) {
    if (!moving) this.armed = true;
    else if (this.armed) { this.close(); return; }
    const full = this.pages[this.i];
    if (this.n < full.length) this.n = Math.min(full.length, this.n + 1.4);
    if (tap & (BUTTON.a | BUTTON.b)) {
      if (this.n < full.length) this.n = full.length;
      else if (this.i < this.pages.length - 1) { this.i++; this.n = 0; sfx('sign'); }
      else { this.pages = []; this.el.hidden = true; const d = this.done; this.done = undefined; d?.(); return; }
    }
    const cur = this.pages[this.i];
    this.text.textContent = cur.slice(0, Math.floor(this.n));
    this.more.hidden = this.n < cur.length;
  }
}
