import { FRAME_PARTS, TELEMETRY_MAX_MIN, type FramePart, type TelemetryDevice, type TelemetrySample } from '@vale/shared';

/* /debug: grava por alguns minutos (1 por padrão) um resumo por segundo do aparelho e da rede, e mostra os números ao vivo
   no canto da tela. Online, cada segundo vai para o servidor, que junta o lado dele e salva em data/telemetria; offline,
   fica só o resumo no fim. Serve para achar de onde vêm as travadas: aparelho (quadros lentos), rede ou servidor. */
export interface NetDebug { gap: number; delay: number; ahead: number; frozen: number; snaps: number; replays: number; pending: number; snapMs: number }
export interface DebugHooks {
  net(): NetDebug | null;                                    // números da rede desde a última leitura (null = offline)
  start(minutes: number, device: TelemetryDevice): void;    // avisa o servidor que começou (só online)
  send(s: TelemetrySample): void;
  stop(): void;
  say(text: string): void;                                   // mensagem no chat
}

const SLOW = 50, STALL = 500;   // quadro lento e parada de rede (ms)
const clock = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
function device(): TelemetryDevice {
  const ua = navigator.userAgent, c = (navigator as Navigator & { connection?: { type?: string; effectiveType?: string } }).connection;
  const src = document.querySelector('script[src*="assets/jogo-"]')?.getAttribute('src') ?? '';
  return { ua, screen: `${screen.width}x${screen.height}`, dpr: devicePixelRatio, app: /; wv\)/.test(ua),
    net: c ? `${c.type ?? ''} ${c.effectiveType ?? ''}`.trim() : '', version: /jogo-([\w-]+)\./.exec(src)?.[1] ?? 'dev' };
}

export class DebugPanel {
  private box = document.createElement('div');
  private text = Object.assign(document.createElement('pre'), { className: 'debug' });
  private markBtn = Object.assign(document.createElement('button'), { type: 'button', textContent: 'Marcar travada' });
  private recording = false; private startedAt = 0; private until = 0; private online = false; private stalled = false;
  // segundo em andamento
  private since = 0; private last = 0; private frames = 0; private worst = 0; private worstJs = 0; private slow = 0; private catchUp = 0;
  private parts: Partial<Record<FramePart, number>> = {}; private events = new Map<string, number>();
  // resumo da gravação inteira
  private sum = { seconds: 0, fps: 0, slowSeconds: 0, worst: 0, worstJs: 0, stalls: 0, maxGap: 0, frozen: 0, marks: 0 };

  constructor(private hooks: DebugHooks) {
    Object.assign(this.box.style, { position: 'fixed', top: '4px', left: '4px', zIndex: '99', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px', pointerEvents: 'none' });
    Object.assign(this.text.style, { margin: '0', padding: '4px 6px', font: '11px/1.35 monospace', color: '#fff', background: 'rgba(0,0,0,.65)', whiteSpace: 'pre' });
    Object.assign(this.markBtn.style, { pointerEvents: 'auto', font: '12px sans-serif', padding: '6px 10px', border: '0', borderRadius: '6px', background: '#c0392b', color: '#fff' });
    this.markBtn.addEventListener('click', () => this.mark());
    this.box.append(this.text, this.markBtn);
    this.box.hidden = true;
    document.body.append(this.box);
  }

  // Comando do chat: "", "5" (minutos) ou "parar".
  command(arg: string) {
    if (/^parar$/i.test(arg)) { if (this.recording) this.finish('parou'); else this.hooks.say('Nenhuma gravação em andamento.'); return; }
    const n = arg ? Number(arg) : 1;
    if (!Number.isInteger(n) || n < 1) { this.hooks.say('Use /debug, /debug 5 (minutos) ou /debug parar.'); return; }
    if (n > TELEMETRY_MAX_MIN) { this.hooks.say(`No máximo ${TELEMETRY_MAX_MIN} minutos.`); return; }
    this.start(n);
  }
  start(minutes: number) {
    if (this.recording) this.finish('outra gravação');
    this.recording = true; this.online = false; this.stalled = false; this.startedAt = performance.now(); this.until = this.startedAt + minutes * 60000;
    this.since = 0; this.sum = { seconds: 0, fps: 0, slowSeconds: 0, worst: 0, worstJs: 0, stalls: 0, maxGap: 0, frozen: 0, marks: 0 };
    this.hooks.net();   // zera o que a rede acumulou antes
    this.box.hidden = false; this.text.textContent = `● gravando 0:00 / ${clock(minutes * 60000)}`;
    this.hooks.say(`Gravando ${minutes} min. Jogue normalmente; quando travar, toque em "Marcar travada" (ou /marca).`);
  }
  mark() { if (!this.recording) { this.hooks.say('Ligue a gravação com /debug.'); return; } this.event('marca'); this.sum.marks++; this.hooks.say('Marcado.'); }
  event(name: string) { if (this.recording) this.events.set(name, (this.events.get(name) ?? 0) + 1); }
  // Caiu e entrou de novo: a gravação continua, num arquivo novo no servidor.
  reconnected() { if (this.recording) { this.online = false; this.event('reconectou'); } }
  part(name: FramePart, ms: number) { if (this.recording) this.parts[name] = Math.max(this.parts[name] ?? 0, ms); }

  // Fim de cada quadro. now: horário do quadro; js: quanto o quadro gastou no nosso código; steps: passos de simulação nele.
  frame(now: number, js: number, steps: number) {
    if (!this.recording) return;
    if (!this.since) { this.since = this.last = now; return; }
    const dt = now - this.last; this.last = now;
    this.frames++; this.worst = Math.max(this.worst, dt); this.worstJs = Math.max(this.worstJs, js);
    if (dt > SLOW) this.slow++;
    if (steps > 2) this.catchUp++;
    if (now - this.since >= 1000) this.flush(now);
  }

  private flush(now: number) {
    const n = this.hooks.net(), fps = Math.round(this.frames * 1000 / (now - this.since));
    if (n) this.parts.rede_snapshot = n.snapMs;   // pior snapshot do segundo (fora do quadro)
    const ev = [...this.events].map(([k, c]) => c > 1 ? `${k}×${c}` : k);
    if (!n) ev.push('offline');
    const s: TelemetrySample = { fps, worst: this.worst, js: this.worstJs, slow: this.slow, catchUp: this.catchUp, parts: this.parts,
      gap: n?.gap ?? 0, snaps: n?.snaps ?? 0, delay: n?.delay ?? 0, ahead: n?.ahead ?? 0, frozen: n?.frozen ?? 0,
      replays: n?.replays ?? 0, pending: n?.pending ?? 0, ev };
    if (n && !this.online) { this.hooks.start(Math.min(TELEMETRY_MAX_MIN, Math.max(1, Math.ceil((this.until - now) / 60000))), device()); this.online = true; }
    if (n) this.hooks.send(s);
    const u = this.sum;
    u.seconds++; u.fps += fps; if (this.slow) u.slowSeconds++; u.worst = Math.max(u.worst, this.worst); u.worstJs = Math.max(u.worstJs, this.worstJs);
    // Parada de rede: o intervalo só é medido quando um snapshot chega; segundo sem nenhum = parada ainda em curso.
    if (n && !n.snaps) { if (!this.stalled) u.stalls++; this.stalled = true; }
    else if (n) { if (n.gap > STALL && !this.stalled) u.stalls++; this.stalled = false; u.maxGap = Math.max(u.maxGap, n.gap); }
    u.frozen += s.frozen;
    const top = FRAME_PARTS.filter(k => this.parts[k] !== undefined).sort((a, b) => this.parts[b]! - this.parts[a]!).slice(0, 3).map(k => `${k} ${Math.round(this.parts[k]!)}`).join(', ');
    this.text.textContent = [
      `● gravando ${clock(now - this.startedAt)} / ${clock(this.until - this.startedAt)}${n ? '' : ' (offline: só o resumo)'}`,
      `aparelho: ${fps} fps · pior quadro ${Math.round(this.worst)} ms · código ${Math.round(this.worstJs)} ms · lentos ${this.slow}`,
      top ? `mais pesado: ${top} (ms)` : '',
      n ? `rede: ${n.snaps} snapshots · maior intervalo ${n.snaps ? Math.round(n.gap) + ' ms' : 'nenhum chegou'} · atraso ${Math.round(n.delay)} ms` : 'rede: offline',
      n ? `monstros: seguindo o rumo ${n.ahead} · parados ${n.frozen} (quadros) · previsão refeita ${n.replays} passos (lote ${n.pending})` : ''
    ].filter(Boolean).join('\n');
    this.since = now; this.frames = 0; this.worst = 0; this.worstJs = 0; this.slow = 0; this.catchUp = 0; this.parts = {}; this.events.clear();
    if (now >= this.until) this.finish('tempo');
  }

  private finish(reason: string) {
    this.recording = false; this.box.hidden = true;
    if (this.online) this.hooks.stop();
    const u = this.sum, fps = u.seconds ? Math.round(u.fps / u.seconds) : 0, pct = u.seconds ? Math.round(u.slowSeconds * 100 / u.seconds) : 0;
    this.hooks.say(`Gravação ${reason === 'tempo' ? 'terminou' : 'encerrada'} (${clock(u.seconds * 1000)}): média ${fps} fps; ${pct}% dos segundos com quadro acima de ${SLOW} ms `
      + `(pior ${Math.round(u.worst)} ms, código até ${Math.round(u.worstJs)} ms); ${u.stalls} parada(s) de rede acima de ${STALL} ms`
      + `${u.maxGap > STALL ? ` (a maior ${(u.maxGap / 1000).toFixed(1)} s)` : ''}; ${u.frozen} quadros com monstros parados; ${u.marks} marca(s).`);
  }
}
