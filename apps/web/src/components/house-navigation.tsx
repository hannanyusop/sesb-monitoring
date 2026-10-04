import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";

export function HouseNavigation({ houseId }: { houseId: string }) {
  const location = useLocation();
  const housePath = `/houses/${houseId}`;
  const active = location.pathname.endsWith("/edit")
    ? "edit"
    : location.hash === "#readings" ? "readings" : "overview";

  useEffect(() => {
    if (!location.hash) return;
    const frame = requestAnimationFrame(() => {
      document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: "start" });
    });
    return () => cancelAnimationFrame(frame);
  }, [location.hash]);

  const current = (name: string) => active === name ? "page" as const : undefined;
  return <nav className="house-navigation" aria-label="House navigation">
    <Link to="/" aria-label="All Houses"><span aria-hidden="true">⌂</span><span className="house-nav-label">All</span></Link>
    <Link to={`${housePath}#overview`} aria-current={current("overview")} aria-label="Overview"><span aria-hidden="true">▦</span><span className="house-nav-label">Overview</span></Link>
    <Link to={`${housePath}#readings`} aria-current={current("readings")} aria-label="Readings"><span aria-hidden="true">↯</span><span className="house-nav-label">Readings</span></Link>
    <Link to={`${housePath}/edit`} aria-current={current("edit")} aria-label="Edit"><span aria-hidden="true">⚙</span><span className="house-nav-label">Edit</span></Link>
  </nav>;
}
