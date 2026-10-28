/**
 * Bibliography references inside paper text.
 *
 * Papers cite their own references as "[5]", which is also the format the answer
 * agent uses to cite evidence chunks. When the model copied "GLNet [5]" from the
 * paper, the 5 was read as evidence chunk 5, so the citation pointed to an
 * unrelated part of the paper. These helpers rewrite the paper's own references
 * into a form that cannot be confused with evidence IDs.
 */

const clean = (s: string) =>
  s
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

/** Short labels for every <biblStruct xml:id="bN">, e.g. b4 → 'Chen 2019, "Collaborative Global-Local Networks…"'. */
export function bibliographyLabels(xml: string): Map<string, string> {
  const labels = new Map<string, string>();
  for (const m of xml.matchAll(/<biblStruct[^>]*xml:id="(b\d+)"[^>]*>([\s\S]*?)<\/biblStruct>/g)) {
    const [, id, body] = m;
    const title =
      clean(body.match(/<title[^>]*level="a"[^>]*>([\s\S]*?)<\/title>/)?.[1] ?? "") ||
      clean(body.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1] ?? "");
    const surname = clean(body.match(/<surname[^>]*>([\s\S]*?)<\/surname>/)?.[1] ?? "");
    const year = body.match(/<date[^>]*when="(\d{4})/)?.[1] ?? "";
    const shortTitle = title.length > 60 ? `${title.slice(0, 57).trimEnd()}…` : title;
    const who = [surname, year].filter(Boolean).join(" ");
    labels.set(id, [who, shortTitle ? `"${shortTitle}"` : ""].filter(Boolean).join(", ") || id);
  }
  return labels;
}

/**
 * Replace GROBID reference elements with readable labels before tags are stripped:
 *   <ref type="bibr" target="#b4">[5]</ref>  →  (ref: Chen 2019, "Collaborative Global-Local Networks…")
 *   <ref type="bibr">[3, 11]</ref>           →  (ref 3, 11)
 */
export function resolveBibRefs(fragment: string, labels: Map<string, string>): string {
  return fragment.replace(/<ref\b[^>]*type="bibr"[^>]*>([\s\S]*?)<\/ref>/g, (whole, inner: string) => {
    const target = whole.match(/target="#(b\d+)"/)?.[1];
    const label = target ? labels.get(target) : undefined;
    if (label) return ` (ref: ${label}) `;
    const numbers = clean(inner).replace(/[[\]]/g, "").trim();
    return numbers ? ` (ref ${numbers}) ` : " ";
  });
}

/**
 * Safety net for any text that still contains numeric references (e.g. text
 * extracted without GROBID, or downloaded papers): "[5]" → "(ref 5)", "[3, 11]" → "(ref 3, 11)".
 */
export function neutralizeNumericRefs(text: string): string {
  return text.replace(/\[(\d+(?:\s*[,–-]\s*\d+)*)\]/g, "(ref $1)");
}
