import { describe, expect, it } from 'vitest';
import { redirectTarget } from '../src/https';

const URL = 'https://play.useconectai.com.br';
const req = (originalUrl: string, o: Partial<{ method: string; secure: boolean; hostname: string }> = {}) =>
  ({ method: 'GET', secure: false, hostname: 'pifatec.useconectai.com.br', originalUrl, ...o });

describe('endereço antigo (http) → HTTPS', () => {
  it('leva as páginas para o endereço novo, com o resto do caminho', () => {
    expect(redirectTarget(URL, req('/'))).toBe(URL + '/');
    expect(redirectTarget(URL, req('/?offline'))).toBe(URL + '/?offline');
    expect(redirectTarget(URL + '/', req('/oficina'))).toBe(URL + '/oficina');
  });
  it('não mexe na API, nos arquivos, no que já é HTTPS nem no acesso pelo IP ou localhost', () => {
    expect(redirectTarget(URL, req('/api/health'))).toBeNull();          // o app antigo pergunta por http
    expect(redirectTarget(URL, req('/matchmake/joinOrCreate/world', { method: 'POST' }))).toBeNull();
    expect(redirectTarget(URL, req('/assets/jogo.js'))).toBeNull();
    expect(redirectTarget(URL, req('/', { secure: true }))).toBeNull();   // veio pelo Caddy
    expect(redirectTarget(URL, req('/', { hostname: '192.168.0.10' }))).toBeNull();
    expect(redirectTarget(URL, req('/', { hostname: 'localhost' }))).toBeNull();
  });
});
