/**
 * Header Parser - read the main paper's own metadata from GROBID TEI XML.
 *
 * GROBID puts the paper's title, authors and date in <teiHeader>:
 *   <titleStmt><title level="a" type="main">Title</title></titleStmt>
 *   <sourceDesc><biblStruct><analytic><author><persName>
 *       <forename>Tien</forename><surname>Huynh</surname>
 *   ... <date type="published" when="2021-06-01">
 * The bibliography (<listBibl>) also contains <author> tags, so only the
 * <teiHeader> block is searched.
 */
export interface PaperHeader {
  title?: string;
  authors: string[];
  year?: string;
}

const decode = (s: string) =>
  s
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

export function parseHeaderFromGrobidXML(xml: string): PaperHeader {
  const header = xml.match(/<teiHeader[^>]*>([\s\S]*?)<\/teiHeader>/i)?.[1] ?? "";
  if (!header) return { authors: [] };

  const titleBlock =
    header.match(/<titleStmt[^>]*>[\s\S]*?<title[^>]*type="main"[^>]*>([\s\S]*?)<\/title>/i) ||
    header.match(/<titleStmt[^>]*>[\s\S]*?<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleBlock ? decode(titleBlock[1]) || undefined : undefined;

  const sourceDesc = header.match(/<sourceDesc[^>]*>([\s\S]*?)<\/sourceDesc>/i)?.[1] ?? header;
  const authors: string[] = [];
  for (const m of sourceDesc.matchAll(/<author[^>]*>([\s\S]*?)<\/author>/gi)) {
    const persName = m[1].match(/<persName[^>]*>([\s\S]*?)<\/persName>/i)?.[1];
    if (!persName) continue;
    const forenames = [...persName.matchAll(/<forename[^>]*>([\s\S]*?)<\/forename>/gi)].map((f) => decode(f[1]));
    const surname = decode(persName.match(/<surname[^>]*>([\s\S]*?)<\/surname>/i)?.[1] ?? "");
    const name = [...forenames, surname].filter(Boolean).join(" ");
    if (name && !authors.includes(name)) authors.push(name);
  }

  const when =
    header.match(/<date[^>]*type="published"[^>]*when="(\d{4})/i)?.[1] ??
    header.match(/<date[^>]*when="(\d{4})/i)?.[1];

  return { title, authors, year: when };
}

/** "Huynh", "Huynh and Lee", or "Huynh et al." from full author names. */
export function shortAuthorList(authors: string[]): string {
  const surnames = authors.map((a) => a.trim().split(/\s+/).pop() || a).filter(Boolean);
  if (surnames.length === 0) return "";
  if (surnames.length === 1) return surnames[0];
  if (surnames.length === 2) return `${surnames[0]} and ${surnames[1]}`;
  return `${surnames[0]} et al.`;
}
