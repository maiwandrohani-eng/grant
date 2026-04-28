import crypto from "crypto";

export function computeDedupeKey(input: {
  url: string;
  title: string;
  donor?: string | null;
  deadlineISO?: string | null;
}): string {
  const normUrl = (input.url ?? "").trim().toLowerCase();
  const normTitle = (input.title ?? "").trim().toLowerCase();
  const normDonor = (input.donor ?? "").trim().toLowerCase();
  const normDeadline = (input.deadlineISO ?? "").trim();
  const raw = [normUrl, normTitle, normDonor, normDeadline].join("|");
  return crypto.createHash("sha256").update(raw).digest("hex");
}

