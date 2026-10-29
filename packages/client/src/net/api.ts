import type { AccountInfo, AuthResult, CharacterSummary, Look } from '@vale/shared';

// Conversa com as rotas de conta do servidor (/api). Erros viram exceções com a mensagem em português.
export class Api {
  constructor(private base: string) { }
  token: string | null = null;

  // Nada espera para sempre: sem resposta em TIMEOUT, vira erro (e os botões da tela de conta voltam a funcionar).
  private async call<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetch(this.base + path, {
        method, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(TIMEOUT),
        headers: { 'Content-Type': 'application/json', ...(this.token ? { Authorization: 'Bearer ' + this.token } : {}) }
      });
    } catch (e) { throw new ApiError(0, e instanceof DOMException && e.name === 'TimeoutError' ? 'O servidor demorou para responder.' : 'Não foi possível falar com o servidor.'); }
    if (res.status === 204) return undefined as T;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(res.status, data.error ?? 'Erro no servidor.');
    return data as T;
  }
  request = <T>(path: string, method = 'GET', body?: unknown) => this.call<T>(path, method, body);   // outras rotas (a Oficina)
  register = (username: string, password: string) => this.call<AuthResult>('/register', 'POST', { username, password });
  login = (username: string, password: string) => this.call<AuthResult>('/login', 'POST', { username, password });
  logout = () => this.call<void>('/logout', 'POST', {});
  me = () => this.call<AccountInfo>('/me');
  createCharacter = (name: string, look: Look) => this.call<CharacterSummary>('/characters', 'POST', { name, look });
  deleteCharacter = (id: number) => this.call<void>('/characters/' + id, 'DELETE');
  records = () => this.call<{ item: string; size: number; character: string; at: number }[]>('/records');
  // O servidor está no ar? (resposta rápida ou não)
  async health() {
    try { return (await fetch(this.base + '/health', { cache: 'no-store', signal: AbortSignal.timeout(5000) })).ok; } catch { return false; }
  }
}
const TIMEOUT = 10000;
export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }

// Login lembrado neste navegador.
export interface SavedSession { token: string; username: string }
export function loadSession(): SavedSession | null {
  try { const s = JSON.parse(localStorage.getItem('vale.sessao') ?? 'null'); return s?.token ? s : null; } catch { return null; }
}
export function saveSession(s: SavedSession | null) {
  try { if (s) localStorage.setItem('vale.sessao', JSON.stringify(s)); else localStorage.removeItem('vale.sessao'); } catch { }
}
