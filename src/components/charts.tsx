"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Bar, PieChart, Pie, Cell } from "recharts";

export function VolumeChart({ data }: { data: { date: string; volume: number; positive?: number; negative?: number }[] }) {
  if (!data.length) return <p className="text-sm text-muted">No series yet. Run listening to populate the chart.</p>;
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <CartesianGrid stroke="#243044" strokeDasharray="3 3" />
          <XAxis dataKey="date" stroke="#8b9bb4" fontSize={11} />
          <YAxis stroke="#8b9bb4" fontSize={11} />
          <Tooltip contentStyle={{ background: "#121a2a", border: "1px solid #243044" }} />
          <Area type="monotone" dataKey="volume" stroke="#2dd4bf" fill="#2dd4bf33" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SentimentBars({ data }: { data: { name: string; value: number }[] }) {
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid stroke="#243044" strokeDasharray="3 3" />
          <XAxis dataKey="name" stroke="#8b9bb4" fontSize={11} />
          <YAxis stroke="#8b9bb4" fontSize={11} />
          <Tooltip contentStyle={{ background: "#121a2a", border: "1px solid #243044" }} />
          <Bar dataKey="value" fill="#60a5fa" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SourcePie({ data }: { data: { source: string; count: number }[] }) {
  const colors = ["#2dd4bf", "#60a5fa", "#fbbf24", "#fb7185", "#a78bfa", "#34d399"];
  if (!data.length) return <p className="text-sm text-muted">No source mix yet.</p>;
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="count" nameKey="source" innerRadius={40} outerRadius={70}>
            {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
          </Pie>
          <Tooltip contentStyle={{ background: "#121a2a", border: "1px solid #243044" }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
