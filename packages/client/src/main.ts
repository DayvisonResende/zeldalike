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
import { ChatBox } from './ui/chat';
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
let session: Session;
if (params.has('offline')) session = new LocalSession(MAP, profile);
else {
  const net = new NetSession(MAP);
  session = net;
  net.onWelcome = motd => { if (motd) startHint.textContent = motd; };
  net.connect(SERVER, profile).catch(err => {
    console.warn('[vale] servidor indisponível, jogando offline:', err);
    session = new LocalSession(MAP, profile);
    bindChat(session);
    startHint.textContent = 'Servidor fora do ar — jogando offline';
  });
}
const STATUS: Record<Status, string> = { connecting: 'Conectando…', online: 'Online', reconnecting: 'Reconectando…', offline: 'Desconectado', local: 'Offline' };
let shownStatus: Status | null = null;
function updateStatus() {
  if (session.status === shownStatus) return;
  shownStatus = session.status;
  statusEl.textContent = STATUS[shownStatus]; statusEl.dataset.state = shownStatus;
  statusEl.hidden = shownStatus === 'online';   // só aparece quando há algo a avisar
}

function begin() {
  ensureAudio();
  if (started) return;
  started = true; startEl.hidden = true;
  try { stage.focus({ preventScroll: true }); } catch { }
}
/* ---------- Menu (Esc), perfil e opções ---------- */
function setSettings(s: Settings) { settings = s; saveSettings(s); setMuted(!s.sound); menu.refresh(); }
function setProfile(p: ProfileRequest) { profile = p; saveProfile(p); session.setProfile(p); }
const menu = new Menu({
  profile: () => profile, saveProfile: setProfile, settings: () => settings, setSettings,
  pvp: () => { const i = session.pvp(), me = session.me(); return i && me ? { ...i, on: me.pvp } : null; },
  setPvp: on => session.setPvp(on),
  closed: () => refocus()
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
function toggleMenu() { if (chat.open) chat.hide(); else menu.toggle(); }
function openChat() { if (menu.open) return; if (dialog.open) { dialog.update(BUTTON.b); return; } chat.show(); }
function togglePvp() {
  const info = session.pvp(), me = session.me();
  if (!info || !me) return;
  if (info.mode !== 'optional') { chat.add({ ch: 'system', text: info.mode === 'open' ? 'Neste servidor o PvP é sempre ligado.' : 'Neste servidor não há PvP.' }, false); return; }
  session.setPvp(!me.pvp);
}
const hooks = { started: () => started, start: begin, toggleMute, togglePaths, toggleMenu, openChat, togglePvp };
const input = new Input(stage, cv, hooks);
bindTouch(input, hooks);
startEl.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); begin(); });
stage.addEventListener('pointerdown', e => { ensureAudio(); if (!(e.target as Element).closest(UI_SELECTOR)) refocus(); });
document.getElementById('chatBtn')!.addEventListener('click', () => { begin(); openChat(); });
document.getElementById('menuBtn')!.addEventListener('click', () => menu.toggle());

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
  if (!started || menu.open || chat.open) input.clearTaps();   // com o menu aberto o personagem fica parado, mas o mundo continua
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
  updateHud(session.status === 'connecting' ? undefined : session.me());
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
