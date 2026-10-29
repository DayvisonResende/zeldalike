import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { openDatabase } from '../src/persistence/db';
import { backupNow } from '../src/persistence/backup';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vale-backup-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

describe('backup do banco', () => {
  it('copia o banco aberto e guarda só os mais novos', async () => {
    const db = await openDatabase(path.join(tmp, 'vale.db'));
    await db.insertInto('accounts').values({ username: 'ana', pass_hash: 'x', created_at: 1, last_login: null }).execute();
    const dir = path.join(tmp, 'backups');
    const files: string[] = [];
    for (let h = 0; h < 4; h++) files.push(await backupNow(db, dir, 2, new Date(2026, 9, 28, h, 0)));
    expect(fs.readdirSync(dir).sort()).toEqual(['vale-2026-10-28-0200.db', 'vale-2026-10-28-0300.db']);
    // dois no mesmo minuto: o segundo ganha "-2" e fica (é o mais novo)
    const again = await backupNow(db, dir, 2, new Date(2026, 9, 28, 3, 0));
    expect(path.basename(again)).toBe('vale-2026-10-28-0300-2.db');
    expect(fs.existsSync(again)).toBe(true);
    expect(fs.readdirSync(dir)).toHaveLength(2);
    const copy = new Database(files.at(-1)!, { readonly: true });
    expect(copy.prepare('select username from accounts').get()).toEqual({ username: 'ana' });
    copy.close();
    await db.destroy();
  });
});
