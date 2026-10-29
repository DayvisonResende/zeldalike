/* Relógio do Windows: por padrão ele só acorda os programas a cada ~15,6 ms (no home lab, o teste mediu 31 ms). O laço
   do jogo pede um passo a cada 16,7 ms, então os passos saíam amontoados: a cada 32–47 ms, e os envios a cada 70–80 ms
   em vez de 50 (gravações do /debug de 2026-10-29). Pedir 1 ms ao Windows (timeBeginPeriod, como o Chrome faz) deixa
   o ritmo regular, também com a janela do servidor minimizada (medido com npm run clock:check).
   Precisa do pacote "koffi" (chama funções do Windows); sem ele, ou fora do Windows, nada muda. */
export async function preciseTimers(): Promise<string | null> {
  if (process.platform !== 'win32') return null;
  try {
    const name = 'koffi';   // carregado só no Windows, e só se estiver instalado
    const koffi = (await import(name)).default as { load(lib: string): { func(sig: string): (n: number) => number } };
    const begin = koffi.load('winmm.dll').func('uint32 __stdcall timeBeginPeriod(uint32 uPeriod)');
    return begin(1) === 0 ? 'relógio do Windows em 1 ms (passos e envios no ritmo)' : 'o Windows recusou o relógio de 1 ms';
  } catch {
    return 'relógio do Windows em 15,6 ms: rode "npm install koffi -w @vale/server" para os envios saírem no ritmo';
  }
}
