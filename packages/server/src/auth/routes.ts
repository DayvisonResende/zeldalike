import express, { type Request, type Response, type NextFunction } from 'express';
import { characterNameError, cleanLook, passwordError, usernameError, type AccountInfo, type AuthResult } from '@vale/shared';
import { getConfig } from '../config/store';
import { createAccount, createSession, deleteSession, findAccount, touchLogin } from '../persistence/accounts';
import { countCharacters, createCharacter, deleteCharacter, listCharacters, nameTaken } from '../persistence/characters';
import { getDb } from '../persistence/db';
import { Limiter } from './limiter';
import { DUMMY_HASH, hashPassword, newToken, tokenHash, verifyPassword } from './password';
import { accountForToken } from './sessions';

const loginLimit = new Limiter(), registerLimit = new Limiter();
const DAY = 86_400_000;

type Authed = Request & { account: { id: number; username: string } };
const fail = (res: Response, status: number, error: string) => res.status(status).json({ error });
// Quem está online não pode ter o personagem apagado (a sala avisa por aqui).
export const onlineCharacters = new Set<number>();

// Rotas HTTP de conta e personagens, em /api. Respostas de erro: { error: "mensagem em português" }.
export function authRoutes() {
  const r = express.Router();
  // O jogo em desenvolvimento roda em outra porta (Vite); o token vai no cabeçalho, não em cookie, então liberar a origem é seguro.
  r.use((req, res, next) => {
    res.set({ 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS' });
    if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
    next();
  });
  r.use(express.json({ limit: '4kb' }));

  async function issue(res: Response, id: number, username: string, status = 200) {
    const token = newToken();
    await createSession(getDb(), tokenHash(token), id, getConfig().accounts.sessionDays * DAY);
    await touchLogin(getDb(), id);
    res.status(status).json({ token, username } satisfies AuthResult);
  }

  r.post('/register', async (req, res) => {
    const { username, password } = req.body ?? {};
    const err = usernameError(username) ?? passwordError(password);
    if (err) return fail(res, 400, err);
    if (!registerLimit.take(req.ip ?? '', getConfig().accounts.registerPerHour, 3_600_000)) return fail(res, 429, 'Muitas contas criadas daqui. Tente mais tarde.');
    if (await findAccount(getDb(), username)) return fail(res, 409, 'Esse usuário já existe.');
    const id = await createAccount(getDb(), username, await hashPassword(password));
    await issue(res, id, username, 201);
  });

  r.post('/login', async (req, res) => {
    const { username, password } = req.body ?? {};
    if (typeof username !== 'string' || typeof password !== 'string') return fail(res, 400, 'Informe usuário e senha.');
    if (!loginLimit.take(req.ip ?? '', getConfig().accounts.loginPer5Min, 300_000)) return fail(res, 429, 'Muitas tentativas. Espere alguns minutos.');
    const acc = await findAccount(getDb(), username);
    const ok = await verifyPassword(password, acc?.pass_hash ?? DUMMY_HASH);   // mesmo tempo com ou sem conta
    if (!acc || !ok) return fail(res, 401, 'Usuário ou senha incorretos.');
    await issue(res, acc.id, acc.username);
  });

  // Daqui para baixo, só com token: Authorization: Bearer <token>
  const authed = async (req: Request, res: Response, next: NextFunction) => {
    const token = req.get('authorization')?.replace(/^Bearer\s+/i, '');
    const acc = await accountForToken(getDb(), token);
    if (!acc) return fail(res, 401, 'Sessão expirada. Entre de novo.');
    (req as Authed).account = acc; next();
  };

  r.post('/logout', authed, async (req, res) => {
    await deleteSession(getDb(), tokenHash(req.get('authorization')!.replace(/^Bearer\s+/i, '')));
    res.sendStatus(204);
  });

  r.get('/me', authed, async (req, res) => {
    const { id, username } = (req as Authed).account;
    res.json({ username, maxCharacters: getConfig().accounts.maxCharacters, characters: await listCharacters(getDb(), id) } satisfies AccountInfo);
  });

  r.post('/characters', authed, async (req, res) => {
    const { id } = (req as Authed).account, name = typeof req.body?.name === 'string' ? req.body.name.trim() : req.body?.name;
    const err = characterNameError(name);
    if (err) return fail(res, 400, err);
    if (await countCharacters(getDb(), id) >= getConfig().accounts.maxCharacters) return fail(res, 409, `Você já tem ${getConfig().accounts.maxCharacters} personagens.`);
    if (await nameTaken(getDb(), name)) return fail(res, 409, 'Esse nome já está em uso.');
    const charId = await createCharacter(getDb(), id, name, cleanLook(req.body?.look));
    res.status(201).json((await listCharacters(getDb(), id)).find(c => c.id === charId));
  });

  r.delete('/characters/:id', authed, async (req, res) => {
    const charId = Number(req.params.id);
    if (onlineCharacters.has(charId)) return fail(res, 409, 'Esse personagem está no jogo agora.');
    const r2 = await deleteCharacter(getDb(), (req as Authed).account.id, charId);
    if (!Number(r2.numDeletedRows)) return fail(res, 404, 'Personagem não encontrado.');
    res.sendStatus(204);
  });

  // Erro inesperado: registra e responde genérico (sem detalhes internos para fora).
  r.use((e: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if ((e as { type?: string }).type === 'entity.parse.failed') return fail(res, 400, 'Pedido inválido.');
    console.error('[api]', e); fail(res, 500, 'Erro no servidor. Tente de novo.');
  });
  return r;
}
