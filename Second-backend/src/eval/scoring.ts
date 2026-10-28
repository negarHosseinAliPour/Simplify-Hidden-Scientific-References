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

/** Split an answer into sentences and bullet lines, keeping citation markers with their sentence. */
export function splitSentences(answer: string): string[] {
  return answer
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?](?:\s*\[\d+\])*)\s+(?=[A-Z*])/))
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Named-citation accuracy: for every sentence that names another paper and carries
 * citations, do they point to that paper or to a main-paper section discussing it?
 *
 * - If citations follow the name directly ("GLNet [5]"), all of them must be valid.
 *   This catches the paper's own reference numbers being reused as evidence IDs.
 * - Otherwise at least one citation in the sentence must be valid.
 */
export function scoreNamedCitations(
  answer: string,
  citations: EvalCitation[],
  papers: Record<string, PaperSpec>,
  names: string[],
  acceptableSections: string[]
): CitationCheck[] {
  const checks: CitationCheck[] = [];

  const valid = (n: number, spec: PaperSpec) => {
    const c = citations.find((x) => x.index === n);
    const title = norm(c?.title);
    const isNamedPaper = !!c && !c.is_main_paper && spec.titleKeywords.some((k) => title.includes(norm(k)));
    const isDiscussingSection = !!c?.is_main_paper && sectionMatches(c.section, acceptableSections);
    return { ok: isNamedPaper || isDiscussingSection, pointsTo: describe(c) };
  };

  for (const sentence of splitSentences(answer)) {
    const sentenceMarkers = [...sentence.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]));
    if (!sentenceMarkers.length) continue;

    for (const name of names) {
      const spec = papers[name];
      if (!spec) continue;
      const aliases = [...spec.aliases].sort((a, b) => b.length - a.length);
      const aliasRe = (a: string) => `(?<![A-Za-z])${escapeRegex(a)}(?![A-Za-z])`;
      if (!aliases.some((a) => new RegExp(aliasRe(a), "i").test(sentence))) continue;

      // Citations written right after the name, e.g. "GLNet [5]" or "FCN-8s [21]".
      const immediate: number[] = [];
      for (const a of aliases) {
        const re = new RegExp(`${aliasRe(a)}[^\\[\\]\\n.;]{0,15}((?:\\s*\\[\\d+\\])+)`, "gi");
        for (const m of sentence.matchAll(re)) {
          for (const nm of m[1].matchAll(/\[(\d+)\]/g)) {
            const n = Number(nm[1]);
            if (!immediate.includes(n)) immediate.push(n);
          }
        }
      }

      if (immediate.length) {
        for (const n of immediate) {
          const v = valid(n, spec);
          checks.push({ marker: n, name, correct: v.ok, pointsTo: v.pointsTo });
        }
      } else {
        const results = sentenceMarkers.map((n) => ({ n, ...valid(n, spec) }));
        const hit = results.find((r) => r.ok);
        const shown = hit ?? results[0];
        checks.push({ marker: shown.n, name, correct: !!hit, pointsTo: shown.pointsTo });
      }
    }
  }
  return checks;
}

export const ratio = (checks: { correct: boolean }[]) =>
  checks.length ? checks.filter((c) => c.correct).length / checks.length : null;

export const pct = (r: number | null) => (r === null ? "n/a" : `${(r * 100).toFixed(1)}%`);
