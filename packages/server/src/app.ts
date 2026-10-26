import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { defineRoom, defineServer, matchMaker } from 'colyseus';
import { WorldRoom } from './rooms/WorldRoom';

// Página do jogo já compilada (npm run build). Servida pela mesma porta: um endereço só para os amigos.
export const CLIENT_DIST = fileURLToPath(new URL('../../client/dist', import.meta.url));

// Sobe o Colyseus e cria a sala do mundo. A config precisa estar carregada antes (config/store).
export async function startServer(port: number) {
  const hasClient = fs.existsSync(CLIENT_DIST + '/index.html');
  const server = defineServer({
    rooms: { world: defineRoom(WorldRoom) },
    express: app => { if (hasClient) app.use(express.static(CLIENT_DIST)); }
  });
  await server.listen(port);
  const room = await matchMaker.createRoom('world', {});
  return { server, roomId: room.roomId, hasClient };
}
