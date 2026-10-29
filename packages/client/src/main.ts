import { BUTTON, VIEW_H, VIEW_W, emptyInput, fromTiled, type CharacterSummary, type ChatRequest, type GameEvent, type ProfileRequest } from '@vale/shared';
import valeTmj from '../../../content/maps/vale.tmj?raw';
import valeTsj from '../../../content/maps/vale.tsj?raw';
import maintenanceHtml from '../../../manutencao.html?raw';
import { ensureAudio, setMuted, sfx } from './audio';
import { follow, type Camera } from './camera';
import { Input, UI_SELECTOR, bindTouch } from './input';
import { Gamepads } from './gamepad';
import { Particles } from './render/particles';
import { addGlow, addSlide, render } from './render/renderer';
import { LocalSession } from './session/local';
import { NetSession } from './session/net';
import type { Scene, Session, Status } from './session/types';
import { Api, loadSession, saveSession } from './net/api';
import { AccountScreen } from './ui/account';
import { BagPanel } from './ui/bag';
import { ChatBox } from './ui/chat';
import { Floaters } from './ui/floaters';
import { updateFishBar } from './ui/fishbar';
import { Dialog } from './ui/dialog';
import { ShopPanel } from './ui/shop';
import { showRegion, updateBoss, updateClock, updateHud, updateRaid } from './ui/hud';
import { Menu } from './ui/menu';
import { NameTags } from './ui/nametags';
import { updatePad } from './ui/pad';
import { hideTitle, showTitle, titleShown } from './ui/titlebg';
import { assistTarget } from './aimassist';
import { loadIgnored, loadProfile, loadSettings, saveIgnored, saveProfile, saveSettings, type Settings } from './ui/settings';
import './style.css';

// Mapa que vem no pacote do jogo: usado offline e de fundo antes de entrar. Online, vale o mapa que o servidor manda.
const MAP = fromTiled(JSON.parse(valeTmj), JSON.parse(valeTsj), 'vale.tmj').map;
const cv = document.getElementById('screen') as HTMLCanvasElement;
cv.width = VIEW_W; cv.height = VIEW_H;
const ctx = cv.getContext('2d')!;
ctx.imageSmoothingEnabled = false;

const cam: Camera = { x: 0, y: 0 };
const particles = new Particles();
const dialog = new Dialog();
let started = false, shake = 0, tick = 0;
let talking: string | null = null;   // NPC conversando com você (ele se vira enquanto a conversa dura)
let profile = loadProfile(), settings = loadSettings();
setMuted(!settings.sound);

const stage = document.getElementById('stage')!, startEl = document.getElementById('start')!, startHint = document.getElementById('startHint')!;
const statusEl = document.getElementById('status')!;

/* ---------- Conexão: online por padrão; ?offline (ou servidor fora do ar) roda tudo no navegador ---------- */
const params = new URLSearchParams(location.search);
// Em desenvolvimento a página vem do Vite (5173) e o servidor fica na 2567; compilada, ela vem do próprio servidor.
const WS = location.protocol === 'https:' ? 'wss' : 'ws';
const SERVER = params.get('server') || import.meta.env.VITE_SERVER_URL || (import.meta.env.DEV ? `${WS}://${location.hostname}:2567` : `${WS}://${location.host}`);
const OFFLINE = params.has('offline');
// Online, o mundo só conecta depois de entrar na conta e escolher o personagem; até lá a sessão é um mundo vazio.
let session: Session = OFFLINE ? new LocalSession(MAP, profile) : new NetSession(MAP);
let ready = OFFLINE;   // já dá para começar a jogar?
const api = new Api(SERVER.replace(/^ws/, 'http') + '/api');
api.token = loadSession()?.token ?? null;
// Entra no mundo com o personagem; a mesma função serve para voltar depois de uma queda.
let playing: CharacterSummary | null = null;   // personagem em jogo (para reconectar)
let leaving = false;                           // saída de propósito: trocar de personagem ou sair da conta
async function enterWorld(c: CharacterSummary) {
  const net = new NetSession(MAP);
  net.onWelcome = motd => { if (motd) startHint.textContent = motd; };
  await net.connect(SERVER, { token: api.token!, characterId: c.id });
  session = net; bindChat(net);
  net.onMapChange = () => { stage.classList.remove('fade'); void stage.offsetWidth; stage.classList.add('fade'); };
  net.onLeave = code => connectionLost(code);
  playing = c;
}
const account = new AccountScreen(api, {
  async play(c) {
    try { await enterWorld(c); }
    catch (e) { throw Object.assign(new Error(e instanceof Error && e.message ? e.message : 'Não foi possível entrar no mundo.'), { code: (e as { code?: number }).code }); }
    profile = { name: c.name, look: { ...c.look } };
    ready = true; account.hide(); begin();
  },
  offline: () => goOffline()
});

/* ---------- Reconexão: a internet caiu, o celular dormiu, o app ficou em segundo plano ---------- */
// O Colyseus já tenta voltar sozinho por uns segundos (o servidor guarda o lugar por 15 s). Se não deu, o jogo
// entra de novo com o mesmo personagem, esperando 1, 2, 4… até 8 s entre as tentativas, por até GIVE_UP.
// A internet voltar (ou o app voltar para a frente) tenta na hora. Não voltou: pergunta ao servidor se ele
// está no ar. Está: volta para a tela de personagens, com o motivo. Não está: tela de manutenção.
const GIVE_UP = 30000;
let rejoining = false, retryTimer = 0, retryDelay = 1000, lostAt = 0;
function connectionLost(code: number) {
  if (leaving || !playing || rejoining) return;
  if (code === 4002) { backToAccount('Seu personagem entrou em outro lugar.'); return; }
  if (code === 4003) { backToAccount('Você foi expulso do servidor por um administrador.'); return; }
  rejoining = true; retryDelay = 1000; lostAt = Date.now();
  scheduleRetry();
}
// Recarrega a página (o mundo some, o login lembrado continua) e mostra o motivo na tela de conta.
function backToAccount(message: string) {
  leaving = true; rejoining = false; clearTimeout(retryTimer);
  try { sessionStorage.setItem('vale.aviso', message); } catch { }
  location.reload();
}
// Servidor fora do ar: a mesma tela de manutenção do app, por cima do jogo. Ela volta sozinha quando o servidor voltar.
let maintenance = false;
function showMaintenance() {
  leaving = true; rejoining = false; clearTimeout(retryTimer);
  if (maintenance) return;
  maintenance = true;
  const f = Object.assign(document.createElement('iframe'), { className: 'maintenance', title: 'Em manutenção', srcdoc: maintenanceHtml });
  f.dataset.u = location.origin + location.pathname + location.search;
  document.body.append(f);
}
async function giveUp() {
  if (await api.health()) backToAccount('A conexão com o mundo caiu. Entre de novo.');
  else showMaintenance();
}
function scheduleRetry(now = false) {
  clearTimeout(retryTimer);
  retryTimer = window.setTimeout(retry, now ? 0 : retryDelay);
}
async function retry() {
  if (!rejoining || !playing) return;
  if (Date.now() - lostAt > GIVE_UP) { rejoining = false; await giveUp(); return; }
  try {
    await enterWorld(playing);
    rejoining = false; retryDelay = 1000;
    chat.add({ ch: 'system', text: 'Conexão de volta.' }, false);
  } catch (e) {
    const code = (e as { code?: number }).code;
    if (code === 401) { backToAccount('Sua sessão expirou. Entre de novo.'); return; }
    if (code === 404) { backToAccount('Personagem não encontrado.'); return; }
    retryDelay = Math.min(8000, retryDelay * 2);
    scheduleRetry();
  }
}
window.addEventListener('online', () => { if (rejoining) scheduleRetry(true); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && rejoining) scheduleRetry(true); });
// o app Android chama isto quando a internet volta
(window as unknown as { __reconnectNow?: () => void }).__reconnectNow = () => { if (rejoining) scheduleRetry(true); };

// Aviso deixado antes de recarregar (por que voltou para a tela de conta).
let notice = '';
try { notice = sessionStorage.getItem('vale.aviso') ?? ''; sessionStorage.removeItem('vale.aviso'); } catch { }
function goOffline() {
  hideTitle();
  session = new LocalSession(MAP, profile); bindChat(session);
  ready = true; account.hide(); startEl.hidden = false; startHint.textContent = 'Jogando offline: só você neste mundo.';
}
if (!OFFLINE) { startEl.hidden = true; showTitle(); account.start(notice); }
async function switchCharacter() { leaving = true; await (session as NetSession).leave?.(); location.reload(); }
async function signOut() { leaving = true; try { await api.logout(); } catch { } saveSession(null); await (session as NetSession).leave?.(); location.reload(); }
const STATUS: Record<Status, string> = { connecting: 'Conectando…', online: 'Online', reconnecting: 'Reconectando…', offline: 'Desconectado', local: 'Offline' };
let shownStatus: Status | null = null;
function updateStatus() {
  if (account.open) { statusEl.hidden = true; shownStatus = null; return; }
  const st = rejoining ? 'reconnecting' : session.status;
  if (st === shownStatus) return;
  shownStatus = st;
  statusEl.textContent = STATUS[shownStatus]; statusEl.dataset.state = shownStatus;
  statusEl.hidden = shownStatus === 'online';   // só aparece quando há algo a avisar
}

function begin() {
  ensureAudio();
  if (started || !ready) return;
  started = true; startEl.hidden = true;
  try { stage.focus({ preventScroll: true }); } catch { }
}
/* ---------- Menu (Esc), perfil e opções ---------- */
function setSettings(s: Settings) { settings = s; saveSettings(s); setMuted(!s.sound); menu.refresh(); }
// Online o nome é o do personagem; só a aparência muda (e fica salva no servidor). Offline tudo fica no navegador.
function setProfile(p: ProfileRequest) {
  profile = OFFLINE ? p : { name: profile.name, look: p.look };
  if (OFFLINE) saveProfile(p);
  session.setProfile(profile);
}
const menu = new Menu({
  profile: () => profile, saveProfile: setProfile, settings: () => settings, setSettings,
  pvp: () => { const i = session.pvp(), me = session.me(); return i && me ? { ...i, on: me.pvp } : null; },
  setPvp: on => session.setPvp(on),
  closed: () => refocus(),
  get online() { return !OFFLINE; },
  switchCharacter, signOut,
  records: async () => OFFLINE ? null : api.records()
});
const nameTags = new NameTags(document.getElementById('names')!);
// M liga/desliga o som, P mostra o mapa de caminhos dos monstros
function toggleMute() { ensureAudio(); setSettings({ ...settings, sound: !settings.sound }); }
function togglePaths() { setSettings({ ...settings, paths: !settings.paths }); }
const refocus = () => { try { stage.focus({ preventScroll: true }); } catch { } };
// /ignorar nome: esconde as mensagens (e os balões) de alguém, só para você; fica guardado neste navegador.
const ignored = loadIgnored();
function sendChat(req: ChatRequest) {
  const m = /^\/(ignorar|designorar|ignorados)\b\s*(.*)$/i.exec(req.text);
  if (!m) { session.chat(req); return; }
  const cmd = m[1].toLowerCase(), name = m[2].trim().replace(/^"|"$/g, ''), key = name.toLowerCase();
  const say = (text: string) => chat.add({ ch: 'system', text }, false);
  if (cmd === 'ignorados') { say(ignored.size ? `Ignorando: ${[...ignored].join(', ')}` : 'Você não está ignorando ninguém.'); return; }
  if (!name) { say(`Use: /${cmd} nome`); return; }
  if (cmd === 'ignorar') { ignored.add(key); say(`Você não vê mais as mensagens de ${name}. /designorar ${name} desfaz.`); }
  else say(ignored.delete(key) ? `Você voltou a ver as mensagens de ${name}.` : `Você não estava ignorando ${name}.`);
  saveIgnored(ignored);
}
const chat = new ChatBox({ send: sendChat, closed: refocus });
const bindChat = (s: Session) => { s.onChat = m => {
  if (m.name && ignored.has(m.name.toLowerCase())) return;
  const mine = m.from !== undefined && m.from === session.me()?.id; chat.add(m, mine); if (m.ch === 'local' && m.from) nameTags.say(m.from, m.text);
}; };
bindChat(session);
// Esc fecha o chat se ele estiver aberto; senão abre/fecha o menu. Enter numa placa avança o texto.
function toggleMenu() { if (!started) return; if (chat.open) chat.hide(); else if (shop.open) shop.close(); else if (bag.open) bag.close(); else menu.toggle(); }
function openChat() { if (!started || menu.open) return; if (dialog.open) { dialog.update(BUTTON.b); return; } chat.show(); }
function togglePvp() {
  const info = session.pvp(), me = session.me();
  if (!info || !me) return;
  if (info.mode !== 'optional') { chat.add({ ch: 'system', text: info.mode === 'open' ? 'Neste servidor o PvP é sempre ligado.' : 'Neste servidor não há PvP.' }, false); return; }
  session.setPvp(!me.pvp);
}
/* ---------- Inventário (I), atalhos 1 e 2 ---------- */
const floaters = new Floaters(document.getElementById('floaters')!);
const bag = new BagPanel({ inventory: () => session.inventory(), use: s => session.useItem(s), drop: s => session.dropItem(s), equip: (g, s) => session.equip(g, s), closed: refocus });
const shop = new ShopPanel({ inventory: () => session.inventory(), deal: (a, s, item, n) => session.shop(a, s, item, n), closed: refocus });
function toggleBag() { if (!started || menu.open || chat.open) return; bag.toggle(); }
function quickUse(n: 1 | 2 | 3) {
  const inv = session.inventory(); if (!inv) return;
  const id = n === 1 ? 'heart' : n === 2 ? 'mana' : 'bomb', slot = inv.bag.findIndex(s => s?.id === id);
  if (slot < 0) { const me = session.me(); if (me) floaters.add(me.x, me.y, n === 1 ? 'Sem corações' : n === 2 ? 'Sem poções' : 'Sem bombas', 'notice'); return; }
  session.useItem(slot);
}
const hooks = { started: () => started, start: begin, toggleMute, togglePaths, toggleMenu, openChat, togglePvp, toggleBag, quickUse };
const input = new Input(stage, cv, hooks);
bindTouch(input, hooks, () => settings.vibrate);
// Controle de videogame: com um conectado, o controle de toque some e a tela do jogo cresce.
const pads = new Gamepads(input, {
  ...hooks,
  panel: () => shop.open ? document.getElementById('shop') : bag.open ? document.getElementById('bag') : menu.open ? document.getElementById('menu') : null,
  closePanel: toggleMenu,
  connected: name => {
    if (!name) document.body.classList.remove('gamepad');   // o toque volta; ele some de novo quando um botão do controle for apertado
    chat.add({ ch: 'system', text: name ? `Controle conectado: ${name.replace(/\s*\(.*\)\s*$/, '') || 'controle'}.` : 'Controle desconectado.' }, false);
  }
});
startEl.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); begin(); });
stage.addEventListener('pointerdown', e => { ensureAudio(); if (!(e.target as Element).closest(UI_SELECTOR)) refocus(); });
document.getElementById('chatBtn')!.addEventListener('click', () => { begin(); openChat(); });
document.getElementById('bagBtn')!.addEventListener('click', () => { begin(); toggleBag(); });
document.getElementById('menuBtn')!.addEventListener('click', () => { if (!account.open) menu.toggle(); });

// Som e efeitos só do que acontece perto da câmera.
const HEAR = 48;
const nearCam = (x: number, y: number) => x > cam.x - HEAR && x < cam.x + VIEW_W + HEAR && y > cam.y - HEAR && y < cam.y + VIEW_H + HEAR;
function handle(ev: GameEvent) {
  switch (ev.t) {
    case 'sfx': if (nearCam(ev.x, ev.y)) sfx(ev.name); break;
    case 'burst': if (nearCam(ev.x, ev.y)) particles.burst(ev.x, ev.y, ev.palette, ev.n, ev.o); break;
    case 'poof': if (nearCam(ev.x, ev.y)) particles.poof(ev.x, ev.y); break;
    case 'shake': shake = Math.max(shake, ev.n); break;
    case 'dialog': { const offer = ev.shop; dialog.show(ev.pages, ev.title, offer && (() => shop.show(offer))); talking = ev.npc ?? null; break; }
    case 'region': showRegion(ev.name); break;
    case 'gain': floaters.add(ev.x, ev.y, ev.text, ev.text.endsWith('XP') ? 'xp' : 'item'); break;
    case 'glow': addGlow(ev.x, ev.y, ev.r, ev.s); break;
    case 'slide': addSlide(ev.fx, ev.fy, ev.tx, ev.ty); break;
    case 'notice': { const me = session.me(); if (me) floaters.add(me.x, me.y, ev.text, 'notice'); break; }
    case 'levelup': {
      const mine = ev.id === session.me()?.id;
      floaters.add(ev.x, ev.y, mine ? `Nível ${ev.level}!` : `Nv ${ev.level}!`, 'level');
      if (mine) chat.add({ ch: 'system', text: `Você chegou ao nível ${ev.level}! Vida e mana máximas aumentaram.` }, false);
      break;
    }
    case 'zone': chat.add({ ch: 'system', text: ev.safe ? 'Você entrou numa zona segura: sem PvP e sem monstros.' : 'Você saiu da zona segura.' + (session.pvp()?.mode === 'open' || session.me()?.pvp ? ' Cuidado: PvP ativo.' : '') }, false); break;
  }
}
// Alvo da ajuda na mira (sem mouse, jogando pelo toque); recalculado a cada quadro para a marca na tela.
// No celular (tela de toque, sem mouse) e no controle de videogame; teclado e mouse miram sozinhos.
const PHONE = matchMedia('(hover:none) and (pointer:coarse)');
let lock: { x: number; y: number } | null = null;
function updateLock(scene: Scene) {
  const me = session.me();
  lock = me && settings.aimAssist && ((PHONE.matches && input.usingTouch) || input.usingPad) && !input.mouse.active && pads.aim === null && me.state !== 'dead' ? assistTarget(me, scene.enemies, scene.players, input.moving()) : null;
}
function aim() {
  const me = session.me();
  if (!me) return null;
  if (input.mouse.active) return Math.atan2(input.mouse.y + cam.y - (me.y - 6), input.mouse.x + cam.x - me.x);
  if (pads.aim !== null) return pads.aim;   // analógico direito do controle
  // ajuda na mira: só no passo em que ataca (assim andar continua virando o personagem normalmente)
  const attacking = input.wants('a') || input.wants('c') || (!!me.carry && input.wants('b'));
  return lock && attacking ? Math.atan2(lock.y - (me.y - 6), lock.x - me.x) : null;
}
function update() {
  tick++;
  if (shake > 0) shake--;
  let inp = emptyInput();
  pads.poll();
  if (!started || menu.open || chat.open || bag.open || shop.open) input.clearTaps();   // com o menu aberto o personagem fica parado, mas o mundo continua
  else if (dialog.open) dialog.update(input.sample(null).tap);   // lendo: o personagem fica parado, mas o mundo continua
  else inp = input.sample(aim());
  for (const ev of session.step(inp)) handle(ev);
  particles.update();
  menu.tick();
  const me = session.me();
  follow(cam, me ?? MAP.spawn, session.map);
  updateStatus();
}

// Quem está no colo é desenhado em cima de quem carrega, na posição que a tela mostra de quem carrega
// (para quem carrega, a dele é a prevista; senão a pessoa ficaria um pouco atrás).
function attachHeld(scene: ReturnType<Session['scene']>) {
  const byId = new Map(scene.players.map(p => [p.id, p]));
  scene.players = scene.players.map(p => {
    const c = p.state === 'held' && p.heldBy ? byId.get(p.heldBy) : undefined;
    return c ? { ...p, x: c.x, y: c.y + 1, z: c.z + 16 } : p;
  });
}

/* ---------- Laço: simulação em passo fixo de 60 Hz, desenho a cada quadro ---------- */
const STEP = 1000 / 60;
let last = performance.now(), acc = 0;
follow(cam, MAP.spawn, session.map);
function frame(now: number) {
  acc += Math.min(100, now - last); last = now;
  while (acc >= STEP) { update(); acc -= STEP; }
  const reticle = input.mouse.active && started && !dialog.open && !menu.open ? input.mouse : null;
  const scene = session.scene(settings.paths);
  attachHeld(scene);
  updateLock(scene);
  updateClock(scene.day, scene.dark); updateRaid(scene.invasion);
  if (titleShown() && ready && session.status === 'online' && session.me()) hideTitle();   // o mundo chegou: a cena de título sai
  const me = session.me();
  updatePad(me, session.inventory(), settings.padSize);
  updateBoss(me ? scene.enemies.find(e => e.type === 'king' && Math.hypot(e.x - me.x, e.y - me.y) < 200) : undefined);
  updateFishBar(session.me());
  if (!dialog.open) talking = null;
  render(ctx, scene, { me: session.me(), cam, particles, lock, showPaths: settings.paths, reticle, shake, tick, talking });
  nameTags.update(scene, cam, settings.names, settings.bubbles);
  floaters.update(cam);
  bag.render(); shop.render();
  updateHud(session.status === 'connecting' ? undefined : session.me(), session.inventory());
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
