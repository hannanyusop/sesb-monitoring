import type { BudgetInput, CycleSummaryDetail } from "@sesb/contracts";
import { useEffect, useState } from "react";
import { ApiClientError } from "../../lib/api.js";

export function BudgetEditor({ cycle, disabled, onSave }: { cycle: CycleSummaryDetail; disabled: boolean; onSave: (input: BudgetInput) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"KWH" | "RM">(cycle.budget?.type ?? "KWH");
  const [value, setValue] = useState(cycle.budget?.value ?? "");
  const [error, setError] = useState("");
  useEffect(() => { setType(cycle.budget?.type ?? "KWH"); setValue(cycle.budget?.value ?? ""); }, [cycle.id, cycle.budget?.type, cycle.budget?.value]);
  if (disabled) return null;
  return <div className="budget-editor">
    <button className="text-button" type="button" onClick={() => setOpen(!open)}>{cycle.budget ? "Edit budget" : "Add budget"}</button>
    {open && <form onSubmit={async (event) => { event.preventDefault(); setError(""); try { await onSave({ type, value }); setOpen(false); } catch (caught) { setError(caught instanceof ApiClientError ? caught.message : "Unable to save budget"); } }}>
      <div className="segment" role="group" aria-label="Budget unit"><button type="button" className={type === "KWH" ? "active" : ""} onClick={() => setType("KWH")}>kWh</button><button type="button" className={type === "RM" ? "active" : ""} onClick={() => setType("RM")}>RM</button></div>
      <label>Budget value<input aria-label="Budget value" inputMode="decimal" value={value} onChange={(event) => setValue(event.target.value)} required /></label>
      {error && <div className="alert" role="alert">{error}</div>}
      <div className="inline-actions"><button className="button" disabled={!value}>Save budget</button>{cycle.budget && <button className="text-button" type="button" onClick={async () => { await onSave({ type: null, value: null }); setOpen(false); }}>Remove</button>}</div>
    </form>}
  </div>;
}
