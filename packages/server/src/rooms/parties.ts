import { INVITE_TTL } from '@vale/shared';

// Grupos e convites, pelo id da sessão de cada jogador. Só as regras: quem avisa quem é o WorldRoom.
export interface Party { id: string; leader: string; members: string[] }
export type InviteResult = 'ok' | 'self' | 'already' | 'full' | 'notLeader';
export type JoinResult = { party: Party; from: string } | { error: 'none' | 'gone' | 'full' | 'already' };
export interface LeaveResult { party: Party; leader: string | null; dissolved: string[] }   // leader: novo líder (se mudou); dissolved: quem ficou sem grupo

export class Parties {
  private byMember = new Map<string, Party>();
  private invites = new Map<string, { from: string; until: number }>();   // convidado → quem convidou
  private seq = 0;

  of(id: string) { return this.byMember.get(id) ?? null; }
  invitedBy(id: string, now = Date.now()) { const i = this.invites.get(id); return i && i.until > now ? i.from : null; }

  // Convidar: quem lidera, ou qualquer um sem grupo (aí o grupo nasce quando o convite é aceito).
  invite(from: string, to: string, max: number, now = Date.now()): InviteResult {
    if (from === to) return 'self';
    if (this.byMember.has(to)) return 'already';
    const p = this.byMember.get(from);
    if (p && p.leader !== from) return 'notLeader';
    if (p && p.members.length >= max) return 'full';
    this.invites.set(to, { from, until: now + INVITE_TTL });
    return 'ok';
  }
  accept(id: string, max: number, online: (id: string) => boolean, now = Date.now()): JoinResult {
    const from = this.invitedBy(id, now);
    this.invites.delete(id);
    if (!from) return { error: 'none' };
    if (!online(from)) return { error: 'gone' };
    if (this.byMember.has(id)) return { error: 'already' };
    let p = this.byMember.get(from);
    if (p && p.members.length >= max) return { error: 'full' };
    if (!p) { p = { id: `g${++this.seq}`, leader: from, members: [from] }; this.byMember.set(from, p); }
    p.members.push(id); this.byMember.set(id, p);
    return { party: p, from };
  }
  decline(id: string) { const from = this.invitedBy(id); this.invites.delete(id); return from; }

  // Saiu (ou foi tirado, ou desconectou). Quem lidera saindo passa a liderança ao mais antigo; sobrou um, o grupo acaba.
  leave(id: string): LeaveResult | null {
    const p = this.byMember.get(id); if (!p) return null;
    this.byMember.delete(id);
    p.members = p.members.filter(m => m !== id);
    let leader: string | null = null;
    if (p.leader === id && p.members.length) { p.leader = p.members[0]; leader = p.leader; }
    const dissolved = p.members.length <= 1 ? p.members.splice(0) : [];
    for (const m of dissolved) this.byMember.delete(m);
    return { party: p, leader: dissolved.length ? null : leader, dissolved };
  }
  // Esquece o jogador: sai do grupo e os convites dele (feitos e recebidos) somem.
  drop(id: string) {
    this.invites.delete(id);
    for (const [to, i] of this.invites) if (i.from === id) this.invites.delete(to);
    return this.leave(id);
  }
  // O mesmo personagem entrou de novo (sessão nova): continua no grupo, no mesmo lugar.
  rename(from: string, to: string) {
    const p = this.byMember.get(from); if (!p) return null;
    p.members = p.members.map(m => m === from ? to : m);
    if (p.leader === from) p.leader = to;
    this.byMember.delete(from); this.byMember.set(to, p);
    for (const i of this.invites.values()) if (i.from === from) i.from = to;
    return p;
  }
}
