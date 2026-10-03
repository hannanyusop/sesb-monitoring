import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ErrorState, LoadingState } from "../../components/feedback.js";
import { api } from "../../lib/api.js";
import { cycleAge, formatKuchingDateTime } from "../../lib/datetime.js";
import { ReadingForm } from "../readings/reading-form.js";
import { ReadingHistory } from "../readings/reading-history.js";

export function HouseDetailPage() {
  const { houseId = "" } = useParams();
  const queryClient = useQueryClient();
  const house = useQuery({ queryKey: ["house", houseId], queryFn: () => api.getHouse(houseId), enabled: Boolean(houseId) });
  const reading = useMutation({ mutationFn: (input: { valueKwh: string; captureTimestamp: string }) => api.createReading(houseId, input), onSuccess: async () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ["house", houseId] }),
    queryClient.invalidateQueries({ queryKey: ["houses"] }),
  ]) });
  if (house.isPending) return <LoadingState label="Loading house…" />;
  if (house.isError) return <ErrorState message={house.error.message} retry={() => house.refetch()} />;
  const data = house.data;
  return <section><div className="detail-header"><div><Link className="back" to="/">← Dashboard</Link><p className="eyebrow">{data.meter.label}</p><h1>{data.name}</h1>{data.address && <p className="intro">{data.address}</p>}</div><Link className="button secondary" to={`/houses/${data.id}/edit`}>Edit house</Link></div>
    <div className="cycle-panel"><div><span>Current usage</span><strong>{data.activeCycle.consumptionKwh} <small>kWh</small></strong></div><div className="estimate"><span>Current estimate</span><strong>RM{data.activeCycle.estimatedChargeRm}</strong><small>Energy charge only</small></div><div><span>Cycle age</span><strong className="small-value">{cycleAge(data.activeCycle.openingTimestamp)}</strong>{data.activeCycle.openingTimestamp && <small>Since {formatKuchingDateTime(data.activeCycle.openingTimestamp)}</small>}</div></div>
    {!data.latestReading && <div className="notice"><strong>Start with a baseline reading</strong><p>Your first confirmed reading opens this billing cycle with zero usage.</p></div>}
    <div className="detail-grid"><ReadingForm onSave={async (input) => { await reading.mutateAsync(input); }} /><ReadingHistory readings={data.recentReadings} /></div>
  </section>;
}
