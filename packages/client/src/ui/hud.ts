import type { PlayerView } from '@vale/shared';
import { ITEM_ICON } from '../render/sprites';
import type { Inventory } from '../session/types';

const nameEl = document.getElementById('roomname')!;
let nameTimer = 0;
// Nome da região ao entrar nela.
export function showRegion(name: string) {
  nameEl.textContent = name; nameEl.classList.add('show');
  clearTimeout(nameTimer); nameTimer = window.setTimeout(() => nameEl.classList.remove('show'), 1800);
}

/* ---------- Barras de vida e mana, e o aviso de queda ---------- */
const hud = document.getElementById('hud')!, death = document.getElementById('death')!, deathTimer = document.getElementById('deathTimer')!;
const deathTitle = death.querySelector('strong')!, badge = document.getElementById('pvpBadge')!;
const lvlEl = document.getElementById('lvl')!, xpEl = document.getElementById('xpbar')!, goldEl = document.getElementById('gold')!.querySelector('b')!;
document.getElementById('gold')!.querySelector('canvas')!.getContext('2d')!.drawImage(ITEM_ICON.gold, 0, 0);
let progKey = '';
const bars = {
  hp: { el: hud.querySelector<HTMLElement>('.hp')!, last: '' },
  mp: { el: hud.querySelector<HTMLElement>('.mp')!, last: '' }
};
function setBar(b: typeof bars.hp, v: number, max: number) {
  const cur = Math.ceil(v), key = cur + '/' + max;
  if (key === b.last) return;   // só mexe no DOM quando o número muda
  b.last = key;
  const pct = max > 0 ? Math.max(0, Math.min(100, v / max * 100)) : 0;
  b.el.style.setProperty('--pct', pct + '%');
  b.el.querySelector('span')!.textContent = key;
  b.el.setAttribute('aria-valuenow', String(cur)); b.el.setAttribute('aria-valuemax', String(max));
  b.el.classList.toggle('low', pct <= 25);
}
// Nível, barra de XP e ouro: só mexe no DOM quando algo muda.
function updateProgress(inv: Inventory | null) {
  if (!inv) return;
  const key = `${inv.level}|${inv.xp}|${inv.xpNext}|${inv.gold}`;
  if (key === progKey) return;
  progKey = key;
  lvlEl.textContent = `Nv ${inv.level}`;
  const pct = inv.xpNext > 0 ? Math.min(100, inv.xp / inv.xpNext * 100) : 100;
  xpEl.style.setProperty('--pct', pct + '%');
  xpEl.setAttribute('aria-valuenow', String(inv.xp)); xpEl.setAttribute('aria-valuemax', String(Math.max(inv.xpNext, inv.xp)));
  xpEl.title = inv.xpNext > 0 ? `${inv.xp} / ${inv.xpNext} XP` : 'Nível máximo';
  goldEl.textContent = String(inv.gold);
}
export function updateHud(me: PlayerView | undefined, inv: Inventory | null = null) {
  updateProgress(inv);
  hud.hidden = !me;
  if (!me) { death.hidden = true; return; }
  setBar(bars.hp, me.hp, me.maxHp);
  setBar(bars.mp, me.mp, me.maxMp);
  const dead = me.state === 'dead';
  death.hidden = !dead;
  if (dead) {
    const s = Math.max(1, Math.ceil(me.t / 60)), title = me.killer ? `${me.killer} te derrubou` : 'Você caiu';
    if (deathTitle.textContent !== title) deathTitle.textContent = title;
    deathTimer.textContent = `Renascendo em ${s}…`;
  }
  // selo ao lado das barras: zona segura (verde) ou PvP ativo (vermelho)
  const b = me.safe ? 'safe' : me.pvpActive ? 'pvp' : '';
  if (badge.dataset.kind !== b) { badge.dataset.kind = b; badge.hidden = !b; badge.textContent = b === 'safe' ? 'Zona segura' : 'PvP'; }
}
