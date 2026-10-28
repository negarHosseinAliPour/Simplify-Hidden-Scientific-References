import { readFileSync } from "fs";
import path from "path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { parseSectionsFromGrobidXML } from "../src/agents/a1/sections-parser";
import {
  extractCitationMarkersFromSection,
  mapCitationIdsToIndices,
} from "../src/agents/a1/citation-extractor";

// A small, hand-written GROBID TEI document with the same structure GROBID returns.
const xml = readFileSync(path.join(__dirname, "fixtures/grobid-sample.xml"), "utf8");

beforeAll(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("parseSectionsFromGrobidXML", () => {
  const sections = parseSectionsFromGrobidXML(xml);

  it("extracts the abstract and every body section with enough text", () => {
    expect(sections.map((s) => s.section)).toEqual(["Abstract", "Introduction", "Related Work"]);
  });

  it("drops sections that are too short to be useful", () => {
    expect(sections.find((s) => s.section === "Short")).toBeUndefined();
  });

  it("reads the page number from GROBID coordinates", () => {
    expect(sections.find((s) => s.section === "Abstract")?.page).toBe(1);
    expect(sections.find((s) => s.section === "Related Work")?.page).toBe(2);
  });

  it("returns plain text without XML tags", () => {
    for (const s of sections) expect(s.text).not.toMatch(/<[^>]+>/);
  });

  it("returns no sections for an empty document", () => {
    expect(parseSectionsFromGrobidXML("<TEI></TEI>")).toEqual([]);
  });
});

describe("extractCitationMarkersFromSection", () => {
  it("finds the citations used inside one section only", () => {
    expect(extractCitationMarkersFromSection(xml, "Related Work").sort()).toEqual(["b1", "b2"]);
    expect(extractCitationMarkersFromSection(xml, "Introduction").sort()).toEqual(["b0", "b2"]);
  });

  it("matches section names case-insensitively", () => {
    expect(extractCitationMarkersFromSection(xml, "related work")).toHaveLength(2);
  });

  it("returns an empty list when the section does not exist", () => {
    expect(extractCitationMarkersFromSection(xml, "Conclusion")).toEqual([]);
  });
});

describe("mapCitationIdsToIndices", () => {
  it("maps GROBID ids to their position in the bibliography, sorted", () => {
    expect(mapCitationIdsToIndices(["b2", "b0"], xml)).toEqual([0, 2]);
  });

  it("skips ids that are not in the bibliography", () => {
    expect(mapCitationIdsToIndices(["b1", "b99"], xml)).toEqual([1]);
  });
});

describe("page numbers from heading coordinates", () => {
  it("reads the page from <head coords> when GROBID is asked for teiCoordinates=head", () => {
    const body = "Long enough text about the method that is definitely more than one hundred characters long so it is kept as a section.";
    const doc = `<TEI><text><body><div><head coords="5,40,60,200,12">Method</head><p>${body}</p></div></body></text></TEI>`;
    const [section] = parseSectionsFromGrobidXML(doc);
    expect(section.section).toBe("Method");
    expect(section.page).toBe(5);
  });

  it("puts the abstract on page 1 when GROBID gives it no coordinates", () => {
    const text = "This abstract has more than fifty characters so that the parser keeps it as a section.";
    const body = "Long enough text about the method that is definitely more than one hundred characters long so it is kept as a section.";
    const doc = `<TEI><abstract><p>${text}</p></abstract><text><body><div><head coords="3,1,1,1,1">Method</head><p>${body}</p></div></body></text></TEI>`;
    const sections = parseSectionsFromGrobidXML(doc);
    expect(sections.find((s) => s.section === "Abstract")?.page).toBe(1);
    expect(sections.find((s) => s.section === "Method")?.page).toBe(3);
  });
});

