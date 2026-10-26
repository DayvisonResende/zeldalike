import { BUTTON, VIEW_H, VIEW_W, emptyInput, type GameEvent, type MapData, type ProfileRequest } from '@vale/shared';
import vale from '../../../content/maps/vale.json';
import { ensureAudio, setMuted, sfx } from './audio';
import { follow, type Camera } from './camera';
import { Input, UI_SELECTOR, bindTouch } from './input';
import { Particles } from './render/particles';
import { render } from './render/renderer';
import { LocalSession } from './session/local';
import { NetSession } from './session/net';
import type { Session, Status } from './session/types';
import { Api, loadSession, saveSession } from './net/api';
import { AccountScreen } from './ui/account';
import { BagPanel } from './ui/bag';
import { ChatBox } from './ui/chat';
import { Floaters } from './ui/floaters';
import { Dialog } from './ui/dialog';
import { showRegion, updateHud } from './ui/hud';
import { Menu } from './ui/menu';
import { NameTags } from './ui/nametags';
import { loadProfile, loadSettings, saveProfile, saveSettings, type Settings } from './ui/settings';
import './style.css';

const MAP = vale as MapData;
const cv = document.getElementById('screen') as HTMLCanvasElement;
cv.width = VIEW_W; cv.height = VIEW_H;
const ctx = cv.getContext('2d')!;
ctx.imageSmoothingEnabled = false;

const cam: Camera = { x: 0, y: 0 };
const particles = new Particles();
const dialog = new Dialog();
let started = false, shake = 0, tick = 0;
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
const account = new AccountScreen(api, {
  async play(c) {
    const net = new NetSession(MAP);
    net.onWelcome = motd => { if (motd) startHint.textContent = motd; };
    try { await net.connect(SERVER, { token: api.token!, characterId: c.id }); }
    catch (e) { throw new Error(e instanceof Error && e.message ? e.message : 'Não foi possível entrar no mundo.'); }
    session = net; bindChat(net);
    profile = { name: c.name, look: { ...c.look } };
    ready = true; account.hide(); begin();
  },
  offline: () => goOffline()
});
function goOffline() {
  session = new LocalSession(MAP, profile); bindChat(session);
  ready = true; account.hide(); startEl.hidden = false; startHint.textContent = 'Jogando offline: só você neste mundo.';
}
if (!OFFLINE) { startEl.hidden = true; account.start(); }
async function switchCharacter() { await (session as NetSession).leave?.(); location.reload(); }
async function signOut() { try { await api.logout(); } catch { } saveSession(null); await (session as NetSession).leave?.(); location.reload(); }
const STATUS: Record<Status, string> = { connecting: 'Conectando…', online: 'Online', reconnecting: 'Reconectando…', offline: 'Desconectado', local: 'Offline' };
let shownStatus: Status | null = null;
function updateStatus() {
  if (account.open) { statusEl.hidden = true; shownStatus = null; return; }
  if (session.status === shownStatus) return;
  shownStatus = session.status;
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
  switchCharacter, signOut
});
const nameTags = new NameTags(document.getElementById('names')!);
// M liga/desliga o som, P mostra o mapa de caminhos dos monstros
function toggleMute() { ensureAudio(); setSettings({ ...settings, sound: !settings.sound }); }
function togglePaths() { setSettings({ ...settings, paths: !settings.paths }); }
const refocus = () => { try { stage.focus({ preventScroll: true }); } catch { } };
const chat = new ChatBox({ send: req => session.chat(req), closed: refocus });
const bindChat = (s: Session) => { s.onChat = m => { const mine = m.from !== undefined && m.from === session.me()?.id; chat.add(m, mine); if (m.ch === 'local' && m.from) nameTags.say(m.from, m.text); }; };
bindChat(session);
// Esc fecha o chat se ele estiver aberto; senão abre/fecha o menu. Enter numa placa avança o texto.
function toggleMenu() { if (!started) return; if (chat.open) chat.hide(); else if (bag.open) bag.close(); else menu.toggle(); }
function openChat() { if (!started || menu.open) return; if (dialog.open) { dialog.update(BUTTON.b); return; } chat.show(); }
function togglePvp() {
  const info = session.pvp(), me = session.me();
  if (!info || !me) return;
  if (info.mode !== 'optional') { chat.add({ ch: 'system', text: info.mode === 'open' ? 'Neste servidor o PvP é sempre ligado.' : 'Neste servidor não há PvP.' }, false); return; }
  session.setPvp(!me.pvp);
}
/* ---------- Inventário (I), atalhos 1 e 2 ---------- */
const floaters = new Floaters(document.getElementById('floaters')!);
const bag = new BagPanel({ inventory: () => session.inventory(), use: s => session.useItem(s), drop: s => session.dropItem(s), closed: refocus });
function toggleBag() { if (!started || menu.open || chat.open) return; bag.toggle(); }
function quickUse(n: 1 | 2) {
  const inv = session.inventory(); if (!inv) return;
  const id = n === 1 ? 'heart' : 'mana', slot = inv.bag.findIndex(s => s?.id === id);
  if (slot < 0) { const me = session.me(); if (me) floaters.add(me.x, me.y, n === 1 ? 'Sem corações' : 'Sem poções', 'notice'); return; }
  session.useItem(slot);
}
const hooks = { started: () => started, start: begin, toggleMute, togglePaths, toggleMenu, openChat, togglePvp, toggleBag, quickUse };
const input = new Input(stage, cv, hooks);
bindTouch(input, hooks);
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
    case 'dialog': dialog.show(ev.pages); break;
    case 'region': showRegion(ev.name); break;
    case 'gain': floaters.add(ev.x, ev.y, ev.text, ev.text.endsWith('XP') ? 'xp' : 'item'); break;
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
function aim() {
  const me = session.me();
  if (!input.mouse.active || !me) return null;
  return Math.atan2(input.mouse.y + cam.y - (me.y - 6), input.mouse.x + cam.x - me.x);
}
function update() {
  tick++;
  if (shake > 0) shake--;
  let inp = emptyInput();
  if (!started || menu.open || chat.open || bag.open) input.clearTaps();   // com o menu aberto o personagem fica parado, mas o mundo continua
  else if (dialog.open) dialog.update(input.sample(null).tap);   // lendo: o personagem fica parado, mas o mundo continua
  else inp = input.sample(aim());
  for (const ev of session.step(inp)) handle(ev);
  particles.update();
  menu.tick();
  const me = session.me();
  follow(cam, me ?? MAP.spawn, session.map);
  updateStatus();
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
  render(ctx, scene, { me: session.me(), cam, particles, showPaths: settings.paths, reticle, shake, tick });
  nameTags.update(scene, cam, settings.names, settings.bubbles);
  floaters.update(cam);
  bag.render();
  updateHud(session.status === 'connecting' ? undefined : session.me(), session.inventory());
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
