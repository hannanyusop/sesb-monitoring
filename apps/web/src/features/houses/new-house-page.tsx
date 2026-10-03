import { Link, useNavigate } from "react-router-dom";
import { api } from "../../lib/api.js";
import { HouseForm } from "./house-form.js";

export function NewHousePage() {
  const navigate = useNavigate();
  return <section className="narrow"><Link className="back" to="/">← Dashboard</Link><p className="eyebrow">House setup</p><h1>Add a house</h1><p className="intro">Give this home and its electricity meter a clear name.</p><HouseForm submitLabel="Create house" onSubmit={async (values) => { const house = await api.createHouse(values); navigate(`/houses/${house.id}`); }} /></section>;
}
