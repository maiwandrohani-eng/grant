export default function Home() {
  return (
    <main style={{ padding: 24, maxWidth: 860, margin: "0 auto" }}>
      <h1 style={{ marginTop: 0 }}>INARA Daily Grant Finder</h1>
      <p style={{ lineHeight: 1.5 }}>
        This service runs autonomously on Vercel via a daily cron hitting{" "}
        <code>/api/cron/grants</code> at 7:00 AM and emails a digest.
      </p>
      <p style={{ lineHeight: 1.5 }}>
        No UI, no buttons. Configure env vars and deploy.
      </p>
    </main>
  );
}

