// The grounding check: AI-written statements must not contain figures, quotes or dates that aren't in the retrieved text.
// Statements that fail are removed (and counted on the card), never "fixed" by guessing.

/** Figures in a statement: 1.2, 1,200, 45%, $3bn → "1.2", "1200", "45", "3" (years included) */
export function figures(s: string) {
  return (s.match(/\d[\d,]*(?:\.\d+)?/g) ?? [])
    .map((n) => n.replace(/,/g, "").replace(/\.0+$/, ""))
    .filter((n) => n.length > 1 || Number(n) >= 10); // single digits ("3 banks", "2 reasons") are too ambiguous to check
}

const norm = (s: string) => s.replace(/(\d),(?=\d{3}\b)/g, "$1").replace(/\s+/g, " ").toLowerCase();

/** Every figure appears in the sources, and any quoted phrase of 4+ words appears verbatim */
export function supported(statement: string, sourceText: string) {
  const src = norm(sourceText);
  for (const f of figures(statement)) {
    const re = new RegExp(`(^|[^\\d.])${f.replace(".", "\\.")}(?![\\d])`);
    if (!re.test(src)) return false;
  }
  for (const q of statement.match(/[“"]([^”"]{12,})[”"]/g) ?? []) {
    const inner = norm(q.slice(1, -1));
    if (inner.split(" ").length >= 4 && !src.includes(inner)) return false;
  }
  return true;
}

/** Split after . ! ? followed by a space, so decimals like 9.25 stay whole */
export const sentences = (s: string) => s.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean);

/** Keep only supported sentences of a paragraph. Returns the text and how many were removed. */
export function groundParagraph(text: string, sourceText: string) {
  let removed = 0;
  const kept = sentences(text).filter((x) => (supported(x, sourceText) ? true : (removed++, false)));
  return { text: kept.join(" "), removed };
}

export function groundList(list: string[], sourceText: string) {
  let removed = 0;
  const kept = list.filter((x) => (supported(x, sourceText) ? true : (removed++, false)));
  return { list: kept, removed };
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/** An event date is kept only when the sources state that day (e.g. "October 9", "9 October" or 2026-10-09) */
export function eventDateSupported(day: string, sourceText: string) {
  const m = day.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const src = sourceText.toLowerCase();
  const d = Number(m[3]);
  const month = MONTHS[Number(m[2]) - 1];
  const mon = month.slice(0, 3);
  return src.includes(day) || new RegExp(`\\b(${month}|${mon}\\.?)\\s+${d}\\b|\\b${d}(st|nd|rd|th)?\\s+(${month}|${mon})\\b`).test(src);
}
