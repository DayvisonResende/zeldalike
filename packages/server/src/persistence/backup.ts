import fs from 'node:fs';
import path from 'node:path';
import { sqliteOf, type Db } from './db';

// Cópia do banco feita com o servidor rodando (a API de backup do SQLite copia um retrato consistente,
// sem parar as escritas). Arquivos "vale-AAAA-MM-DD-HHMM.db"; guarda os `keep` mais novos e apaga o resto.
const NAME = /^vale-\d{4}-\d{2}-\d{2}-\d{4}(-\d+)?\.db$/;
const stamp = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;

export async function backupNow(db: Db, dir: string, keep: number, now = new Date()) {
  const sqlite = sqliteOf.get(db);
  if (!sqlite) throw new Error('banco sem SQLite por baixo');
  fs.mkdirSync(dir, { recursive: true });
  let file = path.join(dir, `vale-${stamp(now)}.db`);
  for (let n = 2; fs.existsSync(file); n++) file = path.join(dir, `vale-${stamp(now)}-${n}.db`);   // duas no mesmo minuto
  await sqlite.backup(file);
  // mais novos primeiro pela data do arquivo (o nome não basta: "…-2102-2.db" vem antes de "…-2102.db" em ordem alfabética)
  const all = fs.readdirSync(dir).filter(f => NAME.test(f)).map(f => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }));
  all.sort((a, b) => b.t - a.t || b.f.localeCompare(a.f));
  for (const { f } of all.slice(keep)) if (path.join(dir, f) !== file) fs.rmSync(path.join(dir, f));
  return file;
}

// Agenda os backups pelo config (lido a cada vez: mudar o "every" vale a partir do próximo).
export function scheduleBackups(db: Db, settings: () => { every: number; keep: number; dir: string }) {
  let timer: NodeJS.Timeout | undefined;
  const next = () => {
    const s = settings();
    if (s.every <= 0) { timer = setTimeout(next, 60_000); timer.unref(); return; }   // desligado: confere de novo daqui a 1 min
    timer = setTimeout(async () => {
      try { console.log(`[banco] backup: ${await backupNow(db, s.dir, s.keep)}`); } catch (e) { console.error('[banco] backup falhou:', e); }
      next();
    }, s.every * 1000);
    timer.unref();
  };
  next();
  return () => clearTimeout(timer);
}
