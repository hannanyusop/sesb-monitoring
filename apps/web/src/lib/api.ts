import {
  ApiErrorSchema,
  BudgetInputSchema,
  CycleInsightsSchema,
  CyclePreviewInputSchema,
  CyclePreviewSchema,
  CycleSummaryDetailSchema,
  CreateHouseInputSchema,
  CreateReadingInputSchema,
  HouseDetailSchema,
  HouseSummarySchema,
  ReadingCreatedResponseSchema,
  ReadingPageSchema,
  StartCycleInputSchema,
  StartCycleResponseSchema,
  TariffSchema,
  UpdateHouseInputSchema,
  type CreateHouseInput,
  type CreateReadingInput,
  type BudgetInput,
  type CyclePreviewInput,
  type StartCycleInput,
  type UpdateHouseInput,
} from "@sesb/contracts";
import { z } from "zod";

const baseUrl = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "http://localhost:3000";

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
  }
}

async function request<T>(path: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { "content-type": "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiClientError(0, "API_UNAVAILABLE", "The monitoring service is unavailable. Try again shortly.");
  }
  const body: unknown = await response.json();
  if (!response.ok) {
    const parsed = ApiErrorSchema.safeParse(body);
    if (parsed.success) {
      throw new ApiClientError(response.status, parsed.data.error.code, parsed.data.error.message, parsed.data.error.fields);
    }
    throw new ApiClientError(response.status, "INVALID_API_RESPONSE", "The server returned an unexpected response");
  }
  return schema.parse(body);
}

export const api = {
  getHouses: () => request("/houses", z.array(HouseSummarySchema)),
  getHouse: (id: string) => request(`/houses/${id}`, HouseDetailSchema),
  createHouse: (input: CreateHouseInput) => request("/houses", HouseDetailSchema, {
    method: "POST", body: JSON.stringify(CreateHouseInputSchema.parse(input)),
  }),
  updateHouse: (id: string, input: UpdateHouseInput) => request(`/houses/${id}`, HouseDetailSchema, {
    method: "PATCH", body: JSON.stringify(UpdateHouseInputSchema.parse(input)),
  }),
  createReading: (houseId: string, input: CreateReadingInput) => request(
    `/houses/${houseId}/readings`, ReadingCreatedResponseSchema,
    { method: "POST", body: JSON.stringify(CreateReadingInputSchema.parse(input)) },
  ),
  getReadings: (houseId: string, cursor?: string) => request(
    `/houses/${houseId}/readings${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
    ReadingPageSchema,
  ),
  getActiveTariff: () => request("/tariffs/active", TariffSchema),
  getCycles: (houseId: string) => request(`/houses/${houseId}/cycles`, z.array(CycleSummaryDetailSchema)),
  getCycleInsights: (houseId: string, cycleId: string) => request(`/houses/${houseId}/cycles/${cycleId}/insights`, CycleInsightsSchema),
  previewCycle: (houseId: string, input: CyclePreviewInput) => request(`/houses/${houseId}/cycles/preview`, CyclePreviewSchema, {
    method: "POST", body: JSON.stringify(CyclePreviewInputSchema.parse(input)),
  }),
  startCycle: (houseId: string, input: StartCycleInput) => request(`/houses/${houseId}/cycles`, StartCycleResponseSchema, {
    method: "POST", body: JSON.stringify(StartCycleInputSchema.parse(input)),
  }),
  undoCycle: (houseId: string, cycleId: string) => request(`/houses/${houseId}/cycles/${cycleId}/undo`, z.object({ restoredCycle: CycleSummaryDetailSchema }), { method: "POST" }),
  setBudget: (houseId: string, input: BudgetInput) => request(`/houses/${houseId}/budget`, CycleSummaryDetailSchema, {
    method: "PUT", body: JSON.stringify(BudgetInputSchema.parse(input)),
  }),
};
