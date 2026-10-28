// Citation evaluation for RefHunters.
//
// Runs every question in eval/questions.json through the full agent pipeline
// (A0 → A1 → A2) and measures:
//   - section precision: main-paper citations that point to a section covering the question
//   - named-citation accuracy: in comparison answers, citations attached to a named paper
//     ("GLNet [5]") that point to that paper or to a section discussing it
//   - external usage: comparison answers that cite at least one downloaded paper
//
// Usage: npm run eval -- <paper.pdf> [--only Q01,C02] [--label baseline]
// Each run writes eval/results/<label>-<timestamp>.json and .md
import "dotenv/config";
import fs from "fs";
import path from "path";
import { runA0 } from "../agents/a0/a0";
import { getLLMConfig } from "../llm/config";
import {
  CitationCheck,
  EvalCitation,
  PaperSpec,
  citedNumbers,
  pct,
  ratio,
  scoreNamedCitations,
  scoreSections,
} from "./scoring";

interface Question {
  id: string;
  type: "in-paper" | "comparison";
  question: string;
  expected: string;
  acceptableSections: string[];
  namedPapers?: string[];
}

interface QuestionResult {
  id: string;
  type: Question["type"];
  question: string;
  seconds: number;
  error?: string;
  answer?: string;
  citations?: EvalCitation[];
  sectionChecks: CitationCheck[];
  namedChecks: CitationCheck[];
  externalCited: boolean;
}

function parseArgs(argv: string[]) {
  const args = { pdf: "", only: [] as string[], label: "run" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--only") args.only = argv[++i].split(",").map((s) => s.trim());
    else if (argv[i] === "--label") args.label = argv[++i];
    else if (!args.pdf) args.pdf = argv[i];
  }
  return args;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.pdf || !fs.existsSync(args.pdf)) {
    console.error("Usage: npm run eval -- <paper.pdf> [--only Q01,C02] [--label baseline]");
    process.exit(1);
  }

  const evalDir = path.resolve(__dirname, "../../eval");
  const spec = JSON.parse(fs.readFileSync(path.join(evalDir, "questions.json"), "utf8")) as {
    papers: Record<string, PaperSpec>;
    questions: Question[];
  };
  const questions = spec.questions.filter((q) => !args.only.length || args.only.includes(q.id));
  const delayMs = Number(process.env.EVAL_DELAY_MS ?? 15000);
  const llm = getLLMConfig();

  console.log(`Evaluating ${questions.length} questions · ${llm.provider} ${llm.models.fast} · delay ${delayMs} ms\n`);

  const results: QuestionResult[] = [];
  for (const [i, q] of questions.entries()) {
    console.log(`[${i + 1}/${questions.length}] ${q.id} ${q.question}`);
    const started = Date.now();
    const base = { id: q.id, type: q.type, question: q.question, sectionChecks: [], namedChecks: [], externalCited: false };

    // Agent logs are noisy; keep them out of the evaluation output.
    const originalLog = console.log;
    console.log = () => {};
    try {
      const res: any = await runA0({
        sessionId: `eval-${q.id}-${Date.now()}`,
        userInput: q.question,
        sources: [path.resolve(args.pdf)],
        expertise: "intermediate",
        format: "markdown",
      });
      console.log = originalLog;

      const answer: string = res.answer ?? "";
      const citations: EvalCitation[] = (res.citations ?? []).map((c: any) => ({
        index: c.index,
        title: c.title,
        section: c.section,
        is_main_paper: c.is_main_paper,
      }));
      const used = new Set(citedNumbers(answer));
      const result: QuestionResult = {
        ...base,
        seconds: (Date.now() - started) / 1000,
        error: res.status === "error" ? res.error : undefined,
        answer,
        citations,
        sectionChecks: scoreSections(answer, citations, q.acceptableSections),
        namedChecks: q.namedPapers
          ? scoreNamedCitations(answer, citations, spec.papers, q.namedPapers, q.acceptableSections)
          : [],
        externalCited: citations.some((c) => !c.is_main_paper && used.has(c.index)),
      };
      results.push(result);
      console.log(
        `   sections ${pct(ratio(result.sectionChecks))}` +
          (q.type === "comparison"
            ? ` · named ${pct(ratio(result.namedChecks))} (${result.namedChecks.length}) · external ${result.externalCited ? "yes" : "no"}`
            : "") +
          ` · ${result.seconds.toFixed(0)}s`
      );
    } catch (err) {
      console.log = originalLog;
      results.push({ ...base, seconds: (Date.now() - started) / 1000, error: String(err) });
      console.log(`   ERROR ${String(err).slice(0, 200)}`);
    }
    if (i < questions.length - 1) await sleep(delayMs);
  }

  writeReport(results, args.label, `${llm.provider}/${llm.models.fast}`, evalDir);
}

function writeReport(results: QuestionResult[], label: string, model: string, evalDir: string) {
  const ok = results.filter((r) => !r.error);
  const inPaper = ok.filter((r) => r.type === "in-paper");
  const comparison = ok.filter((r) => r.type === "comparison");
  const all = (rs: QuestionResult[], k: "sectionChecks" | "namedChecks") => rs.flatMap((r) => r[k]);

  const summary = {
    label,
    model,
    date: new Date().toISOString(),
    questions: results.length,
    errors: results.length - ok.length,
    sectionPrecision: { inPaper: ratio(all(inPaper, "sectionChecks")), comparison: ratio(all(comparison, "sectionChecks")) },
    namedCitationAccuracy: ratio(all(comparison, "namedChecks")),
    namedCitations: all(comparison, "namedChecks").length,
    externalUsage: comparison.length ? comparison.filter((r) => r.externalCited).length / comparison.length : null,
  };

  const stamp = summary.date.replace(/[:.]/g, "-").slice(0, 19);
  const outDir = path.join(evalDir, "results");
  fs.mkdirSync(outDir, { recursive: true });
  const base = path.join(outDir, `${label}-${stamp}`);
  fs.writeFileSync(`${base}.json`, JSON.stringify({ summary, results }, null, 2));

  const lines = [
    `# Citation evaluation: ${label}`,
    "",
    `Model: ${model} · ${summary.date} · ${summary.questions} questions, ${summary.errors} errors`,
    "",
    "| Metric | Value |",
    "|---|---|",
    `| Section precision, in-paper questions | ${pct(summary.sectionPrecision.inPaper)} |`,
    `| Section precision, comparison questions | ${pct(summary.sectionPrecision.comparison)} |`,
    `| Named-citation accuracy (${summary.namedCitations} citations) | ${pct(summary.namedCitationAccuracy)} |`,
    `| Comparison answers citing a downloaded paper | ${pct(summary.externalUsage)} |`,
    "",
    "## Per question",
    "",
    "| ID | Sections | Named | External | Time |",
    "|---|---|---|---|---|",
    ...results.map((r) =>
      r.error
        ? `| ${r.id} | error | | | ${r.seconds.toFixed(0)}s |`
        : `| ${r.id} | ${pct(ratio(r.sectionChecks))} | ${r.type === "comparison" ? pct(ratio(r.namedChecks)) : ""} | ${r.type === "comparison" ? (r.externalCited ? "yes" : "no") : ""} | ${r.seconds.toFixed(0)}s |`
    ),
    "",
    "## Wrong citations",
    "",
    ...results.flatMap((r) =>
      [...r.namedChecks, ...r.sectionChecks]
        .filter((c) => !c.correct)
        .map((c) => `- ${r.id} [${c.marker}]${c.name ? ` after "${c.name}"` : ""} → ${c.pointsTo}`)
    ),
  ];
  fs.writeFileSync(`${base}.md`, lines.join("\n") + "\n");

  console.log("\n" + lines.slice(4, 10).join("\n"));
  console.log(`\nSaved ${path.relative(process.cwd(), base)}.md and .json`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
