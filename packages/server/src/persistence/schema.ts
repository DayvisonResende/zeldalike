import type { Generated } from 'kysely';

// Tabelas do banco. Datas em milissegundos (Date.now()).
export interface DB {
  accounts: { id: Generated<number>; username: string; pass_hash: string; created_at: number; last_login: number | null };
  sessions: { token_hash: string; account_id: number; created_at: number; expires_at: number };
  characters: {
    id: Generated<number>; account_id: number; name: string; name_key: string;
    cloak: number; hair: number;
    x: number | null; y: number | null;   // null = nunca jogou: nasce no ponto de partida
    hp: number | null; mp: number | null;
    created_at: number; last_played: number | null;
    level: Generated<number>; xp: Generated<number>; gold: Generated<number>; items: Generated<string>;
  };
}
