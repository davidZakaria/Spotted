"use client";

import { useEffect, useMemo, useState } from "react";
import { keepWatchingAction } from "@/lib/actions";
import { MentionCard } from "@/components/mention-card";
import { Badge, Button, Card } from "@/components/ui";
import type { LiveHit, LiveProgress } from "@/lib/listen/live";
import type { LiveSourceStatus } from "@/lib/listen/sources";

type Props = {
  projectId: string;
  locale: string;
  initialQuery?: string;
  watching?: string[];
  serpRemaining?: number;
  serpLimit?: number;
  serpHasKey?: boolean;
};

export function LiveSearch({
  projectId,
  locale,
  initialQuery = "",
  watching = [],
  serpRemaining,
  serpLimit,
  serpHasKey,
}: Props) {
  const ar = locale === "ar";
  const [query, setQuery] = useState(initialQuery);
  const [running, setRunning] = useState(false);
  const [plan, setPlan] = useState<LiveSourceStatus[]>([]);
  const [progress, setProgress] = useState<Record<string, LiveProgress>>({});
  const [hits, setHits] = useState<LiveHit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const [required, setRequired] = useState("");
  const [excluded, setExcluded] = useState("");
  const [booleanQuery, setBooleanQuery] = useState("");
  const [synonyms, setSynonyms] = useState("");
  const [language, setLanguage] = useState("");
  const [country, setCountry] = useState("");
  const [matchType, setMatchType] = useState("CONTAINS");

  const alreadyWatching = watching.some((word) => word.toLowerCase() === query.trim().toLowerCase());

  const start = (event?: React.FormEvent) => {
    event?.preventDefault();
    const q = query.trim();
    if (!q) return;
    setRunning(true);
    setError(null);
    setHits([]);
    setProgress({});
    const params = new URLSearchParams({
      q,
      projectId,
      required,
      excluded,
      boolean: booleanQuery,
      synonyms,
      language,
      country,
      matchType,
    });
    const source = new EventSource(`/api/listen/live?${params}`);
    source.addEventListener("plan", (message) => {
      const data = JSON.parse((message as MessageEvent).data) as { plan: LiveSourceStatus[] };
      setPlan(data.plan);
    });
    source.addEventListener("source", (message) => {
      const row = JSON.parse((message as MessageEvent).data) as LiveProgress;
      setProgress((current) => ({ ...current, [row.id]: row }));
    });
    source.addEventListener("hits", (message) => {
      const data = JSON.parse((message as MessageEvent).data) as { progress: LiveProgress; hits: LiveHit[] };
      setProgress((current) => ({ ...current, [data.progress.id]: data.progress }));
      setHits((current) => [...current, ...data.hits]);
    });
    source.addEventListener("done", () => {
      setRunning(false);
      source.close();
    });
    source.addEventListener("error", () => {
      setRunning(false);
      setError(ar ? "تعذر البحث الآن. حاول مرة أخرى." : "Search could not finish. Try again.");
      source.close();
    });
  };

  useEffect(() => {
    if (initialQuery.trim()) start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo(() => plan, [plan]);

  return (
    <div className="space-y-4">
      {serpHasKey ? (
        <p className={`rounded-xl px-4 py-3 text-sm ${serpRemaining === 0 ? "bg-warn/10 text-warn" : "bg-bg-soft text-muted"}`}>
          {serpRemaining === 0
            ? ar
              ? `انتهى حد بحث الويب لهذا الشهر (${serpLimit}). الأخبار ويوتيوب ما زالا يعملان. بحث ريديت عبر جوجل متوقف أيضاً.`
              : `Web search is paused — ${serpLimit} SerpAPI searches used this month. News and YouTube still run. Reddit via Google is paused too.`
            : ar
              ? `تبقّى ${serpRemaining} من ${serpLimit} بحثاً عبر جوجل هذا الشهر. نستخدمه للبحث المباشر ومرتين لكل كلمة يومياً.`
              : `${serpRemaining} of ${serpLimit} Google web/news searches left this month. Used for Search everywhere, plus two scheduled refreshes per watched word each day.`}
        </p>
      ) : null}
      <form onSubmit={start} className="card space-y-3 p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={ar ? "ابحث في كل مكان — مثل عقارات أو real-estate" : "Search everywhere — try real-estate or your brand"}
            className="flex-1"
          />
          <Button type="submit" disabled={running || !query.trim()}>
            {running ? (ar ? "جاري البحث…" : "Searching…") : ar ? "ابحث في كل مكان" : "Search everywhere"}
          </Button>
        </div>
        <button type="button" className="text-xs text-accent" onClick={() => setAdvanced((value) => !value)}>
          {advanced ? (ar ? "إخفاء التفاصيل" : "Hide extra options") : ar ? "خيارات أدق (كلمات مطلوبة، استبعاد، لغة)" : "More options (required words, exclude, language)"}
        </button>
        {advanced ? (
          <div className="grid gap-2 md:grid-cols-2">
            <label className="text-xs text-muted">
              {ar ? "يجب أن تظهر" : "Must also include"}
              <input value={required} onChange={(event) => setRequired(event.target.value)} placeholder={ar ? "القاهرة، مصر" : "cairo, egypt"} className="mt-1" />
            </label>
            <label className="text-xs text-muted">
              {ar ? "استبعد" : "Leave out"}
              <input value={excluded} onChange={(event) => setExcluded(event.target.value)} placeholder={ar ? "لعبة، إعلان" : "game, ad"} className="mt-1" />
            </label>
            <label className="text-xs text-muted md:col-span-2">
              {ar ? "بحث منطقي (AND / OR / NOT أو و / أو / ليس)" : "Boolean (AND / OR / NOT, quotes)"}
              <input value={booleanQuery} onChange={(event) => setBooleanQuery(event.target.value)} placeholder={'"real estate" AND cairo NOT game'} className="mt-1" />
            </label>
            <label className="text-xs text-muted">
              {ar ? "مرادفات" : "Also match"}
              <input value={synonyms} onChange={(event) => setSynonyms(event.target.value)} placeholder={ar ? "عقارات، real estate" : "real estate, عقارات"} className="mt-1" />
            </label>
            <div className="grid grid-cols-3 gap-2">
              <label className="text-xs text-muted">
                {ar ? "النوع" : "Match"}
                <select value={matchType} onChange={(event) => setMatchType(event.target.value)} className="mt-1">
                  <option value="CONTAINS">{ar ? "يحتوي" : "Contains"}</option>
                  <option value="PHRASE">{ar ? "عبارة" : "Exact phrase"}</option>
                  <option value="EXACT">{ar ? "كلمة كاملة" : "Whole word"}</option>
                </select>
              </label>
              <label className="text-xs text-muted">
                {ar ? "اللغة" : "Language"}
                <select value={language} onChange={(event) => setLanguage(event.target.value)} className="mt-1">
                  <option value="">{ar ? "الكل" : "Any"}</option>
                  <option value="en">English</option>
                  <option value="ar">العربية</option>
                </select>
              </label>
              <label className="text-xs text-muted">
                {ar ? "البلد" : "Country"}
                <select value={country} onChange={(event) => setCountry(event.target.value)} className="mt-1">
                  <option value="">{ar ? "الكل" : "Any"}</option>
                  <option value="EG">Egypt</option>
                  <option value="SA">Saudi Arabia</option>
                  <option value="AE">UAE</option>
                  <option value="US">United States</option>
                  <option value="GB">United Kingdom</option>
                </select>
              </label>
            </div>
          </div>
        ) : null}
      </form>

      {error ? <p className="rounded-xl bg-bad/10 px-4 py-3 text-sm text-bad">{error}</p> : null}

      {rows.length ? (
        <Card>
          <p className="text-sm font-medium">{ar ? "أين نبحث الآن" : "Where we are looking"}</p>
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
            {rows.map((row) => {
              const state = progress[row.id];
              const status = state?.status ?? (row.ready ? "waiting" : "skipped");
              const found = state?.found ?? 0;
              const note = ar ? state?.noteAr ?? row.noteAr : state?.note ?? row.note;
              const label =
                status === "searching"
                  ? ar
                    ? `نبحث في ${row.nameAr}…`
                    : `Searching ${row.name}…`
                  : status === "done"
                    ? ar
                      ? `${row.nameAr} · وُجد ${found}`
                      : `${row.name} · ${found} found`
                    : status === "skipped"
                      ? ar
                        ? `${row.nameAr} · يحتاج مفتاحاً`
                        : `${row.name} · needs a key`
                      : ar
                        ? row.nameAr
                        : row.name;
              return (
                <li key={row.id} className="flex items-start justify-between gap-2 text-sm">
                  <span>
                    {label}
                    {note ? <span className="block text-xs text-muted">{note}</span> : null}
                  </span>
                  <Badge tone={status === "done" ? "good" : status === "skipped" ? "warn" : "muted"}>
                    {status === "searching" ? (ar ? "جاري" : "Live") : status === "done" ? found : status === "skipped" ? (ar ? "أضف مفتاحاً" : "Add key") : "…"}
                  </Badge>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      {query.trim() && (hits.length > 0 || running) ? (
        <form action={keepWatchingAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="phrase" value={query.trim()} />
          <input type="hidden" name="required" value={required} />
          <input type="hidden" name="excluded" value={excluded} />
          <input type="hidden" name="boolean" value={booleanQuery} />
          <input type="hidden" name="synonyms" value={synonyms} />
          <input type="hidden" name="language" value={language} />
          <input type="hidden" name="country" value={country} />
          <input type="hidden" name="matchType" value={matchType} />
          <Button type="submit" variant="soft" disabled={alreadyWatching}>
            {alreadyWatching ? (ar ? "نراقب هذه الكلمة" : "Already watching this word") : ar ? "استمر في مراقبة هذه الكلمة" : "Keep watching this word"}
          </Button>
          <span className="text-xs text-muted">
            {ar ? "نحفظها ونرجع نبحث عنها كل بضع دقائق، مع آخر 30 يوماً." : "We’ll save it and keep checking every few minutes, including the last 30 days."}
          </span>
        </form>
      ) : null}

      {hits.length ? (
        <div className="space-y-3">
          <h2 className="font-semibold">{ar ? `نتائج مباشرة · ${hits.length}` : `Live results · ${hits.length}`}</h2>
          {hits.map((hit) => (
            <MentionCard
              key={`${hit.source}-${hit.externalId}`}
              mention={{
                id: `${hit.source}-${hit.externalId}`,
                url: hit.url,
                title: hit.title ?? null,
                content: hit.content,
                authorName: hit.authorName ?? null,
                authorHandle: hit.authorHandle ?? null,
                source: hit.source,
                kind: hit.kind,
                sentiment: hit.sentiment,
                publishedAt: new Date(hit.publishedAt),
                language: hit.language ?? null,
              }}
              locale={locale}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
