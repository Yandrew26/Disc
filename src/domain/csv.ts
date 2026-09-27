// Parses pasted roster CSV ("name,email" per line, optional header row).
// ponytail: two-column split with quote handling, not a general CSV parser —
// covers Google Sheets copy-paste; swap in a real parser if columns multiply.
export type RosterImportRow = { name: string; email: string };

function splitLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { cells.push(cur); cur = ""; }
    else cur += ch;
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
}

export function parseRosterCsv(text: string): RosterImportRow[] {
  const rows: RosterImportRow[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    if (!rawLine.trim()) continue;
    const [name, email] = splitLine(rawLine);
    if (!email || !email.includes("@")) continue; // skips header row and malformed lines
    rows.push({ name: name ?? "", email: email.toLowerCase() });
  }
  return rows;
}
