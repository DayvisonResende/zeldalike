// Filtro de palavrões do chat: troca a palavra por asteriscos. Compara sem acento, sem maiúsculas e com as
// trocas mais comuns de letra por número ou símbolo (p0rr4, fod@). A lista extra vem do config (chat.blockedWords).
const BUILT_IN = [
  'porra', 'caralho', 'krl', 'merda', 'puta', 'puto', 'putaria', 'foda', 'foder', 'fodase', 'fdp', 'vsf', 'vtnc', 'pqp',
  'buceta', 'cu', 'cuzao', 'arrombado', 'arrombada', 'viado', 'otario', 'otaria', 'bosta', 'corno', 'vagabundo', 'vagabunda',
  'piranha', 'desgraca', 'desgracado', 'desgracada', 'cacete', 'babaca'
];
const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's' };
export const normalizeWord = (w: string) => w.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
  .replace(/[013457@$]/g, c => LEET[c]).replace(/[^a-z]/g, '');

export function filterChat(text: string, extra: readonly string[] = []) {
  const blocked = new Set([...BUILT_IN, ...extra.map(normalizeWord)].filter(Boolean));
  // palavra = trecho sem espaço; "foda-se" e "f.d.p" contam inteiros
  return text.replace(/\S+/g, word => {
    const n = normalizeWord(word);
    if (!blocked.has(n)) return word;
    return word.replace(/[\p{L}\p{N}@$]/gu, '*');
  });
}
