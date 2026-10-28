import { readFileSync } from "fs";
import path from "path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { bibliographyLabels, neutralizeNumericRefs, resolveBibRefs } from "../src/agents/a1/bib-refs";
import { parseSectionsFromGrobidXML } from "../src/agents/a1/sections-parser";

const xml = readFileSync(path.join(__dirname, "fixtures/grobid-sample.xml"), "utf8");

beforeAll(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("bibliographyLabels", () => {
  it("builds a short label per reference from author, year and title", () => {
    const labels = bibliographyLabels(xml);
    expect(labels.get("b0")).toBe('Lewis, "Retrieval-Augmented Generation"');
    expect(labels.get("b1")).toBe('"Dense Passage Retrieval"');
  });

  it("shortens long titles", () => {
    const long = "A".repeat(80);
    const labels = bibliographyLabels(`<biblStruct xml:id="b9"><title level="a">${long}</title><date when="2019"/></biblStruct>`);
    expect(labels.get("b9")!.length).toBeLessThan(70);
    expect(labels.get("b9")).toMatch(/^2019, "A+…"$/);
  });
});

describe("resolveBibRefs", () => {
  const labels = new Map([["b4", 'Chen 2019, "Collaborative Global-Local Networks"']]);

  it("replaces a numeric reference with the cited paper's label", () => {
    const out = resolveBibRefs('GLNet <ref type="bibr" target="#b4">[5]</ref> fuses branches.', labels);
    expect(out).toContain('(ref: Chen 2019, "Collaborative Global-Local Networks")');
    expect(out).not.toMatch(/\[\d+\]/);
  });

  it("keeps the numbers without brackets when GROBID could not link the reference", () => {
    expect(resolveBibRefs('context <ref type="bibr">[3, 11]</ref>.', labels)).toContain("(ref 3, 11)");
  });

  it("leaves figure and table references alone", () => {
    expect(resolveBibRefs('see <ref type="figure" target="#fig_1">Fig. 2</ref>', labels)).toBe(
      'see <ref type="figure" target="#fig_1">Fig. 2</ref>'
    );
  });
});

describe("neutralizeNumericRefs", () => {
  it("turns bracketed reference numbers into a form that is not an evidence ID", () => {
    expect(neutralizeNumericRefs("GLNet [5] and others [1, 4, 16] and [2–4].")).toBe(
      "GLNet (ref 5) and others (ref 1, 4, 16) and (ref 2–4)."
    );
  });

  it("does not touch citations that are not plain numbers", () => {
    expect(neutralizeNumericRefs("a matrix [i, j] and [x]")).toBe("a matrix [i, j] and [x]");
  });
});

describe("section text given to the agents", () => {
  it("contains no bracketed reference numbers from the paper", () => {
    for (const s of parseSectionsFromGrobidXML(xml)) expect(s.text, s.section).not.toMatch(/\[\d+\]/);
  });

  it("names the referenced paper instead", () => {
    const intro = parseSectionsFromGrobidXML(xml).find((s) => s.section === "Introduction")!;
    expect(intro.text).toContain('retrieval (ref: Lewis, "Retrieval-Augmented Generation")');
  });
});
