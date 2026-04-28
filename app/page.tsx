import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function fmtDate(d?: Date | null) {
  if (!d) return "Rolling / Open";
  return d.toISOString().slice(0, 10);
}

export default async function Home() {
  const [latestRun, grants] = await Promise.all([
    prisma.cronRun.findFirst({ orderBy: { startedAt: "desc" } }),
    prisma.grant.findMany({
      orderBy: [{ priority: "asc" }, { relevanceScore: "desc" }, { createdAt: "desc" }],
      take: 60
    })
  ]);

  const applyNow = grants.filter((g) => g.priority === "APPLY_NOW");
  const upcoming = grants.filter((g) => g.priority === "UPCOMING");
  const rolling = grants.filter((g) => g.priority === "ROLLING");

  return (
    <div className="container">
      <div
        className="glass"
        style={{
          padding: 16,
          borderRadius: 22,
          position: "relative",
          overflow: "hidden"
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: -2,
            background:
              "radial-gradient(650px 260px at 10% 0%, rgba(246,212,74,0.18), transparent 60%), radial-gradient(700px 260px at 60% -10%, rgba(213,27,127,0.18), transparent 60%), radial-gradient(700px 300px at 90% 30%, rgba(83,196,231,0.16), transparent 60%)",
            pointerEvents: "none"
          }}
        />

        <div className="grid heroRow" style={{ gridTemplateColumns: "1.5fr 1fr", position: "relative" }}>
          <div style={{ padding: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.14)",
                  background: "rgba(0,0,0,0.35)",
                  display: "grid",
                  placeItems: "center",
                  overflow: "hidden"
                }}
              >
                <Image src="/inara-logo.png" alt="INARA" width={40} height={40} priority />
              </div>
              <div>
                <div style={{ fontSize: 14, color: "var(--muted)" }}>INARA</div>
                <h1 style={{ margin: 0, fontSize: 30, letterSpacing: -0.4 }}>Daily Grant Finder</h1>
              </div>
            </div>

            <p style={{ margin: "10px 0 0 0", color: "var(--muted)", lineHeight: 1.55, maxWidth: 720 }}>
              Fully autonomous scan at <b>07:00</b> via Vercel Cron. Grants are <b>deduplicated</b>, stored in Neon, scored
              with OpenAI, and delivered via a daily digest email.
            </p>

            <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 10 }}>
              <span className="pill">
                <span className="badge">🔴</span> <b>Apply Now</b> (under 30 days)
              </span>
              <span className="pill">
                <span className="badge">🟡</span> <b>Upcoming</b> (31–90 days)
              </span>
              <span className="pill">
                <span className="badge">🟢</span> <b>Rolling</b> (open window)
              </span>
              <span className="pill">
                <span className="badge">🧠</span> <b>AI scored</b> + match note
              </span>
            </div>
          </div>

          <div className="glass" style={{ padding: 14, borderRadius: 18, background: "rgba(0,0,0,0.22)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div style={{ fontWeight: 900, letterSpacing: -0.3 }}>Latest run</div>
              <span className="tag" style={{ borderColor: "rgba(255,255,255,0.14)" }}>
                {latestRun ? fmtDate(latestRun.startedAt) : "—"}
              </span>
            </div>

            {latestRun ? (
              <div className="grid" style={{ marginTop: 12, gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="kpi">
                  <div className="label">Status</div>
                  <div className="value" style={{ color: latestRun.ok ? "var(--teal)" : "var(--pink)" }}>
                    {latestRun.ok ? "OK" : "FAILED"}
                  </div>
                </div>
                <div className="kpi">
                  <div className="label">Finished</div>
                  <div className="value">{latestRun.finishedAt ? "Yes" : "No"}</div>
                </div>
                <div className="kpi">
                  <div className="label">Found</div>
                  <div className="value">{latestRun.foundCount}</div>
                </div>
                <div className="kpi">
                  <div className="label">Kept</div>
                  <div className="value">{latestRun.keptCount}</div>
                </div>
                <div className="kpi">
                  <div className="label">Inserted</div>
                  <div className="value">{latestRun.insertedCount}</div>
                </div>
                <div className="kpi">
                  <div className="label">Emailed</div>
                  <div className="value">{latestRun.emailedCount}</div>
                </div>
                {!latestRun.ok && latestRun.error ? (
                  <div style={{ gridColumn: "1 / -1", marginTop: 4 }}>
                    <div style={{ color: "var(--muted2)", fontSize: 12, marginBottom: 6 }}>Error</div>
                    <div
                      style={{
                        whiteSpace: "pre-wrap",
                        color: "rgba(255,255,255,0.85)",
                        border: "1px solid rgba(213,27,127,0.35)",
                        background: "rgba(213,27,127,0.08)",
                        borderRadius: 14,
                        padding: 10
                      }}
                    >
                      {latestRun.error}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div style={{ marginTop: 10, color: "var(--muted)", fontSize: 13, lineHeight: 1.6 }}>
                No runs logged yet. Locally you can trigger <code>/api/cron/grants</code>.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid triRow" style={{ gridTemplateColumns: "1fr 1fr 1fr", marginTop: 14 }}>
        <div className="glass" style={{ padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 900 }}>🔴 Apply Now</div>
            <span className="tag apply">{applyNow.length} shown</span>
          </div>
          <div style={{ marginTop: 8, color: "var(--muted)", fontSize: 13, lineHeight: 1.5 }}>
            Tight deadlines (under 30 days). These are the highest urgency.
          </div>
        </div>
        <div className="glass" style={{ padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 900 }}>🟡 Upcoming</div>
            <span className="tag upcoming">{upcoming.length} shown</span>
          </div>
          <div style={{ marginTop: 8, color: "var(--muted)", fontSize: 13, lineHeight: 1.5 }}>
            Coming due soon (31–90 days). Great to pipeline for proposal prep.
          </div>
        </div>
        <div className="glass" style={{ padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 900 }}>🟢 Rolling</div>
            <span className="tag rolling">{rolling.length} shown</span>
          </div>
          <div style={{ marginTop: 8, color: "var(--muted)", fontSize: 13, lineHeight: 1.5 }}>
            Open windows and rolling calls. Useful for continuous funding coverage.
          </div>
        </div>
      </div>

      <div className="glass" style={{ marginTop: 14, padding: 14 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
          <div style={{ fontWeight: 900, fontSize: 16, letterSpacing: -0.2 }}>Latest saved grants</div>
          <div style={{ color: "var(--muted)", fontSize: 13 }}>Showing up to 60 most recent (deduped)</div>
        </div>

        <div style={{ marginTop: 12, overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                {["Tier", "Score", "Grant", "Donor", "Geo", "Theme", "Amount", "Deadline", "Local reg", "Link"].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grants.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ padding: 14, color: "var(--muted)" }}>
                    No grants saved yet. Trigger the cron route locally to populate the database.
                  </td>
                </tr>
              ) : (
                grants.map((g) => (
                  <tr key={g.id}>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {g.priority === "APPLY_NOW" ? (
                        <span className="tag apply">🔴</span>
                      ) : g.priority === "UPCOMING" ? (
                        <span className="tag upcoming">🟡</span>
                      ) : (
                        <span className="tag rolling">🟢</span>
                      )}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <span style={{ fontWeight: 900 }}>{g.relevanceScore}</span>
                      <span style={{ color: "var(--muted)" }}>/10</span>
                    </td>
                    <td style={{ minWidth: 360 }}>
                      <div style={{ fontWeight: 900, letterSpacing: -0.2 }}>{g.title}</div>
                      <div style={{ marginTop: 6, color: "var(--muted)", lineHeight: 1.45 }}>{g.matchNote}</div>
                    </td>
                    <td>{g.donor ?? g.sourceName}</td>
                    <td>{g.geographicFocus}</td>
                    <td>{g.thematicFocus}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{g.amountRange ?? "—"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{g.deadlineType === "FIXED" ? fmtDate(g.deadline) : "Rolling / Open"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{g.localRegistrationAdvantage ? "🚨 Yes" : "No"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <Link href={g.url} target="_blank" rel="noreferrer">
                        Open
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

