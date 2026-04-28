import { Resend } from "resend";
import type { Grant } from "@prisma/client";

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("Missing RESEND_API_KEY");
  return new Resend(key);
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

function fmtDate(d: Date | null): string {
  if (!d) return "Rolling / Open";
  return d.toISOString().slice(0, 10);
}

function priorityHeader(p: "APPLY_NOW" | "UPCOMING" | "ROLLING"): string {
  if (p === "APPLY_NOW") return "🔴 Apply Now";
  if (p === "UPCOMING") return "🟡 Upcoming";
  return "🟢 Rolling";
}

export function buildDigestHtml(grants: Grant[], runDate = new Date()): { subject: string; html: string; text: string } {
  const groups = {
    APPLY_NOW: grants.filter((g) => g.priority === "APPLY_NOW").sort((a, b) => (a.deadline?.getTime() ?? 0) - (b.deadline?.getTime() ?? 0)),
    UPCOMING: grants.filter((g) => g.priority === "UPCOMING").sort((a, b) => (a.deadline?.getTime() ?? 0) - (b.deadline?.getTime() ?? 0)),
    ROLLING: grants.filter((g) => g.priority === "ROLLING")
  } as const;

  const subject = `INARA Daily Grants Digest — ${runDate.toISOString().slice(0, 10)}`;

  const section = (key: keyof typeof groups) => {
    const title = priorityHeader(key);
    const items = groups[key];
    if (items.length === 0) return `<h2>${esc(title)}</h2><p>No matches today.</p>`;
    const list = items
      .map((g) => {
        const localFlag = g.localRegistrationAdvantage ? `<div><strong>🚨 Local registration advantage:</strong> Yes</div>` : "";
        return `
<div style="border:1px solid #e5e7eb;border-radius:12px;padding:14px;margin:12px 0;">
  <div style="font-size:16px;font-weight:700;margin-bottom:6px;">${esc(g.title)}</div>
  <div><strong>Donor:</strong> ${esc(g.donor ?? g.sourceName)}</div>
  <div><strong>Geographic focus:</strong> ${esc(g.geographicFocus)}</div>
  <div><strong>Thematic focus:</strong> ${esc(g.thematicFocus)}</div>
  <div><strong>Funding amount:</strong> ${esc(g.amountRange ?? "Unknown")}</div>
  <div><strong>Deadline:</strong> ${esc(g.deadlineType === "FIXED" ? fmtDate(g.deadline) : "Rolling / Open")}</div>
  <div><strong>Link:</strong> <a href="${esc(g.url)}">${esc(g.url)}</a></div>
  <div><strong>Relevance:</strong> ${g.relevanceScore}/10</div>
  <div style="margin-top:8px;line-height:1.4;">${esc(g.matchNote)}</div>
  ${localFlag}
</div>
`.trim();
      })
      .join("\n");
    return `<h2>${esc(title)}</h2>${list}`;
  };

  const html = `
<div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;max-width:860px;margin:0 auto;padding:12px;">
  <h1 style="margin:0 0 6px 0;">INARA Daily Grants Digest</h1>
  <div style="color:#6b7280;margin-bottom:16px;">Generated ${esc(runDate.toISOString())}</div>
  ${section("APPLY_NOW")}
  ${section("UPCOMING")}
  ${section("ROLLING")}
  <hr style="margin:18px 0;border:none;border-top:1px solid #e5e7eb;" />
  <div style="color:#6b7280;font-size:12px;">
    Automated daily scan. Stored in Neon with full history and deduplication.
  </div>
</div>
`.trim();

  const textLines: string[] = [];
  textLines.push(subject);
  textLines.push("");
  for (const key of ["APPLY_NOW", "UPCOMING", "ROLLING"] as const) {
    textLines.push(priorityHeader(key));
    const items = groups[key];
    if (items.length === 0) {
      textLines.push("  - No matches today.");
      textLines.push("");
      continue;
    }
    for (const g of items) {
      textLines.push(`- ${g.title}`);
      textLines.push(`  Donor: ${g.donor ?? g.sourceName}`);
      textLines.push(`  Geo: ${g.geographicFocus}`);
      textLines.push(`  Theme: ${g.thematicFocus}`);
      textLines.push(`  Amount: ${g.amountRange ?? "Unknown"}`);
      textLines.push(`  Deadline: ${g.deadlineType === "FIXED" ? fmtDate(g.deadline) : "Rolling / Open"}`);
      textLines.push(`  Link: ${g.url}`);
      textLines.push(`  Relevance: ${g.relevanceScore}/10`);
      textLines.push(`  Note: ${g.matchNote}`);
      if (g.localRegistrationAdvantage) textLines.push("  🚨 Local registration advantage: Yes");
      textLines.push("");
    }
  }

  return { subject, html, text: textLines.join("\n") };
}

export async function sendDigestEmail(grants: Grant[]): Promise<void> {
  const to = process.env.INARA_DIGEST_TO_EMAIL;
  const from = process.env.INARA_DIGEST_FROM_EMAIL;
  if (!to) throw new Error("Missing INARA_DIGEST_TO_EMAIL");
  if (!from) throw new Error("Missing INARA_DIGEST_FROM_EMAIL");

  const { subject, html, text } = buildDigestHtml(grants);
  const resend = getResend();

  await resend.emails.send({
    to,
    from,
    subject,
    html,
    text
  });
}

