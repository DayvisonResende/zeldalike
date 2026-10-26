import { CHAR_NAME_MIN, NAME_MAX, USERNAME_MAX, characterNameError, passwordError, usernameError, type AccountInfo, type CharacterSummary, type Look } from '@vale/shared';
import { ApiError, saveSession, type Api } from '../net/api';
import { buildSwatches, drawPreview, markSwatches } from './swatches';

type View = 'login' | 'register' | 'select' | 'create' | 'delete' | 'busy';
export interface AccountHooks { play(c: CharacterSummary): Promise<void>; offline(): void }

/* Antes de jogar: entrar ou criar conta, depois escolher (ou criar) o personagem. */
export class AccountScreen {
  private el = document.getElementById('account')!;
  private info: AccountInfo | null = null;
  private draft: { name: string; look: Look } = { name: '', look: { cloak: 0, hair: 0 } };
  private toDelete: CharacterSummary | null = null;

  constructor(private api: Api, private hooks: AccountHooks) {
    const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
    $<HTMLInputElement>('loginUser').maxLength = USERNAME_MAX; $<HTMLInputElement>('regUser').maxLength = USERNAME_MAX;
    $<HTMLInputElement>('newName').maxLength = NAME_MAX;
    $<HTMLFormElement>('loginForm').addEventListener('submit', e => { e.preventDefault(); this.login(); });
    $<HTMLFormElement>('regForm').addEventListener('submit', e => { e.preventDefault(); this.register(); });
    $<HTMLFormElement>('createForm').addEventListener('submit', e => { e.preventDefault(); this.create(); });
    $<HTMLFormElement>('deleteForm').addEventListener('submit', e => { e.preventDefault(); this.remove(); });
    this.el.querySelectorAll<HTMLButtonElement>('[data-go]').forEach(b => b.addEventListener('click', () => this.show(b.dataset.go as View)));
    $('logoutBtn').addEventListener('click', () => this.logout());
    $('offlineBtn').addEventListener('click', () => this.hooks.offline());
    for (const [id, key] of [['newCloaks', 'cloak'], ['newHairs', 'hair']] as const)
      buildSwatches($(id), key, i => { this.draft.look[key] = i; this.refreshCreate(); });
    $<HTMLInputElement>('newName').addEventListener('input', e => { this.draft.name = (e.target as HTMLInputElement).value; });
  }

  get open() { return !this.el.hidden; }
  hide() { this.el.hidden = true; }
  // Começa pela seleção se houver login lembrado; senão, pela tela de entrar.
  async start(message = '') {
    this.el.hidden = false;
    if (this.api.token) { this.show('busy'); try { await this.loadAccount(); return; } catch (e) { if (!(e instanceof ApiError) || e.status !== 401) { this.unreachable(e); return; } this.forget(); } }
    this.show('login'); this.error('login', message);
  }

  private show(v: View) {
    this.el.querySelectorAll<HTMLElement>('[data-view]').forEach(s => { s.hidden = s.dataset.view !== v; });
    this.el.querySelectorAll<HTMLElement>('.err').forEach(e => { e.textContent = ''; });
    if (v === 'create') { this.draft = { name: '', look: { cloak: 0, hair: 0 } }; (document.getElementById('newName') as HTMLInputElement).value = ''; this.refreshCreate(); }
    const first = this.el.querySelector<HTMLElement>(`[data-view="${v}"] input, [data-view="${v}"] .play`);
    first?.focus();
  }
  private error(v: View, msg: string) { const e = this.el.querySelector(`[data-view="${v}"] .err`); if (e) e.textContent = msg; }
  private busy<T>(v: View, f: () => Promise<T>) {
    const btns = this.el.querySelectorAll<HTMLButtonElement>(`[data-view="${v}"] button`);
    btns.forEach(b => { b.disabled = true; });
    return f().catch(e => { this.error(v, e instanceof Error ? e.message : String(e)); }).finally(() => btns.forEach(b => { b.disabled = false; }));
  }
  private unreachable(e: unknown) {
    this.show('login');
    this.error('login', (e instanceof Error ? e.message : '') + ' Você pode jogar offline enquanto isso.');
    document.getElementById('offlineBtn')!.hidden = false;
  }
  private forget() { this.api.token = null; saveSession(null); }

  /* ---------- Entrar e criar conta ---------- */
  private login() {
    const u = (document.getElementById('loginUser') as HTMLInputElement).value.trim(), p = (document.getElementById('loginPass') as HTMLInputElement).value;
    if (!u || !p) { this.error('login', 'Informe usuário e senha.'); return; }
    this.busy('login', async () => { const r = await this.api.login(u, p); this.signedIn(r.token, r.username); await this.loadAccount(); });
  }
  private register() {
    const u = (document.getElementById('regUser') as HTMLInputElement).value.trim(), p = (document.getElementById('regPass') as HTMLInputElement).value, p2 = (document.getElementById('regPass2') as HTMLInputElement).value;
    const err = usernameError(u) ?? passwordError(p) ?? (p !== p2 ? 'As senhas não são iguais.' : null);
    if (err) { this.error('register', err); return; }
    this.busy('register', async () => { const r = await this.api.register(u, p); this.signedIn(r.token, r.username); await this.loadAccount(); });
  }
  private signedIn(token: string, username: string) { this.api.token = token; saveSession({ token, username }); }
  private async logout() {
    try { await this.api.logout(); } catch { }
    this.forget(); this.info = null; this.show('login');
  }

  /* ---------- Escolher personagem ---------- */
  private async loadAccount() {
    this.info = await this.api.me();
    this.renderList();
    this.show('select');
  }
  private renderList() {
    const info = this.info!, list = document.getElementById('charList')!;
    document.getElementById('hello')!.textContent = `Olá, ${info.username}`;
    list.replaceChildren();
    for (const c of info.characters) {
      const li = document.createElement('li'); li.className = 'char';
      const cv = document.createElement('canvas'); cv.width = 18; cv.height = 18; cv.setAttribute('aria-hidden', 'true'); drawPreview(cv, c.look);
      const name = Object.assign(document.createElement('span'), { className: 'cname', textContent: `${c.name} · Nv ${c.level}` });
      const play = Object.assign(document.createElement('button'), { type: 'button', className: 'primary play', textContent: 'Jogar' });
      play.setAttribute('aria-label', `Jogar com ${c.name}`);
      play.addEventListener('click', () => this.busy('select', () => this.hooks.play(c)));
      const del = Object.assign(document.createElement('button'), { type: 'button', className: 'del', textContent: '✕', title: `Apagar ${c.name}` });
      del.setAttribute('aria-label', `Apagar ${c.name}`);
      del.addEventListener('click', () => this.askDelete(c));
      li.append(cv, name, play, del); list.append(li);
    }
    const free = info.maxCharacters - info.characters.length;
    const add = document.getElementById('newCharBtn') as HTMLButtonElement;
    add.hidden = free <= 0;
    document.getElementById('slots')!.textContent = `${info.characters.length} de ${info.maxCharacters} personagens`;
  }
  // Volta para a seleção (por exemplo, quando a entrada no mundo falha).
  backToSelect(message: string) { this.el.hidden = false; this.show('select'); this.error('select', message); }

  /* ---------- Criar e apagar ---------- */
  private refreshCreate() { markSwatches(this.el, this.draft.look); drawPreview(document.getElementById('newPreview') as HTMLCanvasElement, this.draft.look); }
  private create() {
    const name = this.draft.name.trim(), err = characterNameError(name);
    if (err) { this.error('create', err); return; }
    this.busy('create', async () => { await this.api.createCharacter(name, this.draft.look); await this.loadAccount(); });
  }
  private askDelete(c: CharacterSummary) {
    this.toDelete = c;
    document.getElementById('delName')!.textContent = c.name;
    (document.getElementById('delConfirm') as HTMLInputElement).value = '';
    this.show('delete');
  }
  private remove() {
    const c = this.toDelete!, typed = (document.getElementById('delConfirm') as HTMLInputElement).value.trim();
    if (typed.toLowerCase() !== c.name.toLowerCase()) { this.error('delete', 'Digite o nome exatamente como está para confirmar.'); return; }
    this.busy('delete', async () => { await this.api.deleteCharacter(c.id); await this.loadAccount(); });
  }
}
export const NAME_RULES = `${CHAR_NAME_MIN} a ${NAME_MAX} caracteres: letras, números, espaço, hífen e _.`;
