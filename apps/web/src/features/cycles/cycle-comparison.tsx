import type { CycleInsights } from "@sesb/contracts";

const change = (value: string | null) => value === null ? "No prior baseline" : `${Number(value) > 0 ? "+" : ""}${Number(value).toFixed(1)}%`;
export function CycleComparison({ comparison }: { comparison: CycleInsights["comparison"] }) {
  if (!comparison) return <article className="workspace-card comparison-card"><p className="eyebrow">Previous cycle</p><h2>No comparison yet</h2><p className="muted">Complete another billing cycle to compare performance.</p></article>;
  return <article className="workspace-card comparison-card"><p className="eyebrow">Previous cycle</p><h2>Cycle comparison</h2><div className="comparison-grid">
    <div><span>Usage</span><strong>{change(comparison.consumption.percentChange)}</strong><small>{comparison.consumption.current} vs {comparison.consumption.previous} kWh</small></div>
    <div><span>Energy charge</span><strong>{change(comparison.charge.percentChange)}</strong><small>RM{Number(comparison.charge.current).toFixed(2)} vs RM{Number(comparison.charge.previous).toFixed(2)}</small></div>
    <div><span>Daily average</span><strong>{change(comparison.dailyAverage.percentChange)}</strong><small>{comparison.dailyAverage.current} vs {comparison.dailyAverage.previous} kWh</small></div>
  </div></article>;
}
