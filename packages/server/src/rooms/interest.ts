import { inRect, type GameEvent, type Rect } from '@vale/shared';

// Área de interesse: a tela do jogador (a mesma da câmera dele, inclusive presa nas bordas do mundo)
// mais uma margem, para quem está entrando na tela já chegar desenhado. Fora disso ele não recebe nada.
export const ENTITY_MARGIN = 48;   // sprites maiores que um tile + o que dá para andar até o próximo snapshot
export const EVENT_MARGIN = 64;    // sons um pouco fora da tela ainda se ouvem
export const inView = (view: Rect, o: { x: number; y: number }) => inRect(view, o.x, o.y, ENTITY_MARGIN);

export function eventFor(ev: GameEvent, id: string, view: Rect) {
  switch (ev.t) {
    case 'tile': return true;                          // o mapa é de todos
    case 'dialog': case 'region': case 'zone': case 'gain': case 'notice': return ev.to === id;
    case 'levelup': return inRect(view, ev.x, ev.y, EVENT_MARGIN);
    case 'kill': case 'fish': case 'announce': return false;   // viram aviso no chat, não evento
    case 'shake': return ev.to === id && ev.by !== id; // o próprio cliente já tremeu a tela na previsão
    case 'poof': return inRect(view, ev.x, ev.y, EVENT_MARGIN);
    case 'sfx': case 'burst': return ev.by !== id && inRect(view, ev.x, ev.y, EVENT_MARGIN);
  }
}
