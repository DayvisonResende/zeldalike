import type { Db } from './db';

// Hora do dia (0 a 1) guardada no banco: o relógio do mundo continua de onde parou quando o servidor reinicia.
export async function loadDay(db: Db) {
  const row = await db.selectFrom('server_state').select('value').where('key', '=', 'day').executeTakeFirst();
  const t = Number(row?.value);
  return row && Number.isFinite(t) && t >= 0 && t < 1 ? t : null;
}
export async function saveDay(db: Db, t: number) {
  const value = String(Math.round(t * 1e6) / 1e6);
  await db.insertInto('server_state').values({ key: 'day', value }).onConflict(oc => oc.column('key').doUpdateSet({ value })).execute();
}

// Lida uma vez na partida (index.ts), antes de a sala do mundo nascer.
let boot: number | null = null;
export const bootDay = () => boot;
export function setBootDay(t: number | null) { boot = t; }
