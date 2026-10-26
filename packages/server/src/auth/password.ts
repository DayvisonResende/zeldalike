import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: Buffer, len: number, opts: crypto.ScryptOptions) => Promise<Buffer>;
const N = 16384, R = 8, P = 1, LEN = 64;

// Senha nunca é guardada: só o hash scrypt com sal aleatório, no formato scrypt$N$r$p$sal$hash.
export async function hashPassword(pw: string) {
  const salt = crypto.randomBytes(16), hash = await scrypt(pw, salt, LEN, { N, r: R, p: P });
  return ['scrypt', N, R, P, salt.toString('base64'), hash.toString('base64')].join('$');
}
export async function verifyPassword(pw: string, stored: string) {
  const [alg, n, r, p, salt, hash] = stored.split('$');
  if (alg !== 'scrypt') return false;
  const expected = Buffer.from(hash, 'base64');
  const got = await scrypt(pw, Buffer.from(salt, 'base64'), expected.length, { N: Number(n), r: Number(r), p: Number(p) });
  return crypto.timingSafeEqual(got, expected);
}
// Hash de uma senha qualquer, para conta inexistente levar o mesmo tempo que senha errada.
export const DUMMY_HASH = await hashPassword('nenhuma-conta');

// Token de sessão: 32 bytes aleatórios para o cliente; no banco vai só o sha256.
export const newToken = () => crypto.randomBytes(32).toString('base64url');
export const tokenHash = (t: string) => crypto.createHash('sha256').update(t).digest('hex');
