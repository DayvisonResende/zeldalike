import { describe, expect, it } from 'vitest';
import { decodeTelemetry } from '../src';

describe('telemetria do /debug', () => {
  it('início: minutos de 1 a 30, textos cortados', () => {
    expect(decodeTelemetry({ start: { minutes: 5, device: { ua: 'x'.repeat(500), app: true } } })).toMatchObject({ start: { minutes: 5, device: { app: true, net: '' } } });
    expect((decodeTelemetry({ start: { minutes: 5, device: { ua: 'x'.repeat(500) } } }) as { start: { device: { ua: string } } }).start.device.ua).toHaveLength(300);
    expect(decodeTelemetry({ start: { minutes: 0 } })).toBeNull();
    expect(decodeTelemetry({ start: { minutes: 31 } })).toBeNull();
    expect(decodeTelemetry({ start: { minutes: 1.5 } })).toBeNull();
  });
  it('resumo: números presos numa faixa, só as partes conhecidas, no máximo 20 eventos', () => {
    const m = decodeTelemetry({ sample: { fps: -3, worst: Infinity, js: 'muito', parts: { desenho: 12.345, hacker: 1 }, ev: [...Array(30).keys()].map(String), gap: 1e9 } });
    expect(m).toMatchObject({ sample: { fps: 0, worst: 0, js: 0, parts: { desenho: 12.3 }, gap: 1e6 } });
    expect((m as { sample: { parts: object; ev: string[] } }).sample.parts).not.toHaveProperty('hacker');
    expect((m as { sample: { ev: string[] } }).sample.ev).toHaveLength(20);
  });
  it('parar e lixo', () => {
    expect(decodeTelemetry({ stop: true })).toEqual({ stop: true });
    expect(decodeTelemetry(null)).toBeNull();
    expect(decodeTelemetry('oi')).toBeNull();
    expect(decodeTelemetry({ stop: 'sim' })).toBeNull();
  });
});
