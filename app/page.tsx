import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function badge(text: string, bg: string) {
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 12,
        padding: "2px 8px",
        borderRadius: 999,
        background: bg,
        color: "#111827",
        border: "1px solid rgba(17,24,39,0.10)"
      }}
    >
      {text}
    </span>
  );
}

function sectionTitle(icon: string, title: string, subtitle?: string) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
      <div style={{ fontSize: 18, fontWeight: 800 }}>
        {icon} {title}
      </div>
      {subtitle ? <div style={{ color: "#6b7280", fontSize: 13 }}>{subtitle}</div> : null}
    </div>
  );
}

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

  const card: React.CSSProperties = {
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 16,
    background: "white"
  };

  const pageBg: React.CSSProperties = {
    minHeight: "100vh",
    background: "linear-gradient(180deg, #f9fafb 0%, #ffffff 55%)"
  };

  return (
    <div style={pageBg}>
      <main style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 28, letterSpacing: -0.3 }}>INARA Daily Grant Finder</h1>
            <p style={{ margin: "8px 0 0 0", color: "#4b5563", lineHeight: 1.5 }}>
              Autonomous daily scan at <strong>7:00 AM</strong> via Vercel Cron. Results are stored in Neon and
              emailed as a digest.
            </p>
            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {badge("🔴 Apply Now", "#fee2e2")}
              {badge("🟡 Upcoming", "#fef3c7")}
              {badge("🟢 Rolling", "#dcfce7")}
              {badge("Deduped + persisted", "#e0e7ff")}
            </div>
          </div>

          <div style={{ ...card, minWidth: 320 }}>
            {sectionTitle("⏱️", "Latest run", latestRun ? fmtDate(latestRun.startedAt) : "No runs yet")}
            {latestRun ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 13 }}>
                <div>
                  <div style={{ color: "#6b7280" }}>Status</div>
                  <div style={{ fontWeight: 700 }}>{latestRun.ok ? "OK" : "FAILED"}</div>
                </div>
                <div>
                  <div style={{ color: "#6b7280" }}>Found</div>
                  <div style={{ fontWeight: 700 }}>{latestRun.foundCount}</div>
                </div>
                <div>
                  <div style={{ color: "#6b7280" }}>Kept</div>
                  <div style={{ fontWeight: 700 }}>{latestRun.keptCount}</div>
                </div>
                <div>
                  <div style={{ color: "#6b7280" }}>Inserted</div>
                  <div style={{ fontWeight: 700 }}>{latestRun.insertedCount}</div>
                </div>
                <div>
                  <div style={{ color: "#6b7280" }}>Emailed</div>
                  <div style={{ fontWeight: 700 }}>{latestRun.emailedCount}</div>
                </div>
                <div>
                  <div style={{ color: "#6b7280" }}>Finished</div>
                  <div style={{ fontWeight: 700 }}>{latestRun.finishedAt ? "Yes" : "No"}</div>
                </div>
                {!latestRun.ok && latestRun.error ? (
                  <div style={{ gridColumn: "1 / -1", marginTop: 6, color: "#b91c1c" }}>
                    <div style={{ color: "#6b7280" }}>Error</div>
                    <div style={{ fontWeight: 600, whiteSpace: "pre-wrap" }}>{latestRun.error}</div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div style={{ color: "#6b7280", fontSize: 13, lineHeight: 1.5 }}>
                No runs logged yet. Locally you can trigger:
                <div style={{ marginTop: 8 }}>
                  <code style={{ background: "#f3f4f6", padding: "2px 6px", borderRadius: 6 }}>
                    /api/cron/grants
                  </code>
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <div style={card}>
            {sectionTitle("🔴", "Apply Now", `${applyNow.length} shown`)}
            <div style={{ color: "#6b7280", fontSize: 13 }}>
              Deadline under 30 days (or highest urgency).
            </div>
          </div>
          <div style={card}>
            {sectionTitle("🟡", "Upcoming", `${upcoming.length} shown`)}
            <div style={{ color: "#6b7280", fontSize: 13 }}>Deadline within 31–90 days.</div>
          </div>
          <div style={card}>
            {sectionTitle("🟢", "Rolling", `${rolling.length} shown`)}
            <div style={{ color: "#6b7280", fontSize: 13 }}>Rolling or open-ended opportunities.</div>
          </div>
        </div>

        <div style={{ marginTop: 18, ...card }}>
          {sectionTitle("📌", "Latest saved grants", "Up to 60 most recent (deduped)")}

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 13 }}>
              <thead>
                <tr>
                  {["Priority", "Score", "Title", "Donor", "Geo", "Theme", "Amount", "Deadline", "Local reg", "Link"].map(
                    (h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: "left",
                          padding: "10px 10px",
                          color: "#6b7280",
                          fontWeight: 700,
                          borderBottom: "1px solid #e5e7eb",
                          whiteSpace: "nowrap"
                        }}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {grants.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ padding: 14, color: "#6b7280" }}>
                      No grants saved yet. Trigger the cron route locally to populate the database.
                    </td>
                  </tr>
                ) : (
                  grants.map((g) => (
                    <tr key={g.id}>
                      <td style={{ padding: "10px 10px", borderBottom: "1px solid #f3f4f6", whiteSpace: "nowrap" }}>
                        {g.priority === "APPLY_NOW"
                          ? badge("🔴", "#fee2e2")
                          : g.priority === "UPCOMING"
                            ? badge("🟡", "#fef3c7")
                            : badge("🟢", "#dcfce7")}
                      </td>
                      <td style={{ padding: "10px 10px", borderBottom: "1px solid #f3f4f6", whiteSpace: "nowrap" }}>
                        <span style={{ fontWeight: 800 }}>{g.relevanceScore}</span>/10
                      </td>
                      <td style={{ padding: "10px 10px", borderBottom: "1px solid #f3f4f6", minWidth: 320 }}>
                        <div style={{ fontWeight: 800, marginBottom: 4 }}>{g.title}</div>
                        <div style={{ color: "#6b7280", lineHeight: 1.35 }}>{g.matchNote}</div>
                      </td>
                      <td style={{ padding: "10px 10px", borderBottom: "1px solid #f3f4f6" }}>
                        {g.donor ?? g.sourceName}
                      </td>
                      <td style={{ padding: "10px 10px", borderBottom: "1px solid #f3f4f6" }}>{g.geographicFocus}</td>
                      <td style={{ padding: "10px 10px", borderBottom: "1px solid #f3f4f6" }}>{g.thematicFocus}</td>
                      <td style={{ padding: "10px 10px", borderBottom: "1px solid #f3f4f6", whiteSpace: "nowrap" }}>
                        {g.amountRange ?? "—"}
                      </td>
                      <td style={{ padding: "10px 10px", borderBottom: "1px solid #f3f4f6", whiteSpace: "nowrap" }}>
                        {g.deadlineType === "FIXED" ? fmtDate(g.deadline) : "Rolling / Open"}
                      </td>
                      <td style={{ padding: "10px 10px", borderBottom: "1px solid #f3f4f6", whiteSpace: "nowrap" }}>
                        {g.localRegistrationAdvantage ? "🚨 Yes" : "No"}
                      </td>
                      <td style={{ padding: "10px 10px", borderBottom: "1px solid #f3f4f6", whiteSpace: "nowrap" }}>
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
      </main>
    </div>
  );
}

