import type { CyclePreview, StartCycleInput } from "@sesb/contracts";
import { useRef, useState } from "react";
import { ApiClientError } from "../../lib/api.js";
import { fromKuchingInput, kuchingInputParts } from "../../lib/datetime.js";

export function StartCycleSheet({ onPreview, onStart }: { onPreview: (input: Omit<StartCycleInput, "acknowledgedGap" | "reason">) => Promise<CyclePreview>; onStart: (input: StartCycleInput) => Promise<void> }) {
  const current = kuchingInputParts();
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"CARRY_FORWARD" | "CUSTOM">("CARRY_FORWARD");
  const [date, setDate] = useState(current.date);
  const [time, setTime] = useState(current.time);
  const [customStartKwh, setCustomStartKwh] = useState("");
  const [reason, setReason] = useState("");
  const [acknowledgedGap, setAcknowledgedGap] = useState(false);
  const [preview, setPreview] = useState<CyclePreview | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const input = () => ({ startTimestamp: fromKuchingInput(date, time), mode, ...(mode === "CUSTOM" ? { customStartKwh } : {}) });
  const close = () => { setOpen(false); setPreview(null); setError(""); trigger.current?.focus(); };
  return <><button ref={trigger} className="button start-cycle-button" onClick={() => setOpen(true)}>＋ Start new bill cycle</button>
    {open && <div className="sheet-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><section className="bottom-sheet" role="dialog" aria-modal="true" aria-labelledby="start-cycle-title">
      <div className="sheet-handle" /><div className="sheet-heading"><div><p className="eyebrow">Billing cycle</p><h2 id="start-cycle-title">Start a new cycle</h2></div><button className="icon-button" aria-label="Close" onClick={close}>×</button></div>
      <p className="muted">The current cycle will be closed. Its readings and totals stay unchanged.</p>
      <div className="segment" role="group" aria-label="Starting reading method"><button type="button" className={mode === "CARRY_FORWARD" ? "active" : ""} onClick={() => { setMode("CARRY_FORWARD"); setPreview(null); }}>Use latest reading</button><button type="button" className={mode === "CUSTOM" ? "active" : ""} onClick={() => { setMode("CUSTOM"); setPreview(null); }}>Custom start</button></div>
      <div className="date-grid"><label>Start date<input type="date" value={date} max={current.date} onChange={(event) => { setDate(event.target.value); setPreview(null); }} /></label><label>Start time<input type="time" value={time} onChange={(event) => { setTime(event.target.value); setPreview(null); }} /></label></div>
      {mode === "CUSTOM" && <><label>Starting meter (kWh)<input aria-label="Starting meter (kWh)" inputMode="decimal" value={customStartKwh} onChange={(event) => { setCustomStartKwh(event.target.value); setPreview(null); }} /></label><label>Reason <span className="optional">Optional</span><textarea value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} /></label></>}
      {preview && <div className="preview-box"><div><span>Previous final</span><strong>{preview.latestReading.valueKwh} kWh</strong></div><div><span>New starting value</span><strong>{preview.proposedStartKwh} kWh</strong></div>{preview.requiresGapAcknowledgement && <label className="check-row"><input type="checkbox" checked={acknowledgedGap} onChange={(event) => setAcknowledgedGap(event.target.checked)} /><span><strong>Confirm {preview.excludedKwh} kWh gap</strong><small>This difference is excluded from both cycles and recorded in the audit log.</small></span></label>}</div>}
      {error && <div className="alert" role="alert">{error}</div>}
      {!preview ? <button className="button full" disabled={busy || (mode === "CUSTOM" && !customStartKwh)} onClick={async () => { setBusy(true); setError(""); try { setPreview(await onPreview(input())); } catch (caught) { setError(caught instanceof ApiClientError ? caught.message : "Unable to preview cycle"); } finally { setBusy(false); } }}>{busy ? "Checking…" : "Review new cycle"}</button>
        : <button className="button full" disabled={busy || (preview.requiresGapAcknowledgement && !acknowledgedGap)} onClick={async () => { setBusy(true); setError(""); try { await onStart({ ...input(), acknowledgedGap, ...(reason ? { reason } : {}) }); close(); } catch (caught) { setError(caught instanceof ApiClientError ? caught.message : "Unable to start cycle"); } finally { setBusy(false); } }}>{busy ? "Starting…" : "Confirm and start cycle"}</button>}
    </section></div>}
  </>;
}
