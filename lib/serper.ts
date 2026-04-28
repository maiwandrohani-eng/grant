export type SerperOrganicResult = {
  title?: string;
  link?: string;
  snippet?: string;
};

export async function serperSearch(params: {
  q: string;
  gl?: string;
  hl?: string;
  num?: number;
}): Promise<SerperOrganicResult[]> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) throw new Error("Missing SERPER_API_KEY");

  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      q: params.q,
      gl: params.gl ?? "us",
      hl: params.hl ?? "en",
      num: params.num ?? 10
    })
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Serper error ${res.status}: ${text}`);
  }

  const json = (await res.json()) as { organic?: SerperOrganicResult[] };
  return json.organic ?? [];
}

