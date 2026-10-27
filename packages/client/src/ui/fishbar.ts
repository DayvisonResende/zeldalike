import { TIERS, reelCursor, type PlayerView } from '@vale/shared';

// Barra da pesca: esperando, "Fisgou!" e o cursor que vai e volta sobre a zona verde.
const el = document.getElementById('fishbar')!, label = el.querySelector('span')!, bar = el.querySelector<HTMLElement>('.fishtrack')!;
const zone = bar.querySelector<HTMLElement>('.zone')!, cursor = bar.querySelector<HTMLElement>('.cursor')!;
let shown = '';
export function updateFishBar(me: PlayerView | undefined) {
  const f = me?.state === 'fish' ? me.fish : null;
  el.hidden = !f;
  if (!f) { shown = ''; return; }
  const text = f.phase === 'wait' ? 'Esperando o peixe… (andar recolhe a linha)' : f.phase === 'bite' ? 'Mordeu! Aperte E!' : 'Aperte E com o cursor na zona verde';
  if (text !== shown) { label.textContent = text; shown = text; el.dataset.phase = f.phase; }
  bar.hidden = f.phase !== 'reel';
  if (f.phase === 'reel') {
    const w = TIERS[f.tier].zone;
    zone.style.left = ((f.zone - w / 2) * 100) + '%'; zone.style.width = (w * 100) + '%';
    cursor.style.left = (reelCursor(f) * 100) + '%';
  }
}
