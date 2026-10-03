import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/app-shell.js";
import { DashboardPage } from "./features/dashboard/dashboard-page.js";
import { EditHousePage } from "./features/houses/edit-house-page.js";
import { HouseDetailPage } from "./features/houses/house-detail-page.js";
import { NewHousePage } from "./features/houses/new-house-page.js";

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 10_000 } } });

export function App() {
  return <QueryClientProvider client={queryClient}><BrowserRouter><AppShell><Routes>
    <Route path="/" element={<DashboardPage />} />
    <Route path="/houses/new" element={<NewHousePage />} />
    <Route path="/houses/:houseId" element={<HouseDetailPage />} />
    <Route path="/houses/:houseId/edit" element={<EditHousePage />} />
  </Routes></AppShell></BrowserRouter></QueryClientProvider>;
}
