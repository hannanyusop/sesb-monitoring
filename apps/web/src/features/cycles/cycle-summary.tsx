import type { CycleSummaryDetail } from "@sesb/contracts";
import { cycleAge, formatKuchingDateTime } from "../../lib/datetime.js";

export function CycleSummary({ cycle }: { cycle: CycleSummaryDetail }) {
  return <div className="cycle-panel workspace-summary">
    <div><span>Usage</span><strong>{cycle.consumptionKwh} <small>kWh</small></strong></div>
    <div className="estimate"><span>Energy estimate</span><strong>RM{cycle.estimatedChargeRm}</strong><small>Energy charge only</small></div>
    <div><span>{cycle.status === "active" ? "Cycle age" : "Period"}</span><strong className="small-value">{cycleAge(cycle.openingTimestamp, cycle.closingTimestamp ? new Date(cycle.closingTimestamp) : undefined)}</strong>{cycle.openingTimestamp && <small>From {formatKuchingDateTime(cycle.openingTimestamp)}</small>}</div>
  </div>;
}
