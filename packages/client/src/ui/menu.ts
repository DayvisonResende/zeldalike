import { ITEMS, NAME_MAX, cleanName, type ItemId, type ProfileRequest, type PvpInfo } from '@vale/shared';
import { buildSwatches, drawPreview, markSwatches } from './swatches';
import type { NameMode, PadSize, Settings } from './settings';

export interface MenuHooks {
  profile(): ProfileRequest;
  saveProfile(p: ProfileRequest): void;
  settings(): Settings;
  setSettings(s: Settings): void;
  pvp(): (PvpInfo & { on: boolean }) | null;
  setPvp(on: boolean): void;
  closed(): void;
  online: boolean;                 // online o nome é o do personagem (fixo)
  switchCharacter(): void;
  signOut(): void;
  records(): Promise<{ item: string; size: number; character: string }[] | null>;
}
type Tab = 'char' | 'opts' | 'keys' | 'records';

// Menu sobre a tela do jogo (Esc). O mundo continua rodando enquanto ele está aberto.
export class Menu {
  private el = document.getElementById('menu')!;
  private nameInput = document.getElementById('nameInput') as HTMLInputElement;
  private preview = document.getElementById('preview') as HTMLCanvasElement;
  private saved = document.getElementById('charSaved')!;
  private draft: ProfileRequest = { name: '', look: { cloak: 0, hair: 0 } };
  private dir = 0; private spin = 0; private savedTimer = 0;
  private current: Tab = 'char';   // reabre na última aba usada
  private pvpBox = document.getElementById('optPvp') as HTMLInputElement;
  private pvpHint = document.getElementById('pvpHint')!;

  constructor(private hooks: MenuHooks) {
    this.nameInput.maxLength = NAME_MAX;
    for (const [id, key] of [['cloaks', 'cloak'], ['hairs', 'hair']] as const)
      buildSwatches(document.getElementById(id)!, key, i => { this.draft.look[key] = i; this.marks(); this.dirty(); });
    this.el.querySelectorAll<HTMLButtonElement>('[role=tab]').forEach(b => b.addEventListener('click', () => this.tab(b.dataset.tab as Tab)));
    this.el.querySelector('.tabs')!.addEventListener('keydown', e => {   // setas trocam de aba
      const k = (e as KeyboardEvent).key; if (k !== 'ArrowLeft' && k !== 'ArrowRight') return;
      const tabs = [...this.el.querySelectorAll<HTMLButtonElement>('[role=tab]')], i = tabs.findIndex(t => t.getAttribute('aria-selected') === 'true');
      const next = tabs[(i + (k === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]; this.tab(next.dataset.tab as Tab); next.focus();
    });
    this.nameInput.addEventListener('input', () => { this.draft.name = this.nameInput.value; this.dirty(); });
    this.nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') this.save(); });
    document.getElementById('saveChar')!.addEventListener('click', () => this.save());
    document.getElementById('closeMenu')!.addEventListener('click', () => this.close());
    document.getElementById('switchChar')!.addEventListener('click', () => this.hooks.switchCharacter());
    document.getElementById('signOut')!.addEventListener('click', () => this.hooks.signOut());
    this.el.querySelectorAll<HTMLInputElement>('input[name=names]').forEach(r => r.addEventListener('change', () => this.set({ names: r.value as NameMode })));
    this.pvpBox.addEventListener('change', () => this.hooks.setPvp(this.pvpBox.checked));
    (document.getElementById('optBubbles') as HTMLInputElement).addEventListener('change', e => this.set({ bubbles: (e.target as HTMLInputElement).checked }));
    (document.getElementById('optSound') as HTMLInputElement).addEventListener('change', e => this.set({ sound: (e.target as HTMLInputElement).checked }));
    (document.getElementById('optPaths') as HTMLInputElement).addEventListener('change', e => this.set({ paths: (e.target as HTMLInputElement).checked }));
    (document.getElementById('optMinimap') as HTMLInputElement).addEventListener('change', e => this.set({ minimap: (e.target as HTMLInputElement).checked }));
    (document.getElementById('optAssist') as HTMLInputElement).addEventListener('change', e => this.set({ aimAssist: (e.target as HTMLInputElement).checked }));
    (document.getElementById('optVibrate') as HTMLInputElement).addEventListener('change', e => this.set({ vibrate: (e.target as HTMLInputElement).checked }));
    this.el.querySelectorAll<HTMLInputElement>('input[name=padSize]').forEach(r => r.addEventListener('change', () => this.set({ padSize: r.value as PadSize })));
    // clicar fora do cartão fecha
    this.el.addEventListener('pointerdown', e => { if (e.target === this.el) this.close(); });
  }

  get open() { return !this.el.hidden; }
  toggle() { if (this.open) this.close(); else this.show(); }
  show() {
    const p = this.hooks.profile();
    this.draft = { name: p.name, look: { ...p.look } };
    this.nameInput.value = p.name;
    this.nameInput.readOnly = this.hooks.online;
    this.nameInput.title = this.hooks.online ? 'O nome é escolhido ao criar o personagem.' : '';
    this.el.querySelectorAll<HTMLElement>('.online-only').forEach(e => { e.hidden = !this.hooks.online; });
    this.saved.textContent = '';
    this.refresh();
    this.el.hidden = false;
    this.tab(this.current, true);
  }
  close() { if (!this.open) return; this.el.hidden = true; this.hooks.closed(); }

  // Reflete as opções atuais (elas também mudam pelas teclas M e P).
  refresh() {
    const s = this.hooks.settings();
    this.el.querySelectorAll<HTMLInputElement>('input[name=names]').forEach(r => { r.checked = r.value === s.names; });
    (document.getElementById('optBubbles') as HTMLInputElement).checked = s.bubbles;
    (document.getElementById('optSound') as HTMLInputElement).checked = s.sound;
    (document.getElementById('optPaths') as HTMLInputElement).checked = s.paths;
    (document.getElementById('optVibrate') as HTMLInputElement).checked = s.vibrate;
    (document.getElementById('optAssist') as HTMLInputElement).checked = s.aimAssist;
    (document.getElementById('optMinimap') as HTMLInputElement).checked = s.minimap;
    this.el.querySelectorAll<HTMLInputElement>('input[name=padSize]').forEach(r => { r.checked = r.value === s.padSize; });
    this.marks();
  }
  // Gira a prévia do personagem enquanto o menu está aberto.
  tick() {
    if (!this.open) return;
    this.pvpStatus();
    if (++this.spin % 50 === 0) this.dir = (this.dir + 1) % 4;
    const order = [0, 3, 1, 2] as const;   // de frente, direita, de costas, esquerda
    drawPreview(this.preview, this.draft.look, order[this.dir], (this.spin >> 3) % 3);
  }

  // Estado do PvP: muda com o tempo (trava) e com as respostas do servidor.
  private pvpStatus() {
    const s = this.hooks.pvp(), box = this.pvpBox;
    let hint: string;
    if (!s) { box.disabled = true; hint = 'Conectando…'; }
    else if (s.mode === 'off') { box.disabled = true; box.checked = false; hint = 'Este servidor não tem PvP.'; }
    else if (s.mode === 'open') { box.disabled = true; box.checked = true; hint = 'Neste servidor o PvP é sempre ligado, menos nas zonas seguras.'; }
    else {
      box.disabled = false; box.checked = s.on;
      hint = !s.on ? 'Desligado: ninguém pode te atacar.'
        : s.lock > 0 ? `Ligado. Você pode desligar em ${s.lock >= 60 ? `${Math.floor(s.lock / 60)}min ${String(s.lock % 60).padStart(2, '0')}s` : `${s.lock}s`}.`
        : 'Ligado: quem também estiver com PvP pode te atacar fora das zonas seguras.';
    }
    if (this.pvpHint.textContent !== hint) this.pvpHint.textContent = hint;
  }
  private tab(t: Tab, focus = false) {
    this.current = t;
    if (t === 'records') this.loadRecords();
    this.el.querySelectorAll<HTMLButtonElement>('[role=tab]').forEach(b => { const on = b.dataset.tab === t; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
    this.el.querySelectorAll<HTMLElement>('[role=tabpanel]').forEach(p => { p.hidden = p.dataset.panel !== t; });
    if (focus) (t === 'char' && !this.nameInput.readOnly ? this.nameInput : this.el.querySelector<HTMLElement>('[aria-selected=true]'))?.focus();
  }
  private async loadRecords() {
    const list = document.getElementById('recordList')!;
    list.replaceChildren(Object.assign(document.createElement('li'), { textContent: 'Carregando…' }));
    const recs = await this.hooks.records().catch(() => null);
    if (!recs) { list.replaceChildren(Object.assign(document.createElement('li'), { textContent: 'Os recordes só existem jogando online.' })); return; }
    if (!recs.length) { list.replaceChildren(Object.assign(document.createElement('li'), { textContent: 'Ninguém pescou nada ainda. Seja o primeiro!' })); return; }
    list.replaceChildren(...recs.map(r => {
      const li = document.createElement('li'), name = ITEMS[r.item as ItemId]?.name ?? r.item;
      li.append(Object.assign(document.createElement('b'), { textContent: `${name}: ${r.size} cm` }), document.createTextNode(` — ${r.character}`));
      return li;
    }));
  }
  private marks() { markSwatches(this.el, this.draft.look); }
  private dirty() { this.saved.textContent = ''; }
  private save() {
    const p = { name: cleanName(this.draft.name), look: { ...this.draft.look } };
    this.nameInput.value = p.name; this.draft.name = p.name;
    this.hooks.saveProfile(p);
    this.saved.textContent = 'Salvo!';
    clearTimeout(this.savedTimer); this.savedTimer = window.setTimeout(() => { this.saved.textContent = ''; }, 2000);
  }
  private set(patch: Partial<Settings>) { this.hooks.setSettings({ ...this.hooks.settings(), ...patch }); }
}
