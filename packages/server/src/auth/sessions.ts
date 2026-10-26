import { accountBySession } from '../persistence/accounts';
import type { Db } from '../persistence/db';
import { tokenHash } from './password';

// Conta dona de um token de sessão válido, ou undefined.
export function accountForToken(db: Db, token: unknown) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 100) return Promise.resolve(undefined);
  return accountBySession(db, tokenHash(token));
}
