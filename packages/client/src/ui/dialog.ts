import { BUTTON } from '@vale/shared';
import { sfx } from '../audio';

// Caixa de texto das placas. É só interface: o mundo continua rodando enquanto você lê.
export class Dialog {
  private pages: string[] = []; private i = 0; private n = 0;
  private el = document.getElementById('dialog')!; private text = document.getElementById('dlgText')!; private more = document.getElementById('dlgMore')!;
  get open() { return this.pages.length > 0; }
  show(pages: string[]) { this.pages = pages; this.i = 0; this.n = 0; this.el.hidden = false; this.text.textContent = ''; this.more.hidden = true; }
  update(tap: number) {
    const full = this.pages[this.i];
    if (this.n < full.length) this.n = Math.min(full.length, this.n + 1.4);
    if (tap & (BUTTON.a | BUTTON.b)) {
      if (this.n < full.length) this.n = full.length;
      else if (this.i < this.pages.length - 1) { this.i++; this.n = 0; sfx('sign'); }
      else { this.pages = []; this.el.hidden = true; return; }
    }
    const cur = this.pages[this.i];
    this.text.textContent = cur.slice(0, Math.floor(this.n));
    this.more.hidden = this.n < cur.length;
  }
}
