import type { CycleSummaryDetail } from "@sesb/contracts";
import { formatKuchingDateTime } from "../../lib/datetime.js";

export function CycleSelector({ cycles, value, onChange }: { cycles: CycleSummaryDetail[]; value: string; onChange: (id: string) => void }) {
  return <label className="cycle-selector">View billing cycle
    <select value={value} onChange={(event) => onChange(event.target.value)}>
      {cycles.map((cycle) => <option key={cycle.id} value={cycle.id}>
        {cycle.status === "active" ? "Current cycle" : "Closed cycle"} · {cycle.openingTimestamp ? formatKuchingDateTime(cycle.openingTimestamp) : "Not started"}
      </option>)}
    </select>
  </label>;
}
