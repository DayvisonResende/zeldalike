// Chat. "local" chega a quem está perto (e vira balão sobre a cabeça), "global" a todo o servidor,
// "system" são avisos do próprio servidor (alguém entrou, saiu...).
export type ChatChannel = 'local' | 'global';
export interface ChatRequest { text: string; ch: ChatChannel }
export interface ChatMsg { ch: ChatChannel | 'system'; text: string; from?: string; name?: string }

// Sem caracteres de controle, espaços repetidos viram um, corta no tamanho máximo. Vazio = null.
export function cleanChat(raw: unknown, max: number): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, '').replace(/\s+/g, ' ').trim().slice(0, max).trim();   // controles, invisíveis e separadores de linha
  return s || null;
}
export function decodeChatRequest(m: unknown, max: number): ChatRequest | null {
  if (!m || typeof m !== 'object') return null;
  const r = m as Record<string, unknown>, text = cleanChat(r.text, max);
  return text ? { text, ch: r.ch === 'global' ? 'global' : 'local' } : null;
}
