import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { defineRoom, defineServer, matchMaker } from 'colyseus';
import { authRoutes } from './auth/routes';
import { oficinaEnabled, oficinaRoutes } from './oficina/routes';
import { WorldRoom } from './rooms/WorldRoom';

// Página do jogo já compilada (npm run build). Servida pela mesma porta: um endereço só para os amigos.
export const CLIENT_DIST = fileURLToPath(new URL('../../client/dist', import.meta.url));

// Sobe o Colyseus, as rotas de conta (/api) e a sala do mundo. Config e banco precisam estar prontos antes.
export async function startServer(port: number) {
  const hasClient = fs.existsSync(CLIENT_DIST + '/index.html');
  const server = defineServer({
    rooms: { world: defineRoom(WorldRoom) },
    express: app => {
      app.set('trust proxy', 'loopback');   // atrás de um proxy local (túnel, nginx), o IP real vem no cabeçalho
      app.get('/api/health', (_req, res) => { res.json({ ok: true }); });   // o jogo pergunta antes de decidir entre login e manutenção
      if (oficinaEnabled()) app.use('/api/oficina', oficinaRoutes());   // antes de /api: as rotas de conta respondem 404 ao resto
      app.use('/api', authRoutes());
      if (hasClient) {
        if (oficinaEnabled()) app.get('/oficina', (_req, res) => { res.sendFile(CLIENT_DIST + '/oficina.html'); });
        app.use(express.static(CLIENT_DIST));
      }
    }
  });
  await server.listen(port);
  const room = await matchMaker.createRoom('world', {});
  return { server, roomId: room.roomId, hasClient };
}
