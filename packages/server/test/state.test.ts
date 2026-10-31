import { describe, expect, it } from 'vitest';
import { openDatabase } from '../src/persistence/db';
import { loadDay, saveDay } from '../src/persistence/state';
import { clockText } from '../src/chat/commands';

describe('hora do mundo no banco', () => {
  it('começa sem hora guardada e devolve a última gravada', async () => {
    const db = await openDatabase(':memory:');
    expect(await loadDay(db)).toBeNull();
    await saveDay(db, 0.25);
    await saveDay(db, 0.75);
    expect(await loadDay(db)).toBe(0.75);
  });
  it('mostra a hora como relógio', () => {
    expect(clockText(18.5)).toBe('18:30');
    expect(clockText(0)).toBe('00:00');
    expect(clockText(23.999)).toBe('23:59');
  });
});
