import type { CycleInsights } from "@sesb/contracts";

export function BudgetIndicator({ progress }: { progress: CycleInsights["budgetProgress"] }) {
  if (!progress) return <div className="budget-empty"><span className="energy-icon" aria-hidden="true">⚡</span><div><strong>No budget yet</strong><small>Add a kWh or RM limit for this cycle.</small></div></div>;
  const unit = progress.type === "KWH" ? "kWh" : "RM";
  const remaining = Number(progress.remaining);
  const accessible = progress.overBudget
    ? `${Math.abs(remaining).toFixed(2)} ${unit} over budget`
    : `${Math.max(0, remaining).toFixed(2)} ${unit} remaining, ${Math.max(0, Number(progress.percentRemaining)).toFixed(0)} percent left`;
  return <div className={`budget-indicator ${progress.state}`} aria-label={accessible}>
    <div className="energy-gauge" style={{ "--budget-fill": `${Math.max(0, Math.min(100, Number(progress.percentRemaining)))}%` } as React.CSSProperties}><span aria-hidden="true">⚡</span></div>
    <div><span>Budget remaining</span><strong>{progress.overBudget ? "Over budget" : `${Math.max(0, Number(progress.percentRemaining)).toFixed(0)}% left`}</strong><small>{accessible}</small></div>
  </div>;
}
