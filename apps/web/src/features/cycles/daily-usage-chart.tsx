import type { CycleInsights } from "@sesb/contracts";
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function DailyUsageChart({ insights }: { insights: CycleInsights }) {
  const average = Number(insights.averageDailyKwh);
  const data = insights.dailyUsage.map((point) => ({ date: point.date.slice(5), usage: Number(point.usageKwh) }));
  return <article className="workspace-card chart-card"><div className="section-heading"><div><p className="eyebrow">Estimated daily usage</p><h2>Daily pattern</h2></div><strong>{average.toFixed(2)} <small>kWh/day avg</small></strong></div>
    <p className="chart-note">Usage is estimated evenly between meter readings. It does not forecast days after the latest reading.</p>
    {data.length ? <div className="chart-wrap" role="img" aria-label={`${data.length} represented days, ${Number(insights.representedUsageKwh).toFixed(2)} kWh total, average ${average.toFixed(2)} kWh per day`}>
      <ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{ top: 10, right: 6, left: -18, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="date" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip formatter={(value) => [`${Number(value).toFixed(2)} kWh`, "Estimated usage"]} /><ReferenceLine y={average} stroke="#e08b32" strokeDasharray="5 4" label={{ value: "Avg", fill: "#9a5c1f", fontSize: 11 }} /><Bar dataKey="usage" fill="#087f72" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer>
    </div> : <div className="empty-inline">Add another reading to see daily usage.</div>}
  </article>;
}
