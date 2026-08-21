/**
 * Deterministic chunking (Phase 19 §17): fixed chunk size + overlap in
 * characters, document order preserved via chunkIndex, empty chunks
 * skipped. No random boundaries, no unexplained magic numbers — chunkSize/
 * overlap come from AiConfig (AI_CHUNK_SIZE/AI_CHUNK_OVERLAP).
 */
export function chunkText(
  content: string,
  chunkSize: number,
  overlap: number,
): string[] {
  const normalized = content.replace(/\r\n/g, '\n').trim();
  if (!normalized) {
    return [];
  }

  const chunks: string[] = [];
  const step = Math.max(chunkSize - overlap, 1);
  for (let start = 0; start < normalized.length; start += step) {
    const chunk = normalized.slice(start, start + chunkSize).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }
    if (start + chunkSize >= normalized.length) {
      break;
    }
  }
  return chunks;
}
