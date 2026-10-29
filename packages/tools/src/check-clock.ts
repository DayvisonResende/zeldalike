// Confere o relógio do servidor: npm run clock:check
// Mede, por alguns segundos, de quanto em quanto tempo um setInterval de 16,7 ms (o do laço do jogo) dispara de
// verdade. Primeiro como o sistema vem; depois com o relógio de 1 ms (src/timer.ts, só no Windows com o koffi).
import { preciseTimers } from '../../server/src/timer';

const STEP = 1000 / 60, SECONDS = 4;
function measure(label: string) {
  return new Promise<void>(done => {
    const gaps: number[] = [];
    let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now(); gaps.push(now - last); last = now;
      if (gaps.length < SECONDS * 60) return;
      clearInterval(id);
      gaps.sort((a, b) => a - b);
      const at = (p: number) => gaps[Math.min(gaps.length - 1, Math.floor(gaps.length * p))].toFixed(1);
      const late = gaps.filter(g => g > 25).length;
      console.log(`${label}: mediana ${at(0.5)} ms · 90% até ${at(0.9)} ms · pior ${at(1)} ms · ${late} de ${gaps.length} passos atrasados (mais de 25 ms)`);
      done();
    }, STEP);
  });
}

console.log(`Sistema: ${process.platform}. O ideal é a mediana perto de 16,7 ms e quase nenhum passo atrasado.\n`);
await measure('Relógio padrão     ');
const clock = await preciseTimers();
if (!clock) console.log('\nFora do Windows o relógio já é preciso: não há nada a ligar.');
else {
  console.log(`\n[relógio] ${clock}`);
  await measure('Com o relógio de 1 ms');
}
