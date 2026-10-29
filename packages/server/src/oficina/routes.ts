import express, { type Request, type Response } from 'express';
import type { CalcRules } from '@vale/shared';
import fs from 'node:fs';
import { configFile, getConfig } from '../config/store';
import { parseConfig } from '../config/load';
import { getMaps, startMap } from '../map';
import { applyUses, checkUses, usesOf, type UsesRequest } from './uses';
import { toRules } from '../config/load';
import { accountForToken } from '../auth/sessions';
import { getDb } from '../persistence/db';
import { ITEMS_DIR, getCatalog, saveItem } from '../content/items';

/* Oficina: criar e editar conteúdo pelo navegador (docs/OFICINA.md). Só existe com OFICINA=1 (o `npm run dev` do PC liga),
   porque ela grava arquivos em content/: cria-se no PC e sobe para o servidor por commit. Só para administradores. */
export const oficinaEnabled = () => process.env.OFICINA === '1';
const fail = (res: Response, status: number, error: string) => res.status(status).json({ error });

export function oficinaRoutes(dir = ITEMS_DIR) {
  const r = express.Router();
  r.use((req, res, next) => {   // o Vite (desenvolvimento) roda em outra porta
    res.set({ 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS' });
    if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
    next();
  });
  r.use(express.json({ limit: '64kb' }));
  // Só administradores (a lista "admins" do config.yaml), com a sessão do jogo.
  r.use(async (req: Request, res, next) => {
    const token = req.get('authorization')?.replace(/^Bearer /, '');
    const acc = await accountForToken(getDb(), token);
    if (!acc) return fail(res, 401, 'Sessão expirada. Entre de novo.');
    if (!getConfig().admins.some(a => a.toLowerCase() === acc.username.toLowerCase())) return fail(res, 403, `A Oficina é só para administradores. Ponha "${acc.username}" em admins no config.yaml.`);
    (req as Request & { username: string }).username = acc.username;
    next();
  });
  r.get('/me', (req, res) => { res.json({ username: (req as Request & { username: string }).username }); });
  r.get('/items', (_req, res) => { res.json(getCatalog()); });
  // Números do config para a prévia e a calculadora: armas de base, magias, vida dos monstros, PvP e quem começa.
  r.get('/rules', (_req, res) => {
    const t = toRules(getConfig());
    res.json({ weapons: t.weapons, magic: t.magic, gear: t.gear, enemies: t.enemies, pvp: { damage: t.pvp.damage, factor: t.pvp.factor }, player: { maxHp: t.player.maxHp, maxMana: t.player.maxMana } } satisfies CalcRules);
  });
  // Criar (POST) ou mudar (PUT) um item. Corpo: os campos do item e, opcional, icon (PNG em data URL).
  const save = (create: boolean) => (req: Request, res: Response) => {
    const { icon, ...data } = (req.body ?? {}) as { icon?: unknown };
    let png: Buffer | null = null;
    if (typeof icon === 'string' && icon) {
      const m = icon.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
      if (!m) return fail(res, 400, 'ícone: mande um PNG');
      png = Buffer.from(m[1], 'base64');
    }
    const errors = saveItem(dir, String(req.params.id), data, png, create);
    if (errors.length) return res.status(400).json({ error: errors.join('\n'), errors });
    res.status(create ? 201 : 200).json({ ok: true });
  };
  // Onde o item aparece (lojas, drops, baús) e gravar lojas e drops no config.yaml.
  r.get('/uses/:id', (req, res) => { res.json(usesOf(getConfig(), getMaps(), String(req.params.id))); });
  r.put('/uses/:id', (req, res) => {
    const id = String(req.params.id), body = req.body as UsesRequest, file = configFile();
    if (!getCatalog()[id]) return fail(res, 404, `o item "${id}" não existe`);
    if (!file) return fail(res, 500, 'não sei onde está o config.yaml');
    const errors = checkUses(getConfig(), body);
    if (errors.length) return res.status(400).json({ error: errors.join('\n'), errors });
    const text = applyUses(fs.readFileSync(file, 'utf8'), id, body);
    // confere o arquivo inteiro antes de gravar: um config quebrado nunca vai para o disco
    const maps = getMaps(), main = maps[startMap()];
    try { parseConfig(text, main, Object.entries(maps).filter(([k]) => k !== startMap()).map(([, m]) => m)); }
    catch (e) { return fail(res, 400, (e as Error).message); }
    fs.writeFileSync(file, text);   // o servidor recarrega o config sozinho
    res.json({ ok: true });
  });
  r.post('/items/:id', save(true));
  r.put('/items/:id', save(false));
  return r;
}
