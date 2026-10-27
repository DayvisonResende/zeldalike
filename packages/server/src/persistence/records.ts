import type { Db } from './db';

export const listRecords = (db: Db) => db.selectFrom('fish_records').selectAll().orderBy('size', 'desc').execute();

// Grava se for maior que o recorde atual daquele peixe. Devolve true quando bateu o recorde.
export async function submitRecord(db: Db, item: string, size: number, character: string) {
  const cur = await db.selectFrom('fish_records').select('size').where('item', '=', item).executeTakeFirst();
  if (cur && cur.size >= size) return false;
  await db.insertInto('fish_records').values({ item, size, character, at: Date.now() })
    .onConflict(oc => oc.column('item').doUpdateSet({ size, character, at: Date.now() })).execute();
  return true;
}
