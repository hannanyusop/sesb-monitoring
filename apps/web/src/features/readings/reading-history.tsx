import type { Reading } from "@sesb/contracts";
import { formatKuchingDateTime } from "../../lib/datetime.js";

export function ReadingHistory({ readings }: { readings: Reading[] }) {
  return <section className="history"><div className="section-heading"><div><p className="eyebrow">Meter log</p><h2>Reading history</h2></div><span>{readings.length} entries</span></div>
    {readings.length === 0 ? <p className="muted">Your confirmed readings will appear here.</p> : <ol data-testid="reading-history">
      {readings.map((reading) => <li key={reading.id}>
        <div className="reading-value"><strong>{reading.valueKwh}</strong><span>kWh</span></div>
        <div><strong>{formatKuchingDateTime(reading.captureTimestamp)}</strong><small>Saved {formatKuchingDateTime(reading.createdAt)} · Manual entry</small></div>
      </li>)}
    </ol>}
  </section>;
}
