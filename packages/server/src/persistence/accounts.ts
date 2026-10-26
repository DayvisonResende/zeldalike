import type { Db } from './db';

export const findAccount = (db: Db, username: string) =>
  db.selectFrom('accounts').selectAll().where('username', '=', username).executeTakeFirst();   // collate nocase: "Ana" = "ana"

export async function createAccount(db: Db, username: string, passHash: string) {
  const r = await db.insertInto('accounts').values({ username, pass_hash: passHash, created_at: Date.now(), last_login: null }).returning('id').executeTakeFirstOrThrow();
  return r.id;
}
export const touchLogin = (db: Db, id: number) => db.updateTable('accounts').set({ last_login: Date.now() }).where('id', '=', id).execute();

/* Sessões: o banco guarda só o hash do token. Quem ler o banco não consegue entrar nas contas. */
export const createSession = (db: Db, tokenHash: string, accountId: number, ttlMs: number) =>
  db.insertInto('sessions').values({ token_hash: tokenHash, account_id: accountId, created_at: Date.now(), expires_at: Date.now() + ttlMs }).execute();
export const accountBySession = (db: Db, tokenHash: string) =>
  db.selectFrom('sessions').innerJoin('accounts', 'accounts.id', 'sessions.account_id')
    .select(['accounts.id', 'accounts.username']).where('token_hash', '=', tokenHash).where('expires_at', '>', Date.now()).executeTakeFirst();
export const deleteSession = (db: Db, tokenHash: string) => db.deleteFrom('sessions').where('token_hash', '=', tokenHash).execute();
export const purgeSessions = (db: Db) => db.deleteFrom('sessions').where('expires_at', '<=', Date.now()).execute();
