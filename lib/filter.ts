import * as chrono from "chrono-node";
import { INARA_GEOS, INARA_SECTORS } from "@/lib/sources";

export type DeadlineInfo =
  | { type: "ROLLING" | "OPEN"; deadline: null }
  | { type: "FIXED"; deadline: Date }
  | { type: "UNKNOWN"; deadline: null };

export function extractDeadline(text: string, now = new Date()): DeadlineInfo {
  const t = text.toLowerCase();
  if (/(rolling|open\s+until\s+filled|open\s+call|ongoing|continuous)/i.test(t)) {
    return { type: "ROLLING", deadline: null };
  }
  if (/(no\s+deadline|deadline\s+tbd|to\s+be\s+announced)/i.test(t)) {
    return { type: "UNKNOWN", deadline: null };
  }
  const parsed = chrono.parseDate(text, now, { forwardDate: true });
  if (!parsed) return { type: "UNKNOWN", deadline: null };
  return { type: "FIXED", deadline: parsed };
}

export function within90DaysOrRolling(info: DeadlineInfo, now = new Date()): boolean {
  if (info.type === "ROLLING" || info.type === "OPEN") return true;
  if (info.type !== "FIXED") return false;
  const diffMs = info.deadline.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= 90;
}

export function classifyPriority(info: DeadlineInfo, now = new Date()): "APPLY_NOW" | "UPCOMING" | "ROLLING" {
  if (info.type === "ROLLING" || info.type === "OPEN") return "ROLLING";
  if (info.type !== "FIXED") return "UPCOMING";
  const diffDays = (info.deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays < 30 ? "APPLY_NOW" : "UPCOMING";
}

export function matchesGeo(text: string): boolean {
  const t = text.toLowerCase();
  return INARA_GEOS.some((g) => t.includes(g.toLowerCase()));
}

export function matchesSector(text: string): boolean {
  const t = text.toLowerCase();
  return INARA_SECTORS.some((s) => t.includes(s.toLowerCase()));
}

export function eligibilityLooksOk(text: string): { ok: boolean; localAdvantage: boolean } {
  const t = text.toLowerCase();

  const localAdvantage =
    /(local\s+ngo|national\s+ngo|locally\s+registered|registered\s+in\s+(syria|afghanistan|lebanon|ukraine|egypt|turkey|palestine|gaza)|preference\s+for\s+local)/i.test(
      t
    );

  // Soft heuristic: pass if it doesn't explicitly exclude NGOs / non-profits.
  const explicitExclude =
    /(individuals\s+only|for\s+individual\s+applicants\s+only|for\s+companies\s+only|for\s+governments\s+only)/i.test(
      t
    );

  const mentionsNgos =
    /(ngo|non[-\s]?governmental|nonprofit|non-profit|501\(c\)\(3\)|civil\s+society|cso|charit(y|ies))/i.test(
      t
    );

  return { ok: !explicitExclude && mentionsNgos, localAdvantage };
}

export function extractAmountRange(text: string): string | null {
  const m =
    text.match(/(\$|usd)\s?([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)(\s?(million|m|k))?/i) ??
    text.match(/([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)\s?(million|m|k)\s?(usd|\$)/i);
  if (!m) return null;
  return m[0].trim();
}

