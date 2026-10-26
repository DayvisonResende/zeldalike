import { sql, type Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';
import { nameKey } from './names';

// Cada mudança no banco vira uma migração nova, nunca uma edição das antigas.
export const migrations: Record<string, Migration> = {
  '001_contas_e_personagens': {
    async up(db: Kysely<unknown>) {
      await db.schema.createTable('accounts')
        .addColumn('id', 'integer', c => c.primaryKey().autoIncrement())
        .addColumn('username', 'text', c => c.notNull().unique().modifyEnd(sql`collate nocase`))
        .addColumn('pass_hash', 'text', c => c.notNull())
        .addColumn('created_at', 'integer', c => c.notNull())
        .addColumn('last_login', 'integer')
        .execute();
      await db.schema.createTable('sessions')
        .addColumn('token_hash', 'text', c => c.primaryKey())
        .addColumn('account_id', 'integer', c => c.notNull().references('accounts.id').onDelete('cascade'))
        .addColumn('created_at', 'integer', c => c.notNull())
        .addColumn('expires_at', 'integer', c => c.notNull())
        .execute();
      await db.schema.createTable('characters')
        .addColumn('id', 'integer', c => c.primaryKey().autoIncrement())
        .addColumn('account_id', 'integer', c => c.notNull().references('accounts.id').onDelete('cascade'))
        .addColumn('name', 'text', c => c.notNull().unique().modifyEnd(sql`collate nocase`))
        .addColumn('cloak', 'integer', c => c.notNull())
        .addColumn('hair', 'integer', c => c.notNull())
        .addColumn('x', 'real').addColumn('y', 'real').addColumn('hp', 'real').addColumn('mp', 'real')
        .addColumn('created_at', 'integer', c => c.notNull())
        .addColumn('last_played', 'integer')
        .execute();
      await db.schema.createIndex('characters_by_account').on('characters').column('account_id').execute();
    }
  },
  // "collate nocase" do SQLite só ignora maiúsculas de A a Z: "Íris" e "íris" passavam como nomes diferentes.
  // A chave guarda o nome sem acentos e em minúsculas, e é ela que precisa ser única.
  '002_chave_do_nome': {
    async up(db: Kysely<any>) {
      await db.schema.alterTable('characters').addColumn('name_key', 'text').execute();
      // nomes que agora contam como iguais: o mais novo ganha o número dele no fim ("íris" → "íris 7")
      const rows = await db.selectFrom('characters').select(['id', 'name']).orderBy('id').execute(), seen = new Set<string>();
      for (const r of rows) {
        let name = r.name;
        if (seen.has(nameKey(name))) name = `${name.slice(0, 12)} ${r.id}`;
        seen.add(nameKey(name));
        await db.updateTable('characters').set({ name, name_key: nameKey(name) }).where('id', '=', r.id).execute();
      }
      await db.schema.createIndex('characters_name_key').on('characters').column('name_key').unique().execute();
    }
  },
  '003_progresso_e_inventario': {
    async up(db: Kysely<unknown>) {
      await db.schema.alterTable('characters').addColumn('level', 'integer', c => c.notNull().defaultTo(1)).execute();
      await db.schema.alterTable('characters').addColumn('xp', 'integer', c => c.notNull().defaultTo(0)).execute();
      await db.schema.alterTable('characters').addColumn('gold', 'integer', c => c.notNull().defaultTo(0)).execute();
      await db.schema.alterTable('characters').addColumn('items', 'text', c => c.notNull().defaultTo('[]')).execute();   // inventário em JSON
    }
  }
};
