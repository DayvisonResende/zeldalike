import { isIP } from 'node:net';
import type { RequestHandler } from 'express';

/* Com HTTPS (Caddy na frente, ver docs/HTTPS.md), quem ainda abre o endereço antigo (http://...:2567) é levado para o
   novo. Só as páginas: a API e a conexão do jogo não mudam de endereço no meio (o app antigo pergunta /api/health por
   http e não segue redirecionamento para https). Pelo IP ou por localhost (testes na rede de casa) nada muda. */
export function redirectTarget(publicUrl: string, req: { method: string; secure: boolean; hostname: string; originalUrl: string }) {
  if (req.secure || (req.method !== 'GET' && req.method !== 'HEAD')) return null;
  const host = req.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || isIP(host)) return null;
  const path = req.originalUrl.split('?')[0];
  if (!(path === '/' || path === '/oficina' || path.endsWith('.html'))) return null;
  return publicUrl.replace(/\/+$/, '') + req.originalUrl;
}
export function httpsRedirect(publicUrl: () => string): RequestHandler {
  return (req, res, next) => {
    const url = publicUrl(), to = url && redirectTarget(url, req);
    if (to) res.redirect(301, to); else next();
  };
}
