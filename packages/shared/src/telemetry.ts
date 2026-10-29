// Gravação do /debug: o cliente manda um resumo por segundo e o servidor salva, junto com o lado dele, em
// data/telemetria (um .jsonl por gravação). Serve para achar de onde vêm as travadas: aparelho, rede ou servidor.

export const TELEMETRY_MAX_MIN = 30;
// Partes do quadro medidas no cliente (pior quadro de cada uma no segundo, em ms).
export const FRAME_PARTS = ['simulacao', 'cena', 'desenho', 'interface', 'mapas', 'nomes',
  // pedaços da simulação: toque e controle, o passo da previsão (o mundo e a comparação com o servidor), o resto da
  // sessão (flechas, golpes, eventos), sons e efeitos, partículas, câmera e afins
  'sim_entrada', 'sim_mundo', 'sim_comparacao', 'sim_sessao', 'sim_efeitos', 'sim_particulas', 'sim_resto',
  // fora do quadro: processar um snapshot que chegou (inclui refazer a previsão)
  'rede_snapshot'] as const;
export type FramePart = typeof FRAME_PARTS[number];

export interface TelemetryDevice { ua: string; screen: string; dpr: number; app: boolean; net: string; version: string }
export interface TelemetrySample {
  fps: number; worst: number; js: number;       // quadros por segundo, pior quadro e pior tempo do nosso código (ms)
  slow: number; catchUp: number;                // quadros acima de 50 ms; quadros que correram 3 passos ou mais
  parts: Partial<Record<FramePart, number>>;
  gap: number; snaps: number; delay: number;    // rede: maior intervalo entre snapshots (ms), quantos chegaram, atraso da cena (ms)
  ahead: number; frozen: number;                // quadros com monstros seguindo o rumo / parados (sem snapshot novo)
  replays: number; pending: number;             // passos refeitos ao corrigir a previsão (soma no segundo) e o maior lote
  ev: string[];                                 // o que aconteceu neste segundo (ataque, acerto, marca, mapa, segundo plano…)
}
export type TelemetryMsg = { start: { minutes: number; device: TelemetryDevice } } | { sample: TelemetrySample } | { stop: true };

// Vem de fora: números presos numa faixa, textos curtos, o resto vira null.
const num = (v: unknown, max = 1e6) => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.round(v * 10) / 10)) : 0;
const str = (v: unknown, max: number) => typeof v === 'string' ? v.slice(0, max) : '';
export function decodeTelemetry(m: unknown): TelemetryMsg | null {
  if (!m || typeof m !== 'object') return null;
  const o = m as Record<string, unknown>;
  if (o.stop === true) return { stop: true };
  if (o.start && typeof o.start === 'object') {
    const s = o.start as Record<string, unknown>, d = (s.device ?? {}) as Record<string, unknown>;
    const minutes = Number(s.minutes);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > TELEMETRY_MAX_MIN) return null;
    return { start: { minutes, device: { ua: str(d.ua, 300), screen: str(d.screen, 40), dpr: num(d.dpr, 10), app: d.app === true, net: str(d.net, 40), version: str(d.version, 60) } } };
  }
  if (o.sample && typeof o.sample === 'object') {
    const s = o.sample as Record<string, unknown>, p = (s.parts ?? {}) as Record<string, unknown>;
    const parts: Partial<Record<FramePart, number>> = {};
    for (const k of FRAME_PARTS) if (k in p) parts[k] = num(p[k]);
    const ev = Array.isArray(s.ev) ? s.ev.slice(0, 20).map(e => str(e, 32)).filter(Boolean) : [];
    return { sample: { fps: num(s.fps, 1000), worst: num(s.worst), js: num(s.js), slow: num(s.slow, 1000), catchUp: num(s.catchUp, 1000), parts,
      gap: num(s.gap), snaps: num(s.snaps, 1000), delay: num(s.delay), ahead: num(s.ahead, 1000), frozen: num(s.frozen, 1000),
      replays: num(s.replays, 1e5), pending: num(s.pending, 1000), ev } };
  }
  return null;
}
