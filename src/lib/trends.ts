export async function fetchTrends(keyword: string, fallback: { date: string; volume: number }[]) {
  try {
    const res = await fetch(
      `https://trends.google.com/trends/api/widgetdata/multiline?hl=en-US&req=${encodeURIComponent(
        JSON.stringify({
          time: "now 7-d",
          resolution: "DAY",
          locale: "en-US",
          comparisonItem: [{ geo: { country: "US" }, complexKeywordsRestriction: { keyword: [{ type: "BROAD", value: keyword }] } }],
          requestOptions: { property: "", backend: "CM", category: 0 },
        }),
      )}`,
      { headers: { "User-Agent": "SpottedSocial/1.0" } },
    );
    if (res.ok) {
      const text = await res.text();
      const json = JSON.parse(text.replace(/^\)\]\}'\n?/, ""));
      const timeline = json.default?.timelineData ?? [];
      if (timeline.length) {
        return {
          source: "Google Trends interest-over-time",
          series: timeline.map((row: { formattedTime?: string; value?: number[] }) => ({
            date: row.formattedTime ?? "",
            value: row.value?.[0] ?? 0,
          })),
        };
      }
    }
  } catch {
    // unofficial endpoint is often blocked
  }
  return {
    source: "Fallback: mention volume used as interest proxy (Google Trends has no official API)",
    series: fallback.map((s) => ({ date: s.date, value: s.volume })),
  };
}
