// Chave de comparação de nomes: sem acentos, minúsculas e espaços unificados. "Íris", "iris" e "IRIS" dão a mesma chave.
export const nameKey = (name: string) => name.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ').trim();
