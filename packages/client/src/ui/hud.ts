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
const clockEl = document.getElementById('clock')!;
let clockKey = '';
// Relógio: sol de dia, lua de noite, e a hora.
export function updateClock(day: number, dark: boolean) {
  const h = Math.floor(day * 24), night = h < 6 || h >= 19, key = dark ? 'dark' : `${h}${night}`;
  if (key === clockKey) return;
  clockKey = key;
  clockEl.textContent = dark ? '☾ Subterrâneo' : `${night ? '☾' : '☀'} ${String(h).padStart(2, '0')}h`;
  clockEl.dataset.night = String(night || dark);
}
const raidEl = document.getElementById('raid')!;
let raidKey = '';
// Invasão: contagem regressiva do aviso, depois gelecas restantes e o tempo que falta.
export function updateRaid(iv: [number, number] | null) {
  const key = iv ? iv.join('|') : '';
  if (key === raidKey) return;
  raidKey = key; raidEl.hidden = !iv;
  if (!iv) return;
  const [n, s] = iv, t = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  raidEl.textContent = n < 0 ? `⚔ Invasão em ${t}` : `⚔ ${n} gelecas · ${t}`;
  raidEl.dataset.warn = String(n < 0);
}
const bossEl = document.getElementById('boss')!, bossBar = bossEl.querySelector<HTMLElement>('.bar')!;
let bossKey = '';
// Barra do chefão no alto da tela enquanto ele está à vista. Roxa; vermelha quando ele fica furioso.
export function updateBoss(e: { hp: number; maxHp: number } | undefined) {
  const key = e ? `${Math.max(0, e.hp)}/${e.maxHp}` : '';
  if (key === bossKey) return;
  bossKey = key; bossEl.hidden = !e;
  if (!e) return;
  bossBar.style.setProperty('--pct', Math.max(0, e.hp / e.maxHp * 100) + '%');
  bossBar.setAttribute('aria-valuenow', String(Math.max(0, e.hp))); bossBar.setAttribute('aria-valuemax', String(e.maxHp));
  bossEl.dataset.angry = String(e.hp <= e.maxHp / 2);
}
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
