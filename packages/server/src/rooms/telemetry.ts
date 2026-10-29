import fs from 'node:fs';
import path from 'node:path';
import { PerformanceObserver, monitorEventLoopDelay } from 'node:perf_hooks';
import type { TelemetrySample } from '@vale/shared';

const stamp = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}-${String(d.getMinutes()).padStart(2, '0')}-${String(d.getSeconds()).padStart(2, '0')}`;
const safe = (s: string) => s.normalize('NFD').replace(/[^\w-]/g, '').slice(0, 24) || 'jogador';
const MIN_EVERY = 500;   // ms entre linhas: o cliente manda uma por segundo; mais que isso é abuso
const GRACE = 10_000;    // folga depois do tempo pedido (o cliente pode estar um pouco atrasado)

// Limpeza de memória (GC) do Node: pausa tudo. Observada só enquanto alguém grava; cada gravação soma a sua parte.
const live = new Set<Recording>();
let gcObserver: PerformanceObserver | null = null;
function watchGc(on: Recording | null, off?: Recording) {
  if (on) live.add(on);
  if (off) live.delete(off);
  if (live.size && !gcObserver) {
    gcObserver = new PerformanceObserver(list => { for (const e of list.getEntries()) for (const r of live) r.gc(e.duration); });
    gcObserver.observe({ entryTypes: ['gc'] });
  } else if (!live.size && gcObserver) { gcObserver.disconnect(); gcObserver = null; }
}

/* Uma gravação do /debug: um .jsonl com uma linha de início, uma por segundo e uma de fim. Cada linha por segundo
   junta o que o cliente mediu com o que o servidor viu daquele jogador no mesmo segundo (passos e envios), para
   dizer de quem é a culpa: "o servidor mandou em dia e o celular recebeu 4 s depois" é rede. */
export class Recording {
  readonly file: string;
  private out: fs.WriteStream;
  private start = Date.now(); private until: number; private lastLine = 0; private closed = false;
  // lado do servidor desde a última linha
  private stepMax = 0; private stepSum = 0; private steps = 0; private stepGapMax = 0;
  private sends = 0; private sendGapMax = 0; private bytes = 0; private lastSend = 0; private sendMs = 0;
  private gcMs = 0; private gcMax = 0; private notes: string[] = [];
  private loop = monitorEventLoopDelay({ resolution: 10 });   // quanto o laço de eventos ficou travado

  constructor(dir: string, name: string, minutes: number, header: Record<string, unknown>) {
    fs.mkdirSync(dir, { recursive: true });
    this.file = path.join(dir, `${stamp(new Date())}_${safe(name)}.jsonl`);
    this.out = fs.createWriteStream(this.file, { flags: 'a' });
    this.out.on('error', e => console.error('[telemetria]', e.message));
    this.until = this.start + minutes * 60_000 + GRACE;
    this.loop.enable(); watchGc(this);
    this.line({ tipo: 'inicio', em: new Date().toISOString(), jogador: name, minutos: minutes, ...header });
  }
  // Cada passo do servidor (o mundo todo): quanto levou e quanto esperou desde o anterior.
  step(ms: number, gap: number) {
    this.stepMax = Math.max(this.stepMax, ms); this.stepSum += ms; this.steps++; this.stepGapMax = Math.max(this.stepGapMax, gap);
  }
  gc(ms: number) { this.gcMs += ms; this.gcMax = Math.max(this.gcMax, ms); }
  // Algo que rodou fora do passo e pode ter travado o servidor (salvar no banco, limpar instâncias…).
  note(text: string) { if (this.notes.length < 20) this.notes.push(text); }
  // Tempo para montar e mandar os snapshots de todos (dentro do passo).
  sending(ms: number) { this.sendMs = Math.max(this.sendMs, ms); }
  // Cada snapshot enviado a este jogador.
  sent(bytes: number, now: number) {
    if (this.lastSend) this.sendGapMax = Math.max(this.sendGapMax, now - this.lastSend);
    this.lastSend = now; this.sends++; this.bytes += bytes;
  }
  // Uma linha por segundo. Devolve false quando o tempo pedido acabou.
  sample(c: TelemetrySample, map: string) {
    const now = Date.now();
    if (this.closed || now - this.lastLine < MIN_EVERY) return !this.closed;
    this.lastLine = now;
    const r1 = (n: number) => Math.round(n * 10) / 10;
    this.line({ tipo: 's', t: r1((now - this.start) / 1000), mapa: map, cliente: c, servidor: {
      passos: this.steps, passoMax: r1(this.stepMax), passoMedio: this.steps ? r1(this.stepSum / this.steps) : 0, esperaEntrePassosMax: r1(this.stepGapMax),
      envios: this.sends, intervaloEnvioMax: r1(this.sendGapMax), bytes: this.bytes, montarEnviosMax: r1(this.sendMs),
      lacoTravadoMax: r1(this.loop.max / 1e6), gcMs: r1(this.gcMs), gcMax: r1(this.gcMax), ...(this.notes.length ? { eventos: this.notes } : {}) } });
    this.stepMax = this.stepSum = this.steps = this.stepGapMax = this.sends = this.sendGapMax = this.bytes = this.sendMs = this.gcMs = this.gcMax = 0;
    this.notes = []; this.loop.reset();
    return now < this.until;
  }
  close(reason: string) {
    if (this.closed) return;
    this.closed = true;
    this.loop.disable(); watchGc(null, this);
    this.line({ tipo: 'fim', em: new Date().toISOString(), motivo: reason, segundos: Math.round((Date.now() - this.start) / 1000) });
    this.out.end();
  }
  private line(o: unknown) { this.out.write(JSON.stringify(o) + '\n'); }
}
