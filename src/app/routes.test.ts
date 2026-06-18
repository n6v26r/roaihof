import { describe, expect, it } from 'vitest';
import { parseRoute } from './routes';

describe('route parsing', () => {
  it('keeps contest family routes separate from scoreboards', () => {
    expect(parseRoute('/contests/roai')).toEqual({ name: 'contest-family', family: 'ROAI' });
    expect(parseRoute('/contests/ioai')).toEqual({ name: 'contest-family', family: 'IOAI' });
  });

  it('keeps old contest ids compatible with scoreboard pages', () => {
    expect(parseRoute('/contests/roai-2026-national-ix-x')).toEqual({ name: 'scoreboard', id: 'roai-2026-ix-x' });
    expect(parseRoute('/contests/onia-2026-nationala')).toEqual({ name: 'scoreboard', id: 'onia-2026-nationala-full' });
  });
});
