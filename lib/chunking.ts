export function estimateTokens(text: string): number {
  // Simple heuristic ~ 4 chars per token
  return Math.ceil(text.length / 4);
}

export function chunkTextByParagraphs(text: string, targetTokens = 1800, overlapTokens = 180): string[] {
  const paragraphs = text.split(/\n{2,}/);
  const chunks: string[] = [];
  let current: string[] = [];
  let currentTokens = 0;

  for (const p of paragraphs) {
    const t = estimateTokens(p);
    if (currentTokens + t > targetTokens && current.length > 0) {
      chunks.push(current.join("\n\n"));
      // Build overlap
      let overlap: string[] = [];
      let overlapSum = 0;
      for (let i = current.length - 1; i >= 0 && overlapSum < overlapTokens; i--) {
        const pt = estimateTokens(current[i]);
        overlap.unshift(current[i]);
        overlapSum += pt;
      }
      current = [...overlap, p];
      currentTokens = estimateTokens(current.join("\n\n"));
    } else {
      current.push(p);
      currentTokens += t;
    }
  }

  if (current.length > 0) {
    chunks.push(current.join("\n\n"));
  }

  return chunks;
}


