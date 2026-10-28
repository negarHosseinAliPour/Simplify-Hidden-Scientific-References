import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { parseHeaderFromGrobidXML, shortAuthorList, yearFromFilename } from "../src/agents/a1/header-parser";
import { formatCitationLine } from "../src/citation-display";

const xml = readFileSync(path.join(__dirname, "fixtures/grobid-sample.xml"), "utf8");

describe("parseHeaderFromGrobidXML", () => {
  const header = parseHeaderFromGrobidXML(xml);

  it("reads the paper's own title instead of relying on the file name", () => {
    expect(header.title).toBe("Grounded Answers for Scientific Papers");
  });

  it("reads authors from the header only, not from the bibliography", () => {
    expect(header.authors).toEqual(["Chuong Huynh", "Anh Tuan Tran", "Khoa Luu"]);
    expect(header.authors).not.toContain("Patrick Lewis");
  });

  it("reads the publication year", () => {
    expect(header.year).toBe("2021");
  });

  it("returns empty metadata when there is no header", () => {
    expect(parseHeaderFromGrobidXML("<TEI><text/></TEI>")).toEqual({ authors: [] });
  });

  it("decodes XML entities in the title", () => {
    const t = '<TEI><teiHeader><titleStmt><title type="main">Q&amp;A over Papers</title></titleStmt></teiHeader></TEI>';
    expect(parseHeaderFromGrobidXML(t).title).toBe("Q&A over Papers");
  });
});

describe("shortAuthorList", () => {
  it("uses surnames and 'et al.' for three or more authors", () => {
    expect(shortAuthorList([])).toBe("");
    expect(shortAuthorList(["Chuong Huynh"])).toBe("Huynh");
    expect(shortAuthorList(["Chuong Huynh", "Khoa Luu"])).toBe("Huynh and Luu");
    expect(shortAuthorList(["Chuong Huynh", "Anh Tuan Tran", "Khoa Luu"])).toBe("Huynh et al.");
  });
});

describe("formatCitationLine", () => {
  it("shows where in the paper each citation points", () => {
    const line = formatCitationLine(1, {
      title: "Progressive Semantic Segmentation",
      authors: ["Chuong Huynh", "Anh Tuan Tran", "Khoa Luu"],
      year: "2021",
      section: "Refinement module",
      page: 4,
    });
    expect(line).toBe("[1] Huynh et al. (2021). Progressive Semantic Segmentation — Refinement module, p. 4");
  });

  it("leaves out missing parts instead of printing empty brackets", () => {
    expect(formatCitationLine(2, { title: "Some Paper" })).toBe("[2] Some Paper");
    expect(formatCitationLine(3, { title: "Some Paper", section: "Abstract" })).toBe("[3] Some Paper — Abstract");
  });
});

describe("yearFromFilename", () => {
  it("finds a single year in a conference file name", () => {
    expect(yearFromFilename("Huynh_Progressive_Semantic_Segmentation_CVPR_2021_paper.pdf")).toBe("2021");
  });

  it("returns nothing when there is no year or more than one", () => {
    expect(yearFromFilename("paper.pdf")).toBeUndefined();
    expect(yearFromFilename("survey_2019_vs_2023.pdf")).toBeUndefined();
    expect(yearFromFilename("arxiv_12021345.pdf")).toBeUndefined();
  });
});

describe("formatCitationLine punctuation", () => {
  it("does not print 'et al..' when the year is unknown", () => {
    const line = formatCitationLine(1, { title: "MagNet", authors: ["A B", "C D", "E F"], section: "Abstract", page: 1 });
    expect(line).toBe("[1] B et al. MagNet — Abstract, p. 1");
  });
});

