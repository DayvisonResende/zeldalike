import { describe, expect, it } from 'vitest';
import { filterChat } from '../src/chat/filter';

describe('filtro de palavrões', () => {
  it('troca a palavra inteira por asteriscos, sem acento, maiúscula ou troca por número', () => {
    expect(filterChat('Que PORRA é essa')).toBe('Que ***** é essa');
    expect(filterChat('p0rr4!')).toBe('*****!');
    expect(filterChat('foda-se')).toBe('****-**');
  });
  it('não pega palavras que só contêm um pedaço', () => {
    expect(filterChat('a curva do cume')).toBe('a curva do cume');
    expect(filterChat('computador')).toBe('computador');
  });
  it('aceita palavras a mais do config', () => {
    expect(filterChat('isso é chato', ['chato'])).toBe('isso é *****');
  });
});
