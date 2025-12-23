export function formatAsBulletPoints(text: string | undefined | null): string[] {
  if (!text) return [];
  
  const lines = text
    .split(/[\n\r]+/)
    .map(line => line.trim())
    .filter(line => line.length > 0);
  
  if (lines.length === 0) return [];
  
  if (lines.length === 1) {
    const sentences = lines[0]
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    if (sentences.length > 1) {
      return sentences;
    }
    return [lines[0]];
  }
  
  return lines.map(line => {
    return line.replace(/^[-•*]\s*/, '');
  });
}
