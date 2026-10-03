import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ErrorState, LoadingState } from "../../components/feedback.js";
import { api } from "../../lib/api.js";
import { HouseCard } from "./house-card.js";

export function DashboardPage() {
  const houses = useQuery({ queryKey: ["houses"], queryFn: api.getHouses });
  return <section>
    <div className="hero-row"><div><p className="eyebrow">Your electricity</p><h1>Good evening.</h1><p className="intro">A clear view of every home, reading, and current estimate.</p></div><Link className="button" to="/houses/new">＋ Add house</Link></div>
    {houses.isPending && <LoadingState label="Loading your houses…" />}
    {houses.isError && <ErrorState message={houses.error.message} retry={() => houses.refetch()} />}
    {houses.data?.length === 0 && <div className="empty"><span className="empty-icon">⌂</span><h2>Add your first house</h2><p>Create a home and record a baseline meter reading to begin.</p><Link className="button" to="/houses/new">Add house</Link></div>}
    <div className="house-grid">{houses.data?.map((house) => <HouseCard key={house.id} house={house} />)}</div>
    <p className="disclaimer">Estimates include tiered energy charges only and are not official SESB bills.</p>
  </section>;
}
