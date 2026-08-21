import { chunkText } from './chunking.util';

describe('chunkText', () => {
  it('is deterministic: the same input always produces the same chunks', () => {
    const content = 'a'.repeat(2500);
    const first = chunkText(content, 1000, 150);
    const second = chunkText(content, 1000, 150);
    expect(first).toEqual(second);
  });

  it('preserves document order via array order (chunkIndex is the caller-assigned position)', () => {
    const content = '111'.repeat(400) + '222'.repeat(400) + '333'.repeat(400);
    const chunks = chunkText(content, 500, 0);
    expect(chunks[0]).toContain('111');
    expect(chunks[chunks.length - 1]).toContain('333');
  });

  it('skips empty content entirely', () => {
    expect(chunkText('', 1000, 150)).toEqual([]);
    expect(chunkText('   \n\n  ', 1000, 150)).toEqual([]);
  });

  it('produces overlapping chunks when overlap > 0', () => {
    const content = 'x'.repeat(1200);
    const chunks = chunkText(content, 1000, 200);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    // last 200 chars of chunk 1 should reappear at the start of chunk 2
    const tailOfFirst = chunks[0].slice(-50);
    expect(chunks[1]).toContain(tailOfFirst);
  });

  it('produces a single chunk when content is shorter than chunkSize', () => {
    const chunks = chunkText('short content', 1000, 150);
    expect(chunks).toEqual(['short content']);
  });

  it('never produces a zero-length chunk', () => {
    const content = 'word '.repeat(500);
    const chunks = chunkText(content, 300, 50);
    for (const chunk of chunks) {
      expect(chunk.length).toBeGreaterThan(0);
    }
  });
});
