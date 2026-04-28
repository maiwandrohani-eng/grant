# INARA Daily Grant Finder (Autonomous)

Runs a daily grant discovery + scoring + email digest for INARA at **7:00 AM** via **Vercel Cron Jobs**, persisting full history in **Neon (PostgreSQL)**.

## What runs daily
- Calls `GET /api/cron/grants` (protected by `CRON_SECRET`)
- Searches all configured donor/portal sources via Serper
- Filters to INARA geography + sectors + eligibility + deadline window
- Deduplicates against Neon before insert
- Uses OpenAI to score (1–10) + write 2-sentence match note + priority tier
- Sends email digest via Resend (🔴 Apply Now / 🟡 Upcoming / 🟢 Rolling)

## Environment variables (Vercel → Project → Settings → Environment Variables)
Copy from `.env.example`.

Critical:
- `DATABASE_URL` (Neon pooled connection string)
- `DIRECT_URL` (Neon direct connection string; used by Prisma for schema ops)
- `CRON_SECRET`
- `SERPER_API_KEY`
- `OPENAI_API_KEY`
- `RESEND_API_KEY`
- `INARA_DIGEST_TO_EMAIL`
- `INARA_DIGEST_FROM_EMAIL`

## Local setup
```bash
npm i
cp .env.example .env
npm run prisma:push
npm run dev
```

To test the cron endpoint locally:
```bash
curl -H "authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/grants
```

