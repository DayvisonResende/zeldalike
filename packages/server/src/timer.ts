/* Relógio do Windows: por padrão ele só acorda os programas a cada ~15,6 ms. O laço do jogo pede um passo a cada
   16,7 ms (setInterval do Colyseus), então os passos saíam amontoados: a cada 32–47 ms, e os envios a cada 70–80 ms
   em vez de 50 (gravações do /debug de 2026-10-29). Pedir 1 ms ao Windows (timeBeginPeriod, como o Chrome faz) deixa
   o ritmo regular. Precisa do pacote "koffi" (chama funções do Windows); sem ele, ou fora do Windows, nada muda.

   O Windows 11 ignora esse pedido quando a janela do programa está minimizada ou escondida (economia de energia), e
   ainda pode rodar o programa mais devagar ("eficiência"). Num servidor, a janela quase sempre está escondida: a
   gravação das 19:16 mostrou ainda um passo de ~32 ms por segundo. Por isso o servidor também pede para ficar fora
   dessa economia (SetProcessInformation com ProcessPowerThrottling, o jeito documentado pela Microsoft). */
type Koffi = {
  load(lib: string): { func(sig: string): (...args: unknown[]) => number };
  struct(name: string, def: Record<string, string>): unknown;
};
const PROCESS_POWER_THROTTLING = 4;                                             // ProcessPowerThrottling
const EXECUTION_SPEED = 0x1, IGNORE_TIMER_RESOLUTION = 0x4;                     // PROCESS_POWER_THROTTLING_*

export async function preciseTimers(): Promise<string | null> {
  if (process.platform !== 'win32') return null;
  let koffi: Koffi;
  try {
    const name = 'koffi';   // carregado só no Windows, e só se estiver instalado
    koffi = (await import(name)).default as Koffi;
  } catch {
    return 'relógio do Windows em 15,6 ms: rode "npm install koffi -w @vale/server" para os envios saírem no ritmo';
  }
  const begin = koffi.load('winmm.dll').func('uint32 __stdcall timeBeginPeriod(uint32 uPeriod)');
  const clock = begin(1) === 0 ? 'relógio do Windows em 1 ms (passos e envios no ritmo)' : 'o Windows recusou o relógio de 1 ms';
  return `${clock}; ${noThrottling(koffi)}`;
}

// Fora da economia de energia do Windows 11: o relógio de 1 ms vale mesmo com a janela minimizada, e o programa
// não é desacelerado. Em Windows mais antigos a função não existe ou recusa: aí não há essa economia, e tudo bem.
function noThrottling(koffi: Koffi) {
  try {
    koffi.struct('PROCESS_POWER_THROTTLING_STATE', { Version: 'uint32', ControlMask: 'uint32', StateMask: 'uint32' });
    const k32 = koffi.load('kernel32.dll');
    const current = k32.func('void * __stdcall GetCurrentProcess()');
    const set = k32.func('int __stdcall SetProcessInformation(void *hProcess, int infoClass, _In_ PROCESS_POWER_THROTTLING_STATE *info, uint32 size)');
    const ok = set(current(), PROCESS_POWER_THROTTLING, { Version: 1, ControlMask: EXECUTION_SPEED | IGNORE_TIMER_RESOLUTION, StateMask: 0 }, 12);
    return ok ? 'fora da economia de energia (vale com a janela minimizada)' : 'o Windows recusou tirar da economia de energia';
  } catch (e) {
    return `economia de energia não ajustada (${(e as Error).message})`;
  }
}
