/** Streaming CSV row reader: handles quoted fields, escaped quotes and newlines inside quotes, across chunks. */
export async function* csvRows(stream: ReadableStream<Uint8Array>): AsyncGenerator<string[]> {
  const reader = stream.pipeThrough(new TextDecoderStream()).getReader();
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  let pendingQuote = false; // saw a quote inside quotes; next char decides
  let lastWasCR = false;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    const s = value as unknown as string;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (inQuotes) {
        if (pendingQuote) {
          pendingQuote = false;
          if (c === '"') { field += '"'; continue; }
          inQuotes = false; // closing quote; fall through to handle c normally
        } else if (c === '"') { pendingQuote = true; continue; }
        else { field += c; continue; }
      }
      if (c === '"' && field === '') { inQuotes = true; lastWasCR = false; continue; }
      if (c === ',') { row.push(field); field = ''; lastWasCR = false; continue; }
      if (c === '\r') { row.push(field); field = ''; yield row; row = []; lastWasCR = true; continue; }
      if (c === '\n') {
        if (lastWasCR) { lastWasCR = false; continue; }
        row.push(field); field = ''; yield row; row = []; continue;
      }
      lastWasCR = false;
      field += c;
    }
  }
  if (pendingQuote) inQuotes = false;
  if (field !== '' || row.length) { row.push(field); yield row; }
}
