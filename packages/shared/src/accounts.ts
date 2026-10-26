import { NAME_MAX, cleanName, type Look } from './looks';

/* Regras de conta e de personagem. Ficam aqui para o cliente avisar antes de enviar
   e o servidor recusar com a mesma mensagem. Cada função devolve o erro em português, ou null se está ok. */
export const USERNAME_MIN = 3, USERNAME_MAX = 20, PASSWORD_MIN = 6, PASSWORD_MAX = 128, CHAR_NAME_MIN = 3;

export function usernameError(u: unknown): string | null {
  if (typeof u !== 'string' || u.length < USERNAME_MIN || u.length > USERNAME_MAX) return `O usuário precisa ter de ${USERNAME_MIN} a ${USERNAME_MAX} caracteres.`;
  if (!/^[a-zA-Z0-9_.-]+$/.test(u)) return 'O usuário só pode ter letras sem acento, números, ponto, hífen e _.';
  return null;
}
export function passwordError(p: unknown): string | null {
  if (typeof p !== 'string' || p.length < PASSWORD_MIN) return `A senha precisa ter pelo menos ${PASSWORD_MIN} caracteres.`;
  if (p.length > PASSWORD_MAX) return `A senha pode ter no máximo ${PASSWORD_MAX} caracteres.`;
  return null;
}
// Nome do personagem: as mesmas regras do nome sobre a cabeça, sem limpeza silenciosa (o que você digita é o que fica).
export function characterNameError(n: unknown): string | null {
  if (typeof n !== 'string') return 'Escolha um nome.';
  const t = n.trim();
  if (t.length < CHAR_NAME_MIN || t.length > NAME_MAX) return `O nome precisa ter de ${CHAR_NAME_MIN} a ${NAME_MAX} caracteres.`;
  if (cleanName(t) !== t) return 'O nome só pode ter letras, números, espaço, hífen e _.';
  return null;
}

// O que a tela de seleção mostra de cada personagem.
export interface CharacterSummary { id: number; name: string; look: Look; level: number; lastPlayed: number | null }
export interface AccountInfo { username: string; maxCharacters: number; characters: CharacterSummary[] }
export interface AuthResult { token: string; username: string }
// Opções de entrada na sala do mundo.
export interface JoinOptions { token: string; characterId: number }
