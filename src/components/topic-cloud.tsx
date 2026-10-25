export function TopicCloud({
  topics,
  empty,
}: {
  topics: { topic: string; count: number }[];
  empty: string;
}) {
  if (!topics.length) return <p className="text-sm text-muted">{empty}</p>;
  const max = Math.max(...topics.map((topic) => topic.count), 1);
  return (
    <div className="flex flex-wrap gap-2 py-2">
      {topics.map((topic) => {
        const size = 13 + Math.round((topic.count / max) * 14);
        return (
          <span
            key={topic.topic}
            className="rounded-full bg-bg-soft px-2.5 py-1 text-ink"
            style={{ fontSize: `${size}px` }}
          >
            {topic.topic}
          </span>
        );
      })}
    </div>
  );
}
