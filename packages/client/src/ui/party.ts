import { INVITE_TTL, type OnlineEntry, type PartyMsg, type PartyRequest } from '@vale/shared';
import type { PartyState } from '../session/types';

export interface PartyHooks {
  party(): PartyState | null;
  meId(): string;
  send(req: PartyRequest): void;
  online: boolean;   // offline não tem grupo
  active(): boolean; // a aba Grupo está à vista
}
const WHO_EVERY = 3000;   // ms entre atualizações da lista de quem está online (só com a aba aberta)

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}) => Object.assign(document.createElement(tag), props);

/* Grupo: a aba "Grupo" do menu (seu grupo e quem está online, com Convidar) e o aviso de convite por cima do jogo. */
export class PartyPanel {
  private list = document.getElementById('partyList')!;
  private title = document.getElementById('partyTitle')!;
  private leaveBtn = document.getElementById('partyLeave') as HTMLButtonElement;
  private onlineEl = document.getElementById('onlineList')!;
  private boxes = [document.getElementById('inviteToast')!, document.getElementById('partyInvite')!];
  private invite: { from: string; until: number } | null = null;
  private who: OnlineEntry[] | null = null;
  private whoAt = 0; private partyKey = '?'; private whoKey = '?'; private inviteKey = '?';

  constructor(private hooks: PartyHooks) {
    this.leaveBtn.addEventListener('click', () => hooks.send({ action: 'leave' }));
    for (const b of this.boxes) {
      b.querySelector('[data-act=accept]')!.addEventListener('click', () => this.answer(true));
      b.querySelector('[data-act=decline]')!.addEventListener('click', () => this.answer(false));
    }
  }
  // Mensagem do servidor: convite (ou o fim dele) e a lista de quem está online.
  receive(m: PartyMsg) {
    if ('invite' in m) this.invite = m.invite && { from: m.invite.from, until: Date.now() + Math.min(m.invite.ttl, INVITE_TTL) };
    else this.who = m.who;
  }
  answer(yes: boolean) {
    if (!this.invite) return;
    this.hooks.send({ action: yes ? 'accept' : 'decline' }); this.invite = null;
  }

  render(menuOpen: boolean) {
    if (this.invite && this.invite.until <= Date.now()) this.invite = null;
    this.renderInvite(menuOpen);
    if (!this.hooks.active()) return;
    if (this.hooks.online && Date.now() - this.whoAt > WHO_EVERY) { this.whoAt = Date.now(); this.hooks.send({ action: 'who' }); }
    this.renderParty();
    this.renderOnline();
  }
  private renderInvite(menuOpen: boolean) {
    const key = this.invite ? `${this.invite.from}|${menuOpen}` : '';
    if (key === this.inviteKey) return;
    this.inviteKey = key;
    const [toast, inTab] = this.boxes;
    for (const b of this.boxes) { b.hidden = !this.invite; if (this.invite) b.querySelector('span')!.textContent = `${this.invite.from} te convidou para o grupo.`; }
    toast.hidden = !this.invite || menuOpen;   // com o menu aberto, o convite aparece dentro da aba Grupo
    inTab.hidden = !this.invite;
  }
  private renderParty() {
    const g = this.hooks.party(), me = this.hooks.meId();
    const key = this.hooks.online ? JSON.stringify(g) : 'off';
    if (key === this.partyKey) return;
    this.partyKey = key;
    this.leaveBtn.hidden = !g;
    if (!this.hooks.online) { this.title.textContent = 'Grupo'; this.list.replaceChildren(el('li', { className: 'hint', textContent: 'Grupo só existe jogando online.' })); return; }
    if (!g) { this.title.textContent = 'Seu grupo'; this.list.replaceChildren(el('li', { className: 'hint', textContent: 'Você está sem grupo. Convide alguém da lista abaixo.' })); return; }
    this.title.textContent = `Seu grupo (${g.members.length})`;
    this.list.replaceChildren(...g.members.map(m => {
      const li = el('li');
      li.append(el('b', { textContent: (m.id === g.leader ? '★ ' : '') + m.name + (m.id === me ? ' (você)' : '') }), el('span', { textContent: ` Nv ${m.level} · ${m.dead ? 'caído!' : m.where}` }));
      if (g.leader === me && m.id !== me) {
        const kick = el('button', { type: 'button', className: 'link', textContent: 'Tirar' });
        kick.addEventListener('click', () => this.hooks.send({ action: 'kick', id: m.id }));
        li.append(kick);
      }
      return li;
    }));
  }
  private renderOnline() {
    const g = this.hooks.party(), canInvite = !g || g.leader === this.hooks.meId();
    const key = JSON.stringify([this.who, canInvite, this.hooks.online]);
    if (key === this.whoKey) return;
    this.whoKey = key;
    if (!this.hooks.online) { this.onlineEl.replaceChildren(); return; }
    if (!this.who) { this.onlineEl.replaceChildren(el('li', { className: 'hint', textContent: 'Carregando…' })); return; }
    if (!this.who.length) { this.onlineEl.replaceChildren(el('li', { className: 'hint', textContent: 'Só você está online agora.' })); return; }
    this.onlineEl.replaceChildren(...this.who.map(o => {
      const li = el('li');
      li.append(el('b', { textContent: o.name }), el('span', { textContent: ` Nv ${o.level} · ${o.where}` }));
      if (o.mine) li.append(el('em', { textContent: 'no seu grupo' }));
      else if (o.party) li.append(el('em', { textContent: 'em grupo' }));
      else if (canInvite) {
        const b = el('button', { type: 'button', className: 'link', textContent: 'Convidar' });
        b.addEventListener('click', () => { this.hooks.send({ action: 'invite', name: o.name }); b.disabled = true; b.textContent = 'Convidado'; });
        li.append(b);
      }
      return li;
    }));
  }
}
