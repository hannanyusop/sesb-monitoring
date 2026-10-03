import type { HouseSummary } from "@sesb/contracts";
import { Link } from "react-router-dom";
import { cycleAge, formatKuchingDateTime } from "../../lib/datetime.js";

export function HouseCard({ house }: { house: HouseSummary }) {
  return <article className="house-card">
    <div className="card-heading"><div><p className="eyebrow">Active home</p><h2>{house.name}</h2></div><span className="status-dot">Live</span></div>
    {house.address && <p className="muted">{house.address}</p>}
    <div className="metric-grid">
      <div><span>Usage</span><strong>{house.activeCycle.consumptionKwh} <small>kWh</small></strong></div>
      <div className="charge"><span>Current estimate</span><strong>RM{house.activeCycle.estimatedChargeRm}</strong></div>
    </div>
    <div className="reading-line">
      {house.latestReading ? <><span>Latest: {house.latestReading.valueKwh} kWh</span><span>{formatKuchingDateTime(house.latestReading.captureTimestamp)}</span></> : <span>No meter readings yet</span>}
    </div>
    <div className="card-footer"><span>Cycle age: {cycleAge(house.activeCycle.openingTimestamp)}</span><Link to={`/houses/${house.id}`}>{house.latestReading ? "View house" : "Add first reading"} <span aria-hidden="true">→</span></Link></div>
  </article>;
}
