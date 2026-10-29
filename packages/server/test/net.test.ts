import fs from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, type Room } from '@colyseus/sdk';
import { matchMaker } from 'colyseus';
import { BUTTON, MSG, World, damagePlayer, encodeInput, reelCursor, emptyInput, unpackPlayer, type ChatMsg, type GameEvent, type InputState, type Profile, type ProfileMsg, type SnapshotMsg, type WelcomeMsg } from '@vale/shared';
import { parseConfig } from '../src/config/load';
import { getConfig, setConfig } from '../src/config/store';
import { startServer } from '../src/app';
import { getDb, openDatabase, setDb } from '../src/persistence/db';
import { fileURLToPath } from 'node:url';
import { loadMap, setMaps } from '../src/map';
// cópias fixas dos mapas (não os que estão sendo editados no Tiled)
const fixture = (f: string) => loadMap(fileURLToPath(new URL('../../shared/test/maps/' + f, import.meta.url)), false);
const WORLD_MAP = fixture('vale.tmj'), CAVE = fixture('caverna.tmj');

// Sobe o servidor de verdade numa porta livre e conecta clientes reais pelo WebSocket.
const PORT = 25670 + Math.floor(Math.random() * 1000);
let server: Awaited<ReturnType<typeof startServer>>['server'];
let roomId = '';

interface Bot { room: Room; welcome: WelcomeMsg; last: SnapshotMsg | null; seq: number; tiles: Map<string, string>; profiles: Map<string, Profile>; chat: ChatMsg[]; ch?: string[] }
const API = () => `http://127.0.0.1:${PORT}/api`;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function api(path: string, body?: unknown, token?: string, method = body === undefined ? 'GET' : 'POST'): Promise<{ status: number; body: any }> {
  const res = await fetch(API() + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, body: res.status === 204 ? null : await res.json() };
}
// Uma conta e um personagem por nome, criados na primeira vez; a cada bot o personagem volta ao ponto de partida.
const accounts = new Map<string, { token: string; charId: number; user: string }>();
async function account(name: string, look?: unknown) {
  let a = accounts.get(name);
  if (!a) {
    const user = 'u' + name.toLowerCase().replace(/[^a-z0-9]/g, '') + Math.floor(Math.random() * 1e6);
    const { body: auth } = await api('/register', { username: user, password: 'senha123' });
    const { body: ch } = await api('/characters', { name, look }, auth.token);
    accounts.set(name, a = { token: auth.token, charId: ch.id, user });
  }
  await getDb().updateTable('characters').set({ x: null, y: null, hp: null, mp: null }).where('id', '=', a.charId).execute();
  return a;
}
async function bot(name: string, look?: unknown): Promise<Bot> {
  const a = await account(name, look);
  const room = await new Client(`ws://127.0.0.1:${PORT}`).join('world', { token: a.token, characterId: a.charId });
  const b = { room, last: null, seq: 0, tiles: new Map(), profiles: new Map(), chat: [] } as unknown as Bot;
  room.onMessage(MSG.chat, (m: ChatMsg) => b.chat.push(m));
  room.onMessage(MSG.profile, (m: ProfileMsg) => { if ('gone' in m) b.profiles.delete(m.id); else b.profiles.set(m.id, m); });
  room.onMessage(MSG.snapshot, (s: SnapshotMsg) => { b.last = s; if (s.ch) b.ch = s.ch; for (const ev of s.ev) if (ev.t === 'tile') b.tiles.set(ev.tx + ',' + ev.ty, ev.c); });
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
  const text = fs.readFileSync(new URL('../config.yaml', import.meta.url), 'utf8').replace(/port: \d+/, `port: ${PORT}`).replace(/registerPerHour: \d+/, 'registerPerHour: 1000');
  setConfig(parseConfig(text, WORLD_MAP));
  setMaps({ vale: WORLD_MAP, caverna: CAVE }, 'vale');
  setDb(await openDatabase(':memory:'));
  ({ server, roomId } = await startServer(PORT));
  // Monstros quietos num canto do Lago das Garças: os testes não podem depender de uma geleca passar por perto.
  // (na caverna, num canto longe da escada)
  const worlds = (matchMaker.getLocalRoomById(roomId) as unknown as { worlds: Map<string, World> }).worlds;
  for (const [id, w] of worlds) for (const e of w.enemies) {
    if (id === 'vale') { e.x = 39 * 16 + 8; e.y = 26 * 16 + 8; } else { e.x = 27 * 16 + 8; e.y = 3 * 16 + 8; }
    e.mode = e.type === 'slime' ? 'idle' : e.type === 'bat' ? 'hop' : 'patrol'; e.timer = 1e9; e.dir = 0; e.vx = e.vy = 0;   // morcego: pairando parado
  }
});
afterAll(async () => { await server.gracefullyShutdown(false); });

describe('rede', () => {
  it('recebe o mapa ao entrar e snapshots com o próprio estado', async () => {
    const a = await bot('Ana');
    expect(a.welcome.tiles.length).toBe(28);
    expect([a.welcome.map.cols, a.welcome.map.regions.length, a.welcome.map.enemies]).toEqual([48, 6, []]);   // o mapa vem do servidor, sem os monstros
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

  it('aparência: avisada a todos, nome fixo do personagem, e quem sai some da lista', async () => {
    const a = await bot('Aline', { cloak: 3, hair: 99 });
    const b = await bot('Bruno');
    await sleep(100);
    expect(b.profiles.get(a.room.sessionId)).toMatchObject({ name: 'Aline', look: { cloak: 3, hair: 0 } });   // cabelo inválido → padrão
    b.room.send(MSG.profile, { name: 'Outro Nome', look: { cloak: 5, hair: 2 } });
    b.room.send(MSG.profile, { name: 'Spam', look: { cloak: 1, hair: 1 } });   // cedo demais: ignorado
    await sleep(150);
    expect(a.profiles.get(b.room.sessionId)).toMatchObject({ name: 'Bruno', look: { cloak: 5, hair: 2 } });   // o nome não muda
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

describe('contas e personagens', () => {
  it('cria conta, recusa usuário repetido (sem diferenciar maiúsculas) e senha curta', async () => {
    const user = 'Ze' + Math.floor(Math.random() * 1e6);
    expect((await api('/register', { username: user, password: 'senha123' })).status).toBe(201);
    expect(await api('/register', { username: user.toLowerCase(), password: 'senha123' })).toMatchObject({ status: 409, body: { error: 'Esse usuário já existe.' } });
    expect((await api('/register', { username: 'outro' + user, password: '123' })).body.error).toMatch(/pelo menos 6/);
    expect((await api('/register', { username: 'com espaço', password: 'senha123' })).status).toBe(400);
  });
  it('login certo devolve token; errado não diz se a conta existe', async () => {
    const user = 'Lu' + Math.floor(Math.random() * 1e6);
    await api('/register', { username: user, password: 'senha123' });
    const ok = await api('/login', { username: user, password: 'senha123' });
    expect(ok.status).toBe(200);
    expect(ok.body.token).toMatch(/^[\w-]{40,}$/);
    const wrong = await api('/login', { username: user, password: 'errada!' }), none = await api('/login', { username: 'ninguem' + user, password: 'senha123' });
    expect([wrong.status, none.status]).toEqual([401, 401]);
    expect(wrong.body.error).toBe(none.body.error);
    expect((await api('/me', undefined, 'token-falso-mas-comprido-o-bastante')).status).toBe(401);
  });
  it('senha guardada só como hash', async () => {
    const user = 'Hx' + Math.floor(Math.random() * 1e6);
    await api('/register', { username: user, password: 'minha-senha' });
    const row = await getDb().selectFrom('accounts').select('pass_hash').where('username', '=', user).executeTakeFirstOrThrow();
    expect(row.pass_hash).toMatch(/^scrypt\$/);
    expect(row.pass_hash).not.toContain('minha-senha');
  });
  it('personagens: até o máximo da config, nome único e válido, apagar só os seus', async () => {
    const { body: a } = await api('/register', { username: 'Pa' + Math.floor(Math.random() * 1e6), password: 'senha123' });
    const { body: b } = await api('/register', { username: 'Pb' + Math.floor(Math.random() * 1e6), password: 'senha123' });
    const base = 'Heroi' + Math.floor(Math.random() * 1e5);
    const c1 = await api('/characters', { name: base + 'a', look: { cloak: 2, hair: 3 } }, a.token);
    expect(c1).toMatchObject({ status: 201, body: { name: base + 'a', look: { cloak: 2, hair: 3 } } });
    expect((await api('/characters', { name: (base + 'A').toUpperCase() }, b.token)).status).toBe(409);   // nome já usado, mesmo com outras maiúsculas
    expect((await api('/characters', { name: '<script>' }, a.token)).status).toBe(400);
    const accent = 'Íris' + base.slice(5);
    expect((await api('/characters', { name: accent }, a.token)).status).toBe(201);
    expect((await api('/characters', { name: accent.toLowerCase().replace('í', 'i') }, b.token)).body.error).toBe('Esse nome já está em uso.');
    await api('/characters/' + (await api('/me', undefined, a.token)).body.characters.find((c: { name: string }) => c.name === accent).id, undefined, a.token, 'DELETE');
    await api('/characters', { name: base + 'b' }, a.token); await api('/characters', { name: base + 'c' }, a.token);
    expect((await api('/characters', { name: base + 'd' }, a.token)).body.error).toMatch(/já tem 3/);
    expect((await api('/me', undefined, a.token)).body.characters).toHaveLength(3);
    expect((await api('/characters/' + c1.body.id, undefined, b.token, 'DELETE')).status).toBe(404);   // não é dele
    expect((await api('/characters/' + c1.body.id, undefined, a.token, 'DELETE')).status).toBe(204);
    expect((await api('/me', undefined, a.token)).body.characters).toHaveLength(2);
  });
  it('sem token válido ou com personagem de outra conta, não entra no mundo', async () => {
    const c = new Client(`ws://127.0.0.1:${PORT}`);
    await expect(c.join('world', { token: 'x'.repeat(43), characterId: 1 })).rejects.toThrow(/Sessão expirada/);
    const mine = await account('Dono'), { body: other } = await api('/register', { username: 'In' + Math.floor(Math.random() * 1e6), password: 'senha123' });
    await expect(c.join('world', { token: other.token, characterId: mine.charId })).rejects.toThrow(/não encontrado/);
  });
  it('posição, vida e aparência ficam salvas ao sair e voltam ao entrar', async () => {
    const a = await bot('Salva');
    const world = (matchMaker.getLocalRoomById(roomId) as unknown as { world: World }).world;
    const p = world.players.get(a.room.sessionId)!; p.x = 20 * 16; p.y = 7 * 16; p.hp = 42;
    a.room.send(MSG.profile, { name: 'x', look: { cloak: 4, hair: 6 } });
    await sleep(150); await a.room.leave(); await sleep(150);
    const acc = accounts.get('Salva')!;
    const room = await new Client(`ws://127.0.0.1:${PORT}`).join('world', { token: acc.token, characterId: acc.charId });
    await sleep(150);
    const again = world.players.get(room.sessionId)!;
    expect([again.x, again.y, Math.floor(again.hp), again.look]).toEqual([320, 112, 42, { cloak: 4, hair: 6 }]);
    await room.leave();
  });
  it('equipar pela mensagem de item: só o que tem, e o equipado fica salvo', async () => {
    const a = await bot('Maga');
    const world = (matchMaker.getLocalRoomById(roomId) as unknown as { world: World }).world;
    const p = world.players.get(a.room.sessionId)!;
    a.room.send(MSG.item, { action: 'equip', gear: 'firestaff', slot: 'a' });   // ainda não tem
    await sleep(150);
    expect(p.gear.a).toBe('sword');
    expect(a.chat.at(-1)?.text).toBe('Você não tem isso.');
    p.bag[0] = { id: 'firestaff', n: 1 }; p.bagVersion++;
    a.room.send(MSG.item, { action: 'equip', gear: 'firestaff', slot: 'c' });
    await sleep(150);
    expect(p.gear).toEqual({ a: 'sword', c: 'firestaff' });
    await a.room.leave(); await sleep(150);
    const acc = accounts.get('Maga')!;
    const room = await new Client(`ws://127.0.0.1:${PORT}`).join('world', { token: acc.token, characterId: acc.charId });
    await sleep(150);
    expect(world.players.get(room.sessionId)!.gear).toEqual({ a: 'sword', c: 'firestaff' });
    await room.leave();
  });
  it('o mesmo personagem entrando de outro lugar derruba a sessão antiga', async () => {
    const a = await bot('Duplo');
    const kicked = new Promise<number>(r => a.room.onLeave(code => r(code)));
    const acc = accounts.get('Duplo')!;
    const room2 = await new Client(`ws://127.0.0.1:${PORT}`).join('world', { token: acc.token, characterId: acc.charId });
    expect(await kicked).toBe(4002);
    await sleep(100);
    const world = (matchMaker.getLocalRoomById(roomId) as unknown as { world: World }).world;
    expect([...world.players.values()].filter(p => p.name === 'Duplo')).toHaveLength(1);
    await room2.leave();
  });
});

describe('progresso e itens', () => {
  it('derrubar monstro dá XP, o loot vai para o inventário, usar item cura, e tudo fica salvo', async () => {
    const a = await bot('Lootadora');
    const world = (matchMaker.getLocalRoomById(roomId) as unknown as { world: World }).world;
    const p = world.players.get(a.room.sessionId)!;
    p.x = 20 * 16; p.y = 7 * 16;
    // geleca morrendo com golpe da Ana, e a tabela de drop forçada para ter certeza do loot
    const saved = world.rules.enemies.slime.drops;
    world.rules.enemies.slime.drops = [{ item: 'gold', chance: 1, min: 3, max: 3 }, { item: 'heart', chance: 1, min: 1, max: 1 }];
    const e = world.enemies.find(e => e.type === 'slime')!;
    e.x = p.x + 4; e.y = p.y; e.lastHitBy = p.id; e.hp = 0; e.dying = true; e.hurtT = 1;
    const gains: string[] = [];
    a.room.onMessage(MSG.snapshot, (s: SnapshotMsg) => { for (const ev of s.ev as GameEvent[]) if (ev.t === 'gain') gains.push(ev.text); });
    await sleep(500);
    await hold(a, { b: true, tap: BUTTON.b }, 600);   // segura o botão de Ação: pega tudo em volta
    await sleep(150);
    world.rules.enemies.slime.drops = saved;
    expect(a.last!.me).toMatchObject({ xp: 5, gold: 3, level: 1 });
    expect(a.last!.xpNext).toBe(50);
    expect(gains).toEqual(expect.arrayContaining(['+5 XP', '+3 de ouro', '+Coração']));
    const slot = p.bag.findIndex(s => s?.id === 'heart');
    p.hp = 40;
    a.room.send(MSG.item, { action: 'use', slot });
    await sleep(150);
    expect(Math.round(a.last!.me!.hp)).toBe(65);
    a.room.send(MSG.item, { action: 'use', slot: 99 });     // espaço inexistente: ignorado
    p.bag[5] = { id: 'shell', n: 7 }; p.bagVersion++;
    await sleep(150);
    expect(a.last!.bag).toBeUndefined();                    // o inventário só vem no snapshot em que mudou, não se repete
    await a.room.leave(); await sleep(150);
    const row = await getDb().selectFrom('characters').select(['level', 'xp', 'gold', 'items']).where('id', '=', accounts.get('Lootadora')!.charId).executeTakeFirstOrThrow();
    expect(row).toMatchObject({ level: 1, xp: 5, gold: 3 });
    expect(JSON.parse(row.items)[5]).toEqual({ id: 'shell', n: 7 });
  });
});

describe('mapas e portais', () => {
  const room = () => matchMaker.getLocalRoomById(roomId) as unknown as { world: World; worlds: Map<string, World> };
  it('entrar no portal leva para a caverna com tudo; voltar traz de volta ao Vale', async () => {
    const a = await bot('Exploradora');
    const vale = room().world, cave = room().worlds.get('caverna')!;
    const p = vale.players.get(a.room.sessionId)!;
    p.x = 44 * 16 + 8; p.y = 2 * 16 + 14; p.gold = 7; p.inPortal = false;   // logo abaixo da entrada da caverna
    const welcome = new Promise<WelcomeMsg>(r => a.room.onMessage(MSG.welcome, r));
    await hold(a, { up: true }, 400);
    const w = await welcome;
    expect(w.map.name).toBe('Caverna Funda');
    expect(w.at).toEqual({ x: 14 * 16 + 8, y: 18 * 16 + 2 });   // logo acima da escada, de costas para ela
    expect(vale.players.has(a.room.sessionId)).toBe(false);
    expect(cave.players.get(a.room.sessionId)?.gold).toBe(7);        // levou o que tinha
    await sleep(200);
    expect(a.last!.me).toMatchObject({ x: 232, gold: 7 });
    expect(cave.players.has(a.room.sessionId)).toBe(true);           // continuar segurando a tecla não volta pela escada
    // sai e volta: continua na caverna
    await a.room.leave(); await sleep(150);
    const row = await getDb().selectFrom('characters').select(['map', 'x', 'y']).where('id', '=', accounts.get('Exploradora')!.charId).executeTakeFirstOrThrow();
    expect(row.map).toBe('caverna');
    const acc = accounts.get('Exploradora')!;
    const r2 = await new Client(`ws://127.0.0.1:${PORT}`).join('world', { token: acc.token, characterId: acc.charId });
    await sleep(150);
    expect(cave.players.has(r2.sessionId)).toBe(true);
    // a escada (embaixo) leva de volta ao ponto "caverna" no Vale
    const q = cave.players.get(r2.sessionId)!; q.x = 14 * 16 + 8; q.y = 18 * 16 + 6; q.inPortal = false; q.portalWait = 0;
    let seq = 1000;
    for (let i = 0; i < 25; i++) { r2.send(MSG.input, encodeInput(++seq, { ...emptyInput(), down: true })); await sleep(16); }
    await sleep(200);
    expect(vale.players.has(r2.sessionId)).toBe(true);
    expect(vale.players.get(r2.sessionId)!.x).toBe(44 * 16 + 8);
    await r2.leave();
  });
  it('quem cai na caverna renasce no Vale', async () => {
    const a = await bot('Azarada');
    const vale = room().world, cave = room().worlds.get('caverna')!;
    const p = vale.players.get(a.room.sessionId)!;
    p.x = 44 * 16 + 8; p.y = 2 * 16 + 14; p.inPortal = false;
    await hold(a, { up: true }, 400);
    expect(cave.players.has(a.room.sessionId)).toBe(true);
    const c = cave.players.get(a.room.sessionId)!;
    const delay = cave.rules.player.respawnDelay;
    cave.rules.player.respawnDelay = 0.5;                            // o do config (5 s) passaria do tempo do teste
    c.inv = 0; damagePlayer(cave, c, 9999, c);
    cave.rules.player.respawnDelay = delay;
    await sleep(1200);
    const back = vale.players.get(a.room.sessionId);
    expect(back?.state).toBe('walk');
    expect(back?.hp).toBe(back?.maxHp);
    expect(vale.map.regionAt(back!.x, back!.y)?.id).toBe(vale.rules.player.respawnPoint);
    await a.room.leave();
  });
});

describe('baús', () => {
  it('abrir dá o conteúdo; continua vazio para quem abriu mesmo saindo e voltando; outro personagem ainda pode abrir', async () => {
    const a = await bot('Cacadora');
    const vale = (matchMaker.getLocalRoomById(roomId) as unknown as { world: World }).world;
    const chest = vale.map.data.chests![0];
    const p = vale.players.get(a.room.sessionId)!;
    p.x = chest.x * 16 + 8; p.y = (chest.y + 1) * 16 + 4; p.dir = 1;   // encostada embaixo do baú, olhando para ele
    await sleep(100);
    expect(a.ch).toEqual([]);                                          // fechado para ela (a lista vem quando muda)
    await hold(a, { b: true, tap: 2 }, 50); await hold(a, {}, 600);
    expect(p.gold).toBeGreaterThanOrEqual(10);
    expect(a.ch).toEqual([`${chest.x},${chest.y}`]);                   // agora vazio para ela
    expect(p.chests[`vale:${chest.x},${chest.y}`]).toBeTypeOf('number');
    await a.room.leave(); await sleep(150);
    const acc = accounts.get('Cacadora')!;
    const room2 = await new Client(`ws://127.0.0.1:${PORT}`).join('world', { token: acc.token, characterId: acc.charId });
    let ch: string[] | undefined;
    room2.onMessage(MSG.snapshot, (s: SnapshotMsg) => { if (s.ch) ch = s.ch; });
    room2.send(MSG.hello);
    await sleep(250);
    expect(ch).toEqual([`${chest.x},${chest.y}`]);                     // salvo no banco: continua vazio para ela
    const b = await bot('Outro');
    await sleep(150);
    expect(b.ch).toEqual([]);                                          // para outro personagem, cheio
    await room2.leave(); await b.room.leave();
  });
  it('mochila cheia: o resto fica guardado no baú, sobrevive a sair e voltar, e é entregue depois', async () => {
    const a = await bot('Acumuladora');
    const vale = (matchMaker.getLocalRoomById(roomId) as unknown as { world: World }).world;
    const chest = vale.map.data.chests![0], key = `vale:${chest.x},${chest.y}`;
    const p = vale.players.get(a.room.sessionId)!;
    for (let i = 0; i < p.bag.length; i++) p.bag[i] = { id: 'jelly', n: 99 };
    p.bagVersion++;
    p.x = chest.x * 16 + 8; p.y = (chest.y + 1) * 16 + 4; p.dir = 1;
    await sleep(100);
    await hold(a, { b: true, tap: 2 }, 50); await hold(a, {}, 400);
    const left = p.chestLoot[key];
    expect(left?.length).toBeGreaterThan(0);                            // o que não coube ficou no baú
    expect(a.ch ?? []).toEqual([]);                                     // e ele aparece fechado para ela
    await a.room.leave(); await sleep(150);
    const acc = accounts.get('Acumuladora')!;
    const room2 = await new Client(`ws://127.0.0.1:${PORT}`).join('world', { token: acc.token, characterId: acc.charId });
    room2.send(MSG.hello);
    await sleep(250);
    const again = vale.players.get(room2.sessionId)!;
    expect(again.chestLoot[key]).toEqual(left);                         // salvo no banco
    again.bag[0] = null; again.bag[1] = null; again.bag[2] = null; again.bagVersion++;
    again.x = chest.x * 16 + 8; again.y = (chest.y + 1) * 16 + 4; again.dir = 1;
    room2.send(MSG.input, encodeInput(1, { ...emptyInput(), b: true, tap: 2 }));
    await sleep(300);
    expect(again.chestLoot[key]).toBeUndefined();                       // entregue
    expect(again.bag.slice(0, 3).some(s => s && s.id !== 'jelly')).toBe(true);
    await room2.leave();
  });
});

describe('pesca', () => {
  it('pescar uma truta grava o recorde, anuncia para todos e aparece em /api/records', async () => {
    const a = await bot('Pescadora'), b = await bot('Plateia');
    const vale = (matchMaker.getLocalRoomById(roomId) as unknown as { world: World }).world;
    const p = vale.players.get(a.room.sessionId)!;
    p.x = 20 * 16 + 8; p.y = 8 * 16 + 8; p.dir = 0;   // na margem, olhando para o rio
    await hold(a, { b: true, tap: 2 }, 50);            // lança a linha
    await sleep(100);
    expect(p.state).toBe('fish');
    // pula a espera: fisgada difícil (só truta de dia), com o cursor na zona no próximo passo
    const f = p.fish!; f.phase = 'reel'; f.tier = 2; f.t = 10; f.zone = reelCursor({ ...f, t: 11 });
    await hold(a, { b: true, tap: 2 }, 20);
    await sleep(300);
    expect(p.bag.some(s => s?.id === 'trout')).toBe(true);
    const rec = b.chat.find(m => m.text.startsWith('🏆'));
    expect(rec?.text).toMatch(/Pescadora pescou Truta dourada de \d+ cm: novo recorde do servidor!/);
    const list = (await api('/records')).body;
    expect(list.find((r: { item: string }) => r.item === 'trout')).toMatchObject({ character: 'Pescadora' });
    await a.room.leave(); await b.room.leave();
  });
});

describe('chat: comandos e moderação', () => {
  const lastSystem = (b: Bot) => b.chat.filter(m => m.ch === 'system').at(-1)?.text ?? '';
  const say = async (b: Bot, text: string, ch: 'local' | 'global' = 'global') => { b.room.send(MSG.chat, { ch, text }); await sleep(150); };
  const vale = () => (matchMaker.getLocalRoomById(roomId) as unknown as { world: World }).world;

  it('comando não vai para os outros; quem não é administrador só usa /ajuda e /quem', async () => {
    const a = await bot('Curiosa'), b = await bot('Ouvinte');
    await sleep(150);
    await say(a, '/dar coracao 5');
    expect(lastSystem(a)).toBe('Só administradores podem usar /dar.');
    expect(b.chat.some(m => m.text.includes('/dar'))).toBe(false);
    expect(vale().players.get(a.room.sessionId)!.bag.some(s => s?.id === 'heart')).toBe(false);
    await say(a, '/quem');
    expect(lastSystem(a)).toMatch(/^Online \(\d+\): .*Curiosa .*Ouvinte/);
    await say(a, '/voar');
    expect(lastSystem(a)).toMatch(/Comando desconhecido/);
    await a.room.leave(); await b.room.leave();
  });

  it('administrador: /dar para si e para outro, /anunciar para todos, /invasao', async () => {
    const adm = await bot('Chefa'), b = await bot('Sortudo');
    getConfig().admins = [accounts.get('Chefa')!.user.toUpperCase()];   // sem diferenciar maiúsculas
    await sleep(150);
    const me = vale().players.get(adm.room.sessionId)!, other = vale().players.get(b.room.sessionId)!;
    await say(adm, '/dar coracao 3');
    expect(me.bag.find(s => s?.id === 'heart')?.n).toBe(3);
    await say(adm, '/dar Sortudo cajado-de-fogo');
    expect(other.bag.some(s => s?.id === 'firestaff')).toBe(true);
    const gold = other.gold;
    await say(adm, '/dar Sortudo ouro 50');
    expect(other.gold).toBe(gold + 50);
    await say(adm, '/anunciar Festa na Clareira às 20h!');
    expect(b.chat.at(-1)).toEqual({ ch: 'system', text: 'Festa na Clareira às 20h!' });
    await say(adm, '/invasao');
    expect(vale().invasion?.phase).toBe('warn');
    vale().invasion = null;   // não atrapalha os outros testes
    getConfig().admins = [];
    await adm.room.leave(); await b.room.leave();
  });

  it('/silenciar tira o chat por um tempo; /dessilenciar devolve', async () => {
    const adm = await bot('Juiza'), b = await bot('Falante'), c = await bot('Plateia2');
    getConfig().admins = [accounts.get('Juiza')!.user];
    await sleep(150);
    await say(adm, '/silenciar Falante 5');
    await say(b, 'oi gente');
    expect(c.chat.some(m => m.text === 'oi gente')).toBe(false);
    expect(lastSystem(b)).toBe('Você está sem chat por mais 5 min.');
    await say(adm, '/dessilenciar Falante');
    await say(b, 'voltei');
    expect(c.chat.some(m => m.text === 'voltei')).toBe(true);
    getConfig().admins = [];
    await adm.room.leave(); await b.room.leave(); await c.room.leave();
  });

  it('/expulsar tira do servidor com o código 4003', async () => {
    const adm = await bot('Xerife'), b = await bot('Bagunceiro');
    getConfig().admins = [accounts.get('Xerife')!.user];
    await sleep(150);
    const left = new Promise<number>(r => b.room.onLeave(code => r(code)));
    await say(adm, '/expulsar Bagunceiro spam no chat');
    expect(await left).toBe(4003);
    expect(b.chat.some(m => m.text === 'Você foi expulso do servidor. Motivo: spam no chat')).toBe(true);
    await sleep(150);
    expect([...vale().players.values()].some(p => p.name === 'Bagunceiro')).toBe(false);
    getConfig().admins = [];
    await adm.room.leave();
  });

  it('palavrão vira asteriscos (filtro ligado no config)', async () => {
    const a = await bot('Boca'), b = await bot('Ouvido');
    await sleep(150);
    await say(a, 'que p0rra é essa');
    expect(b.chat.at(-1)?.text).toBe('que ***** é essa');
    await a.room.leave(); await b.room.leave();
  });
});
