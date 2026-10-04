import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ErrorState, LoadingState } from "../../components/feedback.js";
import { HouseNavigation } from "../../components/house-navigation.js";
import { api } from "../../lib/api.js";
import { BudgetEditor } from "../cycles/budget-editor.js";
import { BudgetIndicator } from "../cycles/budget-indicator.js";
import { CycleComparison } from "../cycles/cycle-comparison.js";
import { CycleSelector } from "../cycles/cycle-selector.js";
import { CycleSummary } from "../cycles/cycle-summary.js";
import { DailyUsageChart } from "../cycles/daily-usage-chart.js";
import { StartCycleSheet } from "../cycles/start-cycle-sheet.js";
import { UndoCycleNotice } from "../cycles/undo-cycle-notice.js";
import { ReadingForm } from "../readings/reading-form.js";
import { ReadingHistory } from "../readings/reading-history.js";

export function HouseDetailPage() {
  const { houseId = "" } = useParams();
  const queryClient = useQueryClient();
  const [selectedCycleId, setSelectedCycleId] = useState("");
  const house = useQuery({ queryKey: ["house", houseId], queryFn: () => api.getHouse(houseId), enabled: Boolean(houseId) });
  const cycles = useQuery({ queryKey: ["cycles", houseId], queryFn: () => api.getCycles(houseId), enabled: Boolean(houseId) });
  useEffect(() => {
    if (cycles.data?.length && !selectedCycleId) setSelectedCycleId(cycles.data[0]!.id);
  }, [cycles.data, selectedCycleId]);
  const insights = useQuery({ queryKey: ["cycle-insights", houseId, selectedCycleId], queryFn: () => api.getCycleInsights(houseId, selectedCycleId), enabled: Boolean(houseId && selectedCycleId) });
  const refresh = async () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ["house", houseId] }),
    queryClient.invalidateQueries({ queryKey: ["houses"] }),
    queryClient.invalidateQueries({ queryKey: ["cycles", houseId] }),
    queryClient.invalidateQueries({ queryKey: ["cycle-insights", houseId] }),
  ]);
  const reading = useMutation({ mutationFn: (input: { valueKwh: string; captureTimestamp: string }) => api.createReading(houseId, input), onSuccess: refresh });
  const budget = useMutation({ mutationFn: (input: Parameters<typeof api.setBudget>[1]) => api.setBudget(houseId, input), onSuccess: refresh });
  const start = useMutation({ mutationFn: (input: Parameters<typeof api.startCycle>[1]) => api.startCycle(houseId, input), onSuccess: async (result) => { setSelectedCycleId(result.activeCycle.id); await refresh(); } });
  const undo = useMutation({ mutationFn: (cycleId: string) => api.undoCycle(houseId, cycleId), onSuccess: async (result) => { setSelectedCycleId(result.restoredCycle.id); await refresh(); } });
  if (house.isPending || cycles.isPending) return <LoadingState label="Loading house…" />;
  if (house.isError) return <ErrorState message={house.error.message} retry={() => house.refetch()} />;
  if (cycles.isError) return <ErrorState message={cycles.error.message} retry={() => cycles.refetch()} />;
  const data = house.data;
  const selected = cycles.data.find((cycle) => cycle.id === selectedCycleId) ?? cycles.data[0];
  const isActive = selected?.status === "active";
  return <section id="overview" className="page-with-house-nav">
    <div className="detail-header"><div><Link className="back" to="/">← Dashboard</Link><p className="eyebrow">{data.meter.label}</p><h1>{data.name}</h1>{data.address && <p className="intro">{data.address}</p>}</div><Link className="button secondary" to={`/houses/${data.id}/edit`}>Edit house</Link></div>
    {!data.latestReading && <div className="notice"><strong>Start with a baseline reading</strong><p>Your first confirmed reading opens this billing cycle with zero usage.</p></div>}
    {selected && <>
      <div className="workspace-toolbar"><CycleSelector cycles={cycles.data} value={selected.id} onChange={setSelectedCycleId} />{data.latestReading && isActive && <StartCycleSheet onPreview={(input) => api.previewCycle(houseId, input)} onStart={(input) => start.mutateAsync(input).then(() => undefined)} />}</div>
      <CycleSummary cycle={selected} />
      {isActive && insights.data && <UndoCycleNotice undo={insights.data.undo} pending={undo.isPending} onUndo={() => undo.mutateAsync(selected.id).then(() => undefined)} />}
      <div className="budget-card workspace-card"><BudgetIndicator progress={insights.data?.budgetProgress ?? null} /><BudgetEditor cycle={selected} disabled={!isActive} onSave={(input) => budget.mutateAsync(input).then(() => undefined)} /></div>
      {insights.isPending ? <LoadingState label="Calculating cycle insights…" /> : insights.isError ? <ErrorState message={insights.error.message} retry={() => insights.refetch()} /> : insights.data && <div className="insights-grid"><DailyUsageChart insights={insights.data} /><CycleComparison comparison={insights.data.comparison} /></div>}
      {!isActive && <div className="notice readonly-notice"><strong>Viewing a closed cycle</strong><p>Historical readings, budget, and totals are read-only.</p></div>}
    </>}
    {isActive && <details id="readings" className="mobile-disclosure" open><summary>Meter readings</summary><div className="detail-grid"><ReadingForm onSave={async (input) => { await reading.mutateAsync(input); }} /><ReadingHistory readings={data.recentReadings} /></div></details>}
    <HouseNavigation houseId={houseId} />
  </section>;
}
