import OpenAI from "openai";

export type OpenAIScoredGrant = {
  relevanceScore: number; // 1-10
  matchNote: string; // exactly two sentences requested; we validate loosely
  geographicFocus: string;
  thematicFocus: string;
  donor: string | null;
  fundName: string | null;
  amountRange: string | null;
  deadlineType: "FIXED" | "ROLLING" | "OPEN" | "UNKNOWN";
  deadlineISO: string | null;
  localRegistrationAdvantage: boolean;
};

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");
  return new OpenAI({ apiKey });
}

export async function scoreGrantWithOpenAI(input: {
  title: string;
  url: string;
  snippet?: string | null;
  sourceName: string;
  sourceCategory: string;
  extracted: {
    deadlineType: string;
    deadlineISO: string | null;
    amountRange: string | null;
    localRegistrationAdvantage: boolean;
  };
}): Promise<OpenAIScoredGrant> {
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const client = getClient();

  const prompt = `
You are a grants analyst for INARA (a U.S. 501(c)(3) humanitarian NGO, also locally registered in Syria, Afghanistan, Lebanon, Ukraine, Egypt, Turkey, and Palestine/Gaza).

Task: Return a strict JSON object (no markdown) describing this funding opportunity AND its fit with INARA.

INARA geographies: Syria, Afghanistan, Lebanon, Ukraine, Egypt, Turkey, Palestine/Gaza.
INARA sectors: child protection; medical/rehabilitative care; MHPSS; education in emergencies; WASH; livelihoods/economic empowerment; emergency response (food/NFI/medical).

Input:
- source: ${input.sourceName} (${input.sourceCategory})
- title: ${input.title}
- url: ${input.url}
- snippet: ${input.snippet ?? ""}
- extracted deadlineType: ${input.extracted.deadlineType}
- extracted deadlineISO: ${input.extracted.deadlineISO ?? "null"}
- extracted amountRange: ${input.extracted.amountRange ?? "null"}
- extracted localRegistrationAdvantage: ${input.extracted.localRegistrationAdvantage ? "true" : "false"}

Output JSON schema:
{
  "relevanceScore": 1-10 integer,
  "matchNote": "TWO sentences exactly. Sentence 1: why it matches geography + sector. Sentence 2: why INARA is eligible and/or why urgent.",
  "geographicFocus": "short phrase",
  "thematicFocus": "short phrase listing relevant sectors",
  "donor": "donor org name or null",
  "fundName": "grant/fund name if different from title or null",
  "amountRange": "amount range if known else null",
  "deadlineType": "FIXED|ROLLING|OPEN|UNKNOWN",
  "deadlineISO": "ISO8601 date (YYYY-MM-DD) if fixed else null",
  "localRegistrationAdvantage": boolean
}

Rules:
- If the opportunity is not relevant to INARA geographies OR sectors, set relevanceScore <= 3 and still return the JSON.
- Prefer using extracted fields when plausible.
`.trim();

  const resp = await client.chat.completions.create({
    model,
    temperature: 0.2,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" }
  });

  const content = resp.choices[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned empty content");
  const parsed = JSON.parse(content) as OpenAIScoredGrant;

  // Minimal validation/clamping
  const score = Number.isFinite(parsed.relevanceScore) ? Math.round(parsed.relevanceScore) : 1;
  parsed.relevanceScore = Math.min(10, Math.max(1, score));
  if (typeof parsed.matchNote !== "string") parsed.matchNote = "";

  return parsed;
}

