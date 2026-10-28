import { shortAuthorList } from "./agents/a1/header-parser";

export interface DisplayCitation {
  title?: string;
  authors?: string[];
  year?: string;
  section?: string;
  page?: number;
}

/**
 * One readable line per citation, pointing to where in the paper the evidence is:
 *   [1] Huynh et al. (2021). Progressive Semantic Segmentation — Abstract, p. 1
 */
export function formatCitationLine(n: number, c: DisplayCitation): string {
  const who = shortAuthorList(c.authors ?? []);
  const source = [who, c.year ? `(${c.year})` : ""].filter(Boolean).join(" ");
  const title = c.title?.trim() || "Untitled";
  const where = [c.section, c.page ? `p. ${c.page}` : ""].filter(Boolean).join(", ");

  return `[${n}] ${source ? `${source}. ` : ""}${title}${where ? ` — ${where}` : ""}`;
}
