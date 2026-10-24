export function ChartEmpty({ title, body }: { title: string; body: string }) {
  return (
    <div className="grid h-52 place-items-center rounded-xl border border-dashed border-line bg-bg-soft/50 px-6 text-center">
      <div>
        <p className="font-medium">{title}</p>
        <p className="mt-1 text-sm text-muted">{body}</p>
      </div>
    </div>
  );
}

export function VolumeChart({
  data,
  emptyTitle = "No mentions to chart yet",
  emptyBody = "Add words to watch, then tap Find new mentions. This line will fill in as people talk.",
}: {
  data: { date: string; volume: number; positive?: number; negative?: number }[];
  emptyTitle?: string;
  emptyBody?: string;
  tooltip?: string;
}) {
  if (!data.length) return <ChartEmpty title={emptyTitle} body={emptyBody} />;
  const max = Math.max(...data.map((row) => row.volume), 1);
  return (
    <div className="flex h-56 items-end gap-1.5 pt-4">
      {data.map((row) => (
        <div key={row.date} className="group relative flex min-w-0 flex-1 flex-col items-center justify-end">
          <div
            className="w-full max-w-10 rounded-t-md bg-accent/80 hover:bg-accent"
            style={{ height: `${Math.max(6, (row.volume / max) * 180)}px` }}
            title={`${row.date}: ${row.volume} mentions`}
          />
          <span className="pointer-events-none absolute -top-1 hidden -translate-y-full rounded-lg border border-line bg-bg-elev px-2 py-1 text-[11px] text-ink shadow group-hover:block">
            {row.date}: {row.volume}
          </span>
          <span className="mt-2 text-[10px] text-muted">{row.date.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

export function SentimentBars({
  data,
  emptyTitle = "No mood to show yet",
  emptyBody = "Once mentions arrive, this chart shows how many were happy, mixed, or upset.",
}: {
  data: { name: string; value: number }[];
  emptyTitle?: string;
  emptyBody?: string;
}) {
  if (!data.some((row) => row.value > 0)) return <ChartEmpty title={emptyTitle} body={emptyBody} />;
  const max = Math.max(...data.map((row) => row.value), 1);
  return (
    <div className="space-y-3 py-2">
      {data.map((row) => {
        const color = row.name.toLowerCase().includes("pos") || row.name.includes("إيجاب")
          ? "bg-good"
          : row.name.toLowerCase().includes("neg") || row.name.includes("سلب")
            ? "bg-bad"
            : "bg-muted";
        return (
          <div key={row.name} className="group">
            <div className="mb-1 flex justify-between text-sm">
              <span>{row.name}</span>
              <span className="text-muted">{row.value}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-bg-soft">
              <div className={`h-full rounded-full ${color}`} style={{ width: `${(row.value / max) * 100}%` }} title={`${row.name}: ${row.value}`} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function SourcePie({
  data,
  emptyTitle = "No platforms yet",
  emptyBody = "When mentions come in, this shows which sites they came from.",
}: {
  data: { source: string; count: number }[];
  emptyTitle?: string;
  emptyBody?: string;
}) {
  if (!data.length) return <ChartEmpty title={emptyTitle} body={emptyBody} />;
  const max = Math.max(...data.map((row) => row.count), 1);
  return (
    <div className="space-y-3 py-2">
      {data.map((row) => (
        <div key={row.source}>
          <div className="mb-1 flex justify-between text-sm">
            <span>{row.source}</span>
            <span className="text-muted">{row.count}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-bg-soft">
            <div className="h-full rounded-full bg-accent" style={{ width: `${(row.count / max) * 100}%` }} title={`${row.source}: ${row.count}`} />
          </div>
        </div>
      ))}
    </div>
  );
}
