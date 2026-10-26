import fs from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, type Room } from '@colyseus/sdk';
import { matchMaker } from 'colyseus';
import { MSG, World, encodeInput, emptyInput, unpackPlayer, type ChatMsg, type InputState, type Profile, type ProfileMsg, type SnapshotMsg, type WelcomeMsg } from '@vale/shared';
import { parseConfig } from '../src/config/load';
import { setConfig } from '../src/config/store';
import { startServer } from '../src/app';
import { WORLD_MAP } from '../src/map';

// Sobe o servidor de verdade numa porta livre e conecta clientes reais pelo WebSocket.
const PORT = 25670 + Math.floor(Math.random() * 1000);
let server: Awaited<ReturnType<typeof startServer>>['server'];
let roomId = '';

interface Bot { room: Room; welcome: WelcomeMsg; last: SnapshotMsg | null; seq: number; tiles: Map<string, string>; profiles: Map<string, Profile>; chat: ChatMsg[] }
async function bot(name: string, look?: unknown): Promise<Bot> {
  const room = await new Client(`ws://127.0.0.1:${PORT}`).join('world', { name, look });
  const b = { room, last: null, seq: 0, tiles: new Map(), profiles: new Map(), chat: [] } as unknown as Bot;
  room.onMessage(MSG.chat, (m: ChatMsg) => b.chat.push(m));
  room.onMessage(MSG.profile, (m: ProfileMsg) => { if ('gone' in m) b.profiles.delete(m.id); else b.profiles.set(m.id, m); });
  room.onMessage(MSG.snapshot, (s: SnapshotMsg) => { b.last = s; for (const ev of s.ev) if (ev.t === 'tile') b.tiles.set(ev.tx + ',' + ev.ty, ev.c); });
  const w = new Promise<WelcomeMsg>(r => room.onMessage(MSG.welcome, r));
  room.send(MSG.hello);
  b.welcome = await w;
  for (const p of b.welcome.profiles) b.profiles.set(p.id, p);
  return b;
}
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
// manda um input por "passo" durante ms
async function hold(b: Bot, patch: Partial<InputState>, ms: number) {
  const end = Date.now() + ms;
  let first = true;
  while (Date.now() < end) { b.room.send(MSG.input, encodeInput(++b.seq, { ...emptyInput(), ...patch, tap: first ? patch.tap ?? 0 : 0 })); first = false; await sleep(1000 / 60); }
}

beforeAll(async () => {
  const text = fs.readFileSync(new URL('../config.yaml', import.meta.url), 'utf8').replace(/port: \d+/, `port: ${PORT}`);
  setConfig(parseConfig(text, WORLD_MAP));
  ({ server, roomId } = await startServer(PORT));
});
afterAll(async () => { await server.gracefullyShutdown(false); });

describe('rede', () => {
  it('recebe o mapa ao entrar e snapshots com o próprio estado', async () => {
    const a = await bot('Ana');
    expect(a.welcome.tiles.length).toBe(28);
    await sleep(200);
    expect(a.last?.me).toBeTruthy();
    expect(a.last!.ack).toBe(0);
    expect(a.last!.me).toMatchObject({ hp: 100, maxHp: 100, mp: 50, maxMp: 50 });   // valores do config.yaml
    await a.room.leave();
  });

  it('o servidor move quem manda input e confirma o último aplicado', async () => {
    const a = await bot('Ana');
    await sleep(150);
    const x0 = a.last!.me!.x;
    await hold(a, { right: true }, 500);
    await sleep(150);
    expect(a.last!.me!.x).toBeGreaterThan(x0 + 20);
    expect(a.last!.ack).toBe(a.seq);
    await a.room.leave();
  });

  it('dois jogadores se enxergam, e o corte de um aparece para o outro', async () => {
    const a = await bot('Ana'), b = await bot('Beto');
    await sleep(200);
    expect(a.profiles.get(b.room.sessionId)?.name).toBe('Beto');
    expect(a.last!.p.map(unpackPlayer).map(p => p.id)).toContain(b.room.sessionId);
    // Ana anda até o arbusto em (2,2), a sudoeste do spawn, e corta para a esquerda
    await hold(a, { left: true }, 1100);
    await hold(a, { up: true }, 450);
    await hold(a, { left: true, a: true, tap: 1 }, 50);
    await hold(a, {}, 400);
    const cut = [...b.tiles].filter(([, c]) => c === '.');
    expect(cut.length).toBeGreaterThan(0);
    await a.room.leave(); await b.room.leave();
  });

  it('cada input vira exatamente um passo, mesmo chegando em rajadas', async () => {
    const a = await bot('Ana');
    await sleep(150);
    const sim = new World({ ...WORLD_MAP, enemies: [] });
    const me = sim.addPlayer('x', 'x', a.last!.me!.x, a.last!.me!.y);
    const seq: Partial<InputState>[] = [...Array(40).fill({ down: true }).slice(0, 20), ...Array(50).fill({ left: true }), ...Array(30).fill({ up: true, left: true })];   // rumo oeste: longe dos monstros e dos arbustos cortados nos outros testes
    // rajadas de 1 a 6 inputs com pausas: a fila do servidor esvazia e enche
    for (let i = 0; i < seq.length;) {
      const burst = 1 + (i % 6);
      for (let k = 0; k < burst && i < seq.length; k++, i++) {
        const inp = { ...emptyInput(), ...seq[i] };
        a.room.send(MSG.input, encodeInput(++a.seq, inp));
        sim.stepPlayer('x', inp);
      }
      await sleep(burst * 25);
    }
    await sleep(400);
    expect(a.last!.ack).toBe(a.seq);
    expect(a.last!.me!.x).toBeCloseTo(me.x, 5);
    expect(a.last!.me!.y).toBeCloseTo(me.y, 5);
    await a.room.leave();
  });

  it('nome e aparência: validados, avisados a todos, e quem sai some da lista', async () => {
    const a = await bot('Ana', { cloak: 3, hair: 99 });
    const b = await bot('  <Beto>!! ', { cloak: -1 });
    await sleep(100);
    expect(b.profiles.get(a.room.sessionId)).toMatchObject({ name: 'Ana', look: { cloak: 3, hair: 0 } });   // cabelo inválido → padrão
    expect(a.profiles.get(b.room.sessionId)?.name).toBe('Beto');
    b.room.send(MSG.profile, { name: 'Beto Bravo', look: { cloak: 5, hair: 2 } });
    b.room.send(MSG.profile, { name: 'Spam', look: { cloak: 1, hair: 1 } });   // cedo demais: ignorado
    await sleep(150);
    expect(a.profiles.get(b.room.sessionId)).toMatchObject({ name: 'Beto Bravo', look: { cloak: 5, hair: 2 } });
    const bid = b.room.sessionId;
    await b.room.leave(); await sleep(150);
    expect(a.profiles.has(bid)).toBe(false);
    await a.room.leave();
  });

  it('chat: "Perto" chega só a quem está no alcance, "Todos" chega a todos, texto vem limpo', async () => {
    const a = await bot('Ana'), b = await bot('Beto'), c = await bot('Caio');
    // Caio vai para o outro lado do mapa
    const world = (matchMaker.getLocalRoomById(roomId) as unknown as { world: World }).world;
    const far = world.players.get(c.room.sessionId)!; far.x = 40 * 16; far.y = 24 * 16;
    await sleep(100);
    a.room.send(MSG.chat, { text: '  oi\u0007   gente  ', ch: 'local' });
    a.room.send(MSG.chat, { text: 'x'.repeat(500), ch: 'global' });
    a.room.send(MSG.chat, { text: '   ', ch: 'local' });   // vazio: ignorado
    await sleep(200);
    const said = (bt: Bot) => bt.chat.filter(m => m.from === a.room.sessionId);
    expect(said(a).map(m => m.text)).toEqual(['oi gente', 'x'.repeat(120)]);
    expect(said(b).map(m => m.ch)).toEqual(['local', 'global']);
    expect(said(c).map(m => m.ch)).toEqual(['global']);   // longe demais para o "Perto"
    expect(said(b)[0].name).toBe('Ana');
    await a.room.leave(); await b.room.leave(); await c.room.leave();
  });

  it('chat: avisa entrada e saída, e segura spam', async () => {
    const a = await bot('Ana');
    const b = await bot('Beto');
    await sleep(100);
    expect(a.chat).toContainEqual({ ch: 'system', text: 'Beto entrou no Vale' });
    for (let i = 0; i < 8; i++) b.room.send(MSG.chat, { text: 'spam ' + i, ch: 'global' });
    await sleep(200);
    expect(a.chat.filter(m => m.from === b.room.sessionId).length).toBe(5);   // burst do config
    expect(b.chat.some(m => m.ch === 'system' && m.text.startsWith('Calma'))).toBe(true);
    await b.room.leave(); await sleep(150);
    expect(a.chat).toContainEqual({ ch: 'system', text: 'Beto saiu' });
    await a.room.leave();
  });

  it('quem aparece na tela é enviado, mesmo com a câmera presa na borda do mundo', async () => {
    const a = await bot('Ana'), b = await bot('Beto');
    const world = (matchMaker.getLocalRoomById(roomId) as unknown as { world: World }).world;
    // Ana encostada na borda esquerda: a câmera dela mostra x de 0 a 256, e não de Ana-128 a Ana+128
    const pa = world.players.get(a.room.sessionId)!, pb = world.players.get(b.room.sessionId)!;
    pa.x = 24; pa.y = 40; pb.x = 236; pb.y = 200;   // Beto no canto oposto da mesma tela
    await sleep(250);
    expect(a.last!.p.map(unpackPlayer).map(p => p.id)).toContain(b.room.sessionId);
    pb.x = 256 + 80;                                // agora fora da tela de Ana, além da margem
    await sleep(250);
    expect(a.last!.p.map(unpackPlayer).map(p => p.id)).not.toContain(b.room.sessionId);
    await a.room.leave(); await b.room.leave();
  });

  it('PvP: liga, recusa desligar dentro da trava, fere fora da zona segura e anuncia a queda', async () => {
    const a = await bot('Ana'), b = await bot('Beto');
    await sleep(100);
    expect(a.last!.pvp).toEqual({ mode: 'optional', lock: 0 });
    a.room.send(MSG.pvp, { on: true }); b.room.send(MSG.pvp, { on: true });
    await sleep(150);
    expect(a.chat.at(-1)?.text).toMatch(/PvP ligado/);
    expect(a.last!.pvp.lock).toBeGreaterThan(200);           // 5 min de cooldown no config
    a.room.send(MSG.pvp, { on: false });
    await sleep(100);
    expect(a.chat.at(-1)?.text).toMatch(/só pode desligar o PvP em [45]min \d\ds/);
    // os dois saem da Clareira (zona segura) para a Margem do Rio; Ana de frente para Beto
    const world = (matchMaker.getLocalRoomById(roomId) as unknown as { world: World }).world;
    const pa = world.players.get(a.room.sessionId)!, pb = world.players.get(b.room.sessionId)!;
    pa.x = 20 * 16; pa.y = 7 * 16; pa.dir = 3; pb.x = 20 * 16 + 14; pb.y = 7 * 16; pb.hp = 5; pb.inv = 0;
    await sleep(100);
    expect(a.last!.p.map(unpackPlayer).find(p => p.id === b.room.sessionId)?.pvpActive).toBe(true);
    await hold(a, { a: true, tap: 1 }, 50); await hold(a, {}, 300);
    expect(pb.state).toBe('dead');
    expect(b.chat).toContainEqual({ ch: 'system', text: 'Ana derrubou Beto' });
    expect(b.last!.me!.killer).toBe('Ana');
    await a.room.leave(); await b.room.leave();
  });

  it('input malformado é ignorado sem derrubar ninguém', async () => {
    const a = await bot('Ana');
    a.room.send(MSG.input, ['x', 'y', 'z']);
    a.room.send(MSG.input, [1, 99999, null]);
    a.room.send(MSG.input, null);
    await hold(a, { down: true }, 200);
    await sleep(100);
    expect(a.last!.ack).toBe(a.seq);
    await a.room.leave();
  });
});
