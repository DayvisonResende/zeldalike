import type { CharacterSummary, Look, Slot } from '@vale/shared';
import type { Db } from './db';
import type { DB } from './schema';
import { nameKey } from './names';

export type CharacterRow = Omit<DB['characters'], 'id' | 'level' | 'xp' | 'gold' | 'items'> & { id: number; level: number; xp: number; gold: number; items: string };
export interface CharacterState { x: number; y: number; hp: number; mp: number; look: Look; level: number; xp: number; gold: number; bag: Slot[] }

export async function listCharacters(db: Db, accountId: number): Promise<CharacterSummary[]> {
  const rows = await db.selectFrom('characters').selectAll().where('account_id', '=', accountId).orderBy('created_at').execute();
  return rows.map(r => ({ id: r.id, name: r.name, look: { cloak: r.cloak, hair: r.hair }, level: r.level, lastPlayed: r.last_played }));
}
export const countCharacters = async (db: Db, accountId: number) =>
  Number((await db.selectFrom('characters').select(db.fn.countAll().as('n')).where('account_id', '=', accountId).executeTakeFirstOrThrow()).n);
export const nameTaken = async (db: Db, name: string) => !!(await db.selectFrom('characters').select('id').where('name_key', '=', nameKey(name)).executeTakeFirst());

export async function createCharacter(db: Db, accountId: number, name: string, look: Look) {
  const r = await db.insertInto('characters').values({ account_id: accountId, name, name_key: nameKey(name), cloak: look.cloak, hair: look.hair, x: null, y: null, hp: null, mp: null, created_at: Date.now(), last_played: null })
    .returning('id').executeTakeFirstOrThrow();
  return r.id;
}
// Só devolve se o personagem for desta conta.
export const getCharacter = (db: Db, accountId: number, id: number) =>
  db.selectFrom('characters').selectAll().where('id', '=', id).where('account_id', '=', accountId).executeTakeFirst() as Promise<CharacterRow | undefined>;
export const deleteCharacter = (db: Db, accountId: number, id: number) =>
  db.deleteFrom('characters').where('id', '=', id).where('account_id', '=', accountId).executeTakeFirst();

// Salva vários de uma vez numa transação (o autosave do servidor).
export async function saveCharacters(db: Db, list: { id: number; state: CharacterState }[]) {
  if (!list.length) return;
  const now = Date.now();
  await db.transaction().execute(async tx => {
    for (const { id, state: s } of list)
      await tx.updateTable('characters').set({ x: s.x, y: s.y, hp: s.hp, mp: s.mp, cloak: s.look.cloak, hair: s.look.hair, last_played: now,
        level: s.level, xp: s.xp, gold: s.gold, items: JSON.stringify(s.bag) }).where('id', '=', id).execute();
  });
}
