import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  EvalCitation,
  citedNumbers,
  ratio,
  scoreNamedCitations,
  scoreSections,
  sectionMatches,
} from "../src/eval/scoring";

const spec = JSON.parse(readFileSync(path.join(__dirname, "../eval/questions.json"), "utf8"));

// A real answer RefHunters produced for question C06 before the citation fix.
const answer = `MagNet differs in several key ways:
* **Global-Local Networks (GLNet) [5]:** GLNet combines a global branch and a local branch [2][6].
* **PointRend [7]:** its performance drops when the number of points increases [8].
* **Single-Pass Methods (e.g., FCN [9], SegNet [10], DeepLab [11], FPN [12], RefineNet [13]):** they rely on lossy downsampling (such as FPN's scale aggregation) [2][6][13].`;

const main = (index: number, section: string): EvalCitation => ({ index, section, is_main_paper: true, title: "Progressive Semantic Segmentation" });
const ext = (index: number, title: string): EvalCitation => ({ index, title, is_main_paper: false });

const citations: EvalCitation[] = [
  main(2, "Introduction"),
  main(5, "Downsample X s"),
  main(6, "Related Work"),
  main(7, "Benefits of multiple scale levels"),
  main(8, "Ablation study: point selection"),
  ext(9, "Collaborative global-local networks for memory-efficient segmentation of ultra-high resolution images"),
  ext(10, "SegNet: A Deep Convolutional Encoder-Decoder Architecture for Image Segmentation"),
  main(11, "Multi-stage processing pipeline"),
  main(12, "Experiments on the Cityscapes dataset"),
  ext(13, "RefineNet: Multi-path Refinement Networks for High-Resolution Semantic Segmentation"),
];

describe("citedNumbers", () => {
  it("lists unique citation numbers in order of appearance", () => {
    expect(citedNumbers("a [2][1] b [2] c [10]")).toEqual([2, 1, 10]);
  });
});

describe("sectionMatches", () => {
  it("matches section names case-insensitively in either direction", () => {
    expect(sectionMatches("Ablation study: point selection", ["ablation study: point selection"])).toBe(true);
    expect(sectionMatches("grade lesions on ultra-high-resolution images.", ["grade lesions"])).toBe(true);
    expect(sectionMatches("Training.", ["Training"])).toBe(true);
    expect(sectionMatches("Downsample X s", ["Related Work"])).toBe(false);
    expect(sectionMatches(undefined, ["Abstract"])).toBe(false);
  });
});

describe("scoreNamedCitations on a real answer with the numbering bug", () => {
  const q = spec.questions.find((x: any) => x.id === "C06");
  const checks = scoreNamedCitations(answer, citations, spec.papers, q.namedPapers, q.acceptableSections);
  const byName = Object.fromEntries(checks.map((c) => [c.name, c.correct]));

  it("finds each named paper followed by a citation", () => {
    expect(checks.map((c) => c.name).sort()).toEqual(
      ["DeepLab", "FCN", "FPN", "GLNet", "PointRend", "RefineNet", "SegNet"].sort()
    );
  });

  it("marks citations that point to the named paper as correct", () => {
    expect(byName.SegNet).toBe(true);
    expect(byName.RefineNet).toBe(true);
  });

  it("catches citations that point to an unrelated section or the wrong paper", () => {
    expect(byName.GLNet).toBe(false); // → "Downsample X s"
    expect(byName.PointRend).toBe(false); // → "Benefits of multiple scale levels"
    expect(byName.FCN).toBe(false); // → the GLNet paper
    expect(byName.DeepLab).toBe(false);
    expect(byName.FPN).toBe(false);
  });

  it("scores 2 of 7 named citations as correct", () => {
    expect(ratio(checks)).toBeCloseTo(2 / 7);
  });
});

describe("scoreSections", () => {
  it("only scores main-paper citations, against the acceptable sections", () => {
    const checks = scoreSections("x [2] y [5] z [10]", citations, ["Introduction", "Related Work"]);
    expect(checks.map((c) => [c.marker, c.correct])).toEqual([
      [2, true],
      [5, false],
    ]);
  });
});

describe("questions.json", () => {
  it("only names papers that are defined, and every question has acceptable sections", () => {
    for (const q of spec.questions) {
      expect(q.acceptableSections.length).toBeGreaterThan(0);
      for (const name of q.namedPapers ?? []) expect(spec.papers[name], `${q.id} ${name}`).toBeDefined();
    }
  });
});
