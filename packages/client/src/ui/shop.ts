import { ITEMS, type ItemId, type ShopOffer } from '@vale/shared';
import { iconsVersion, itemIcon } from '../render/icons';
import type { Inventory } from '../session/types';

export type ShopAction = 'buy' | 'sell';
export interface ShopHooks { inventory(): Inventory | null; deal(action: ShopAction, shop: string, item: ItemId, n: number): void; closed(): void }

// Painel da loja: abre quando a fala do lojista termina. Comprar (o que ele vende) e Vender (o que ele compra).
// Quem confere preço, ouro e espaço é o servidor; aqui só se desabilita o que claramente não dá.
export class ShopPanel {
  private el = document.getElementById('shop')!;
  private list = document.getElementById('shopList')!;
  private offer: ShopOffer | null = null; private tab: ShopAction = 'buy'; private shown = '';

  constructor(private hooks: ShopHooks) {
    this.el.addEventListener('pointerdown', e => { if (e.target === this.el) this.close(); });
    document.getElementById('shopClose')!.addEventListener('click', () => this.close());
    this.el.querySelectorAll<HTMLButtonElement>('[data-shoptab]').forEach(b => b.addEventListener('click', () => this.select(b.dataset.shoptab as ShopAction)));
  }
  get open() { return !this.el.hidden; }
  show(offer: ShopOffer) {
    this.offer = offer; this.el.hidden = false;
    document.getElementById('shopName')!.textContent = offer.name;
    this.select(offer.buy.length ? 'buy' : 'sell');
  }
  close() { if (!this.open) return; this.el.hidden = true; this.offer = null; this.hooks.closed(); }
  private select(t: ShopAction) {
    this.tab = t; this.shown = '';
    this.el.querySelectorAll<HTMLButtonElement>('[data-shoptab]').forEach(b => { b.setAttribute('aria-selected', String(b.dataset.shoptab === t)); });
    this.render();
    this.list.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
  }

  // Redesenha só quando ouro, inventário ou aba mudam.
  render() {
    const o = this.offer, inv = this.hooks.inventory();
    if (!this.open || !o || !inv) return;
    const key = JSON.stringify([inv.bag, inv.gold, this.tab, iconsVersion()]);
    if (key === this.shown) return;
    this.shown = key;
    document.getElementById('shopGold')!.textContent = `${inv.gold} de ouro`;
    const has = (id: ItemId) => inv.bag.reduce((t, s) => t + (s?.id === id ? s.n : 0), 0);
    const rows = this.tab === 'buy'
      ? o.buy.map(([id, price]) => this.row(id, `${price} de ouro`, has(id), [
        ['Comprar', 1, inv.gold >= price], ['×5', 5, inv.gold >= price * 5]]))
      : o.sell.map(([id, price]) => this.row(id, `paga ${price}`, has(id), [
        ['Vender', 1, has(id) > 0], ['Todos', has(id), has(id) > 1]]));
    if (!rows.length) rows.push(Object.assign(document.createElement('li'), { className: 'hint', textContent: this.tab === 'buy' ? 'Nada à venda.' : 'Não compra nada.' }));
    // mantém a seleção no mesmo botão (quem joga de controle ou teclado não perde o lugar a cada compra)
    const focused = this.list.contains(document.activeElement) ? document.activeElement!.getAttribute('aria-label') : null;
    this.list.replaceChildren(...rows);
    if (focused) {
      const same = [...this.list.querySelectorAll<HTMLButtonElement>('button')].find(b => b.getAttribute('aria-label') === focused);
      (same && !same.disabled ? same : this.list.querySelector<HTMLButtonElement>('button:not(:disabled)'))?.focus();
    }
  }
  private row(id: ItemId, price: string, have: number, buttons: [string, number, boolean][]) {
    const li = document.createElement('li'), cv = document.createElement('canvas'), icon = itemIcon(id);
    cv.width = icon.width; cv.height = icon.height; cv.getContext('2d')!.drawImage(icon, 0, 0);
    const info = document.createElement('span');
    info.append(Object.assign(document.createElement('b'), { textContent: ITEMS[id].name }), Object.assign(document.createElement('small'), { textContent: `${price} · você tem ${have}` }));
    li.append(cv, info);
    for (const [label, n, ok] of buttons) {
      const b = Object.assign(document.createElement('button'), { type: 'button', className: 'primary', textContent: label, disabled: !ok });
      b.setAttribute('aria-label', `${this.tab === 'buy' ? 'Comprar' : 'Vender'} ${n} ${ITEMS[id].name}`);
      b.addEventListener('click', () => { if (this.offer) this.hooks.deal(this.tab, this.offer.id, id, n); });
      li.append(b);
    }
    return li;
  }
}
