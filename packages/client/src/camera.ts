import { viewRect, type WorldMap } from '@vale/shared';

// Câmera que segue o personagem, presa às bordas do mundo (mesma conta que o servidor usa para decidir o que enviar).
export interface Camera { x: number; y: number }
export function follow(cam: Camera, p: { x: number; y: number }, map: WorldMap) {
  const r = viewRect(map, p.x, p.y);
  cam.x = r.x; cam.y = r.y;
}
