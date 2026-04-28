import { prisma } from "@/lib/prisma";
import { GRANT_SOURCES, INARA_GEOS, INARA_SECTORS } from "@/lib/sources";
import { serperSearch } from "@/lib/serper";
import { computeDedupeKey } from "@/lib/dedupe";
import {
  classifyPriority,
  extractAmountRange,
  extractDeadline,
  eligibilityLooksOk,
  matchesGeo,
  matchesSector,
  within90DaysOrRolling
} from "@/lib/filter";
import { scoreGrantWithOpenAI } from "@/lib/openai_grants";
import { sendDigestEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Candidate = {
  sourceCategory: string;
  sourceName: string;
  title: string;
  url: string;
  snippet: string;
};

function assertCronAuth(req: Request) {
  // Prefer Vercel's cron marker header (no extra config required).
  // Fallback to a shared secret for local/manual invocation.
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";
  if (isVercelCron) return;

  const expected = process.env.CRON_SECRET;
  if (!expected) {
    const err = new Error("Unauthorized (missing CRON_SECRET)");
    // @ts-expect-error attach status
    err.statusCode = 401;
    throw err;
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${expected}`) {
    const err = new Error("Unauthorized");
    // @ts-expect-error attach status
    err.statusCode = 401;
    throw err;
  }
}

function buildQueries(sourceName: string, hints?: string[]): string[] {
  const geo = INARA_GEOS.join(" OR ");
  const sector = ["child protection", "MHPSS", "WASH", "education", "health", "emergency response"].join(" OR ");
  const base = `"${sourceName}" (${geo}) (${sector}) (grant OR "call for proposals" OR funding OR partnership)`;
  const extra = (hints ?? []).slice(0, 2).map((h) => `"${sourceName}" ${h} (${geo}) (grant OR funding OR "call for proposals")`);
  return [base, ...extra];
}

async function searchAllSources(): Promise<Candidate[]> {
  const out: Candidate[] = [];

  // Serper free tier is limited monthly; we batch multiple sources per query.
  // This still "searches every source" daily by explicitly including each source name in a batched OR clause.
  const batchSize = 8;
  for (let i = 0; i < GRANT_SOURCES.length; i += batchSize) {
    const batch = GRANT_SOURCES.slice(i, i + batchSize);
    const geo = INARA_GEOS.join(" OR ");
    const sector = ["child protection", "MHPSS", "WASH", "education", "health", "emergency response"].join(" OR ");
    const sourcesOr = batch.map((b) => `"${b.name}"`).join(" OR ");
    const q = `(${sourcesOr}) (${geo}) (${sector}) (grant OR "call for proposals" OR funding OR partnership)`;

    const results = await serperSearch({ q, num: 10 });
    for (const r of results) {
      if (!r.link || !r.title) continue;
      const snippet = r.snippet ?? "";
      const hay = `${r.title}\n${snippet}\n${r.link}`.toLowerCase();
      const matched = batch.find((b) => hay.includes(b.name.toLowerCase()));
      if (!matched) continue;
      out.push({
        sourceCategory: matched.category,
        sourceName: matched.name,
        title: r.title,
        url: r.link,
        snippet
      });
    }
  }

  // De-dupe candidates by URL early
  const seen = new Set<string>();
  return out.filter((c) => {
    const k = c.url.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export async function GET(req: Request) {
  const run = await prisma.cronRun.create({ data: {} });

  try {
    assertCronAuth(req);

    const now = new Date();
    const candidates = await searchAllSources();

    await prisma.cronRun.update({
      where: { id: run.id },
      data: { foundCount: candidates.length }
    });

    const kept: Candidate[] = [];
    for (const c of candidates) {
      const blob = [c.title, c.snippet, c.sourceName].join(" \n ");
      if (!matchesGeo(blob)) continue;
      if (!matchesSector(blob)) continue;

      const deadlineInfo = extractDeadline(blob, now);
      if (!within90DaysOrRolling(deadlineInfo, now)) continue;

      const elig = eligibilityLooksOk(blob);
      if (!elig.ok) continue;

      kept.push(c);
    }

    await prisma.cronRun.update({
      where: { id: run.id },
      data: { keptCount: kept.length }
    });

    const insertedIds: string[] = [];

    for (const c of kept) {
      const blob = [c.title, c.snippet, c.sourceName].join(" \n ");
      const deadlineInfo = extractDeadline(blob, now);
      const amountRange = extractAmountRange(blob);
      const elig = eligibilityLooksOk(blob);

      const extractedDeadlineISO = deadlineInfo.type === "FIXED" ? deadlineInfo.deadline.toISOString().slice(0, 10) : null;
      const dedupeKey = computeDedupeKey({
        url: c.url,
        title: c.title,
        donor: c.sourceName,
        deadlineISO: extractedDeadlineISO
      });

      const exists = await prisma.grant.findUnique({ where: { dedupeKey }, select: { id: true } });
      if (exists) continue;

      const scored = await scoreGrantWithOpenAI({
        title: c.title,
        url: c.url,
        snippet: c.snippet,
        sourceName: c.sourceName,
        sourceCategory: c.sourceCategory,
        extracted: {
          deadlineType: deadlineInfo.type,
          deadlineISO: extractedDeadlineISO,
          amountRange,
          localRegistrationAdvantage: elig.localAdvantage
        }
      });

      // Enforce strict gating even after AI: must match geo+sector and deadline rule
      const scoredBlob = [scored.geographicFocus, scored.thematicFocus, c.title, c.snippet].join(" \n ");
      if (!matchesGeo(scoredBlob)) continue;
      if (!matchesSector(scoredBlob)) continue;

      const finalDeadlineInfo =
        scored.deadlineType === "FIXED" && scored.deadlineISO
          ? { type: "FIXED" as const, deadline: new Date(scored.deadlineISO) }
          : scored.deadlineType === "ROLLING"
            ? { type: "ROLLING" as const, deadline: null }
            : scored.deadlineType === "OPEN"
              ? { type: "OPEN" as const, deadline: null }
              : { type: "UNKNOWN" as const, deadline: null };

      if (!within90DaysOrRolling(finalDeadlineInfo, now)) continue;

      const priority = classifyPriority(finalDeadlineInfo, now);

      const created = await prisma.grant.create({
        data: {
          dedupeKey,
          sourceCategory: c.sourceCategory,
          sourceName: c.sourceName,
          title: c.title,
          donor: scored.donor ?? c.sourceName,
          fundName: scored.fundName,
          url: c.url,
          snippet: c.snippet,
          geographicFocus: scored.geographicFocus || INARA_GEOS.join(", "),
          thematicFocus: scored.thematicFocus || INARA_SECTORS.slice(0, 6).join(", "),
          amountRange: scored.amountRange ?? amountRange,
          deadline: finalDeadlineInfo.type === "FIXED" ? finalDeadlineInfo.deadline : null,
          deadlineType: finalDeadlineInfo.type,
          eligibilitySummary: null,
          localRegistrationAdvantage: scored.localRegistrationAdvantage || elig.localAdvantage,
          relevanceScore: scored.relevanceScore,
          matchNote: scored.matchNote,
          priority,
          rawJson: {
            candidate: c,
            ai: scored
          }
        },
        select: { id: true }
      });

      insertedIds.push(created.id);
    }

    await prisma.cronRun.update({
      where: { id: run.id },
      data: { insertedCount: insertedIds.length }
    });

    const inserted = insertedIds.length
      ? await prisma.grant.findMany({
          where: { id: { in: insertedIds } },
          orderBy: [{ priority: "asc" }, { relevanceScore: "desc" }, { createdAt: "desc" }]
        })
      : [];

    if (inserted.length > 0) {
      await sendDigestEmail(inserted);
    }

    await prisma.cronRun.update({
      where: { id: run.id },
      data: {
        emailedCount: inserted.length,
        ok: true,
        finishedAt: new Date()
      }
    });

    return Response.json({
      ok: true,
      runId: run.id,
      found: candidates.length,
      kept: kept.length,
      inserted: inserted.length,
      emailed: inserted.length
    });
  } catch (e: any) {
    const status = typeof e?.statusCode === "number" ? e.statusCode : 500;
    await prisma.cronRun.update({
      where: { id: run.id },
      data: {
        ok: false,
        error: String(e?.message ?? e),
        finishedAt: new Date()
      }
    });
    return Response.json({ ok: false, runId: run.id, error: String(e?.message ?? e) }, { status });
  }
}

