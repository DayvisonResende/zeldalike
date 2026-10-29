import { describe, expect, it } from 'vitest';
import { Parties } from '../src/rooms/parties';

const all = () => true;

describe('grupos', () => {
  it('convite aceito cria o grupo; quem convidou lidera', () => {
    const g = new Parties();
    expect(g.invite('a', 'b', 4)).toBe('ok');
    const r = g.accept('b', 4, all);
    expect('party' in r && r.party.members).toEqual(['a', 'b']);
    expect(g.of('a')?.leader).toBe('a');
    expect(g.of('b')).toBe(g.of('a'));
  });
  it('recusa: sem convite, convidar a si mesmo, quem já tem grupo, grupo cheio, só o líder convida, convite vencido', () => {
    const g = new Parties();
    expect(g.accept('b', 4, all)).toEqual({ error: 'none' });
    expect(g.invite('a', 'a', 4)).toBe('self');
    g.invite('a', 'b', 2); g.accept('b', 2, all);
    expect(g.invite('c', 'a', 2)).toBe('already');
    expect(g.invite('a', 'c', 2)).toBe('full');
    expect(g.invite('b', 'c', 4)).toBe('notLeader');
    g.invite('x', 'y', 4, 0);
    expect(g.accept('y', 4, all, 60001)).toEqual({ error: 'none' });
  });
  it('quem convidou saiu do jogo: o convite não vale', () => {
    const g = new Parties();
    g.invite('a', 'b', 4);
    expect(g.accept('b', 4, id => id !== 'a')).toEqual({ error: 'gone' });
  });
  it('líder sai: o mais antigo lidera; sobrou um, o grupo acaba', () => {
    const g = new Parties();
    g.invite('a', 'b', 4); g.accept('b', 4, all);
    g.invite('a', 'c', 4); g.accept('c', 4, all);
    expect(g.leave('a')).toMatchObject({ leader: 'b', dissolved: [] });
    expect(g.of('c')?.leader).toBe('b');
    expect(g.leave('c')).toMatchObject({ dissolved: ['b'] });
    expect(g.of('b')).toBeNull();
  });
  it('sessão nova do mesmo personagem continua no grupo', () => {
    const g = new Parties();
    g.invite('a', 'b', 4); g.accept('b', 4, all);
    g.rename('a', 'a2');
    expect(g.of('a2')).toMatchObject({ leader: 'a2', members: ['a2', 'b'] });
    expect(g.of('a')).toBeNull();
  });
});
