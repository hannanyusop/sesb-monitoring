import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ErrorState, LoadingState } from "../../components/feedback.js";
import { api } from "../../lib/api.js";
import { HouseForm } from "./house-form.js";

export function EditHousePage() {
  const { houseId = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const house = useQuery({ queryKey: ["house", houseId], queryFn: () => api.getHouse(houseId) });
  if (house.isPending) return <LoadingState />;
  if (house.isError) return <ErrorState message={house.error.message} />;
  return <section className="narrow"><Link className="back" to={`/houses/${houseId}`}>← House</Link><p className="eyebrow">House settings</p><h1>Edit {house.data.name}</h1><HouseForm hideMeter submitLabel="Save changes" initial={{ name: house.data.name, address: house.data.address ?? "", notes: house.data.notes ?? "", meterLabel: house.data.meter.label }} onSubmit={async ({ meterLabel: _meterLabel, ...values }) => { await api.updateHouse(houseId, values); await Promise.all([queryClient.invalidateQueries({ queryKey: ["house", houseId] }), queryClient.invalidateQueries({ queryKey: ["houses"] })]); navigate(`/houses/${houseId}`); }} />
    <button className="danger-link" onClick={async () => { if (window.confirm("Deactivate this house? Its history will be kept.")) { await api.updateHouse(houseId, { active: false }); await queryClient.invalidateQueries({ queryKey: ["houses"] }); navigate("/"); } }}>Deactivate house</button>
  </section>;
}
