// Scoring for the citation evaluation. Pure functions, so they are unit-tested
// without calling an LLM.

export interface EvalCitation {
  index: number;
  title?: string;
  section?: string;
  is_main_paper?: boolean;
}

export interface PaperSpec {
  aliases: string[];
  titleKeywords: string[];
}

export interface CitationCheck {
  marker: number;
  correct: boolean;
  pointsTo: string;
  name?: string;
}

const norm = (s: string | undefined) => (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Unique citation numbers in order of first appearance, e.g. "a [2][1] b [2]" -> [2, 1]. */
export function citedNumbers(answer: string): number[] {
  const seen: number[] = [];
  for (const m of answer.matchAll(/\[(\d+)\]/g)) {
    const n = Number(m[1]);
    if (!seen.includes(n)) seen.push(n);
  }
  return seen;
}

export function sectionMatches(section: string | undefined, acceptable: string[]): boolean {
  const s = norm(section);
  if (!s) return false;
  return acceptable.some((a) => {
    const t = norm(a);
    return s.includes(t) || t.includes(s);
  });
}

export function describe(c: EvalCitation | undefined): string {
  if (!c) return "missing citation";
  return c.is_main_paper ? `main paper › ${c.section ?? "?"}` : `external › ${c.title ?? "?"}`;
}

/**
 * Section precision: of the main-paper citations in the answer, how many point to
 * a section that actually covers the question.
 */
export function scoreSections(answer: string, citations: EvalCitation[], acceptable: string[]): CitationCheck[] {
  return citedNumbers(answer)
    .map((n) => ({ n, c: citations.find((x) => x.index === n) }))
    .filter(({ c }) => c?.is_main_paper)
    .map(({ n, c }) => ({ marker: n, correct: sectionMatches(c!.section, acceptable), pointsTo: describe(c) }));
}

/**
 * Named-citation accuracy: when the answer names another paper and puts a citation
 * right after it ("GLNet [5]"), does that citation point to the named paper itself,
 * or to a main-paper section that discusses it?
 */
export function scoreNamedCitations(
  answer: string,
  citations: EvalCitation[],
  papers: Record<string, PaperSpec>,
  names: string[],
  acceptableSections: string[]
): CitationCheck[] {
  const checks: CitationCheck[] = [];
  const counted = new Set<string>();

  for (const name of names) {
    const spec = papers[name];
    if (!spec) continue;
    // Longest aliases first so "DeepLabv3+" is preferred over "DeepLab".
    const aliases = [...spec.aliases].sort((a, b) => b.length - a.length);
    for (const alias of aliases) {
      const re = new RegExp(`(?<![A-Za-z])${escapeRegex(alias)}(?![A-Za-z])[^\\[\\]\\n.;]{0,15}((?:\\s*\\[\\d+\\])+)`, "gi");
      for (const m of answer.matchAll(re)) {
        const at = `${name}@${m.index}`;
        const markerStart = (m.index ?? 0) + m[0].length - m[1].length;
        const key = `${markerStart}`;
        if (counted.has(key) || counted.has(at)) continue;
        counted.add(key);
        counted.add(at);
        for (const nm of m[1].matchAll(/\[(\d+)\]/g)) {
          const n = Number(nm[1]);
          const c = citations.find((x) => x.index === n);
          const title = norm(c?.title);
          const isNamedPaper = !!c && !c.is_main_paper && spec.titleKeywords.some((k) => title.includes(norm(k)));
          const isDiscussingSection = !!c?.is_main_paper && sectionMatches(c.section, acceptableSections);
          checks.push({ marker: n, name, correct: isNamedPaper || isDiscussingSection, pointsTo: describe(c) });
        }
      }
    }
  }
  return checks;
}

export const ratio = (checks: { correct: boolean }[]) =>
  checks.length ? checks.filter((c) => c.correct).length / checks.length : null;

export const pct = (r: number | null) => (r === null ? "n/a" : `${(r * 100).toFixed(1)}%`);
