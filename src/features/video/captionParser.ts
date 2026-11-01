/** Extract subtitle text while retaining cue start times for chapter-aware summaries. */
export function parseCaptions(value: string): string {
  const blocks = value.replace(/^\uFEFF?WEBVTT[^\n]*\n?/i, '').split(/\r?\n\s*\r?\n/);
  const cues: string[] = [];
  for (const block of blocks) {
    const lines = block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const timeIndex = lines.findIndex((line) => /^(?:\d{2}:)?\d{2}:\d{2}[.,]\d{3}\s+-->/.test(line));
    if (timeIndex < 0) continue;
    const rawTime = lines[timeIndex].split(/\s+-->\s+/)[0].replace(',', '.');
    const timestamp = rawTime.replace(/^(\d{2}:)?(\d{2}:\d{2})\.(\d{3})$/, (match, hours, minutes) => hours ? match : `00:${minutes}.${match.slice(-3)}`);
    const text = lines.slice(timeIndex + 1).join(' ').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
    if (text) cues.push(`[${timestamp}] ${text}`);
  }
  // Plain text transcripts have no cue blocks; retain their original lines.
  if (!cues.length) return value.replace(/^\uFEFF?WEBVTT[^\n]*\n?/i, '').split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !/^\d+$/.test(line) && !/^(STYLE|REGION|NOTE)\s*$/.test(line)).join('\n');
  return cues.join('\n');
}
