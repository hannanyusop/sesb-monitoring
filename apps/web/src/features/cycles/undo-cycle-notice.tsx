import type { CycleInsights } from "@sesb/contracts";

export function UndoCycleNotice({ undo, onUndo, pending }: { undo: CycleInsights["undo"]; onUndo: () => Promise<void>; pending: boolean }) {
  if (!undo?.eligible) return null;
  return <div className="undo-notice" role="status"><div><strong>New cycle started</strong><small>You can undo until {new Date(undo.expiresAt).toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kuching" })} if no reading is added.</small></div><button className="button secondary" disabled={pending} onClick={() => void onUndo()}>Undo</button></div>;
}
