// Limite simples por chave (ex.: IP): no máximo `max` tentativas a cada `windowMs`. Em memória: zera ao reiniciar.
// Os números vêm de fora a cada chamada, para mudanças na config valerem na hora.
export class Limiter {
  private hits = new Map<string, number[]>();
  // true = pode; false = passou do limite
  take(key: string, max: number, windowMs: number) {
    const now = Date.now(), list = (this.hits.get(key) ?? []).filter(t => now - t < windowMs);
    if (list.length >= max) { this.hits.set(key, list); return false; }
    list.push(now); this.hits.set(key, list);
    if (this.hits.size > 10000) for (const [k, v] of this.hits) if (!v.some(t => now - t < windowMs)) this.hits.delete(k);
    return true;
  }
}
