# Core Monitoring Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Docker-based personal electricity monitor that creates houses, accepts current or backdated manual meter readings, and displays current-cycle consumption and an estimated SESB tiered charge.

**Architecture:** Use a pnpm TypeScript monorepo with a React/Vite web application, a Fastify API, shared Zod contracts, a framework-independent Decimal.js billing package, and Prisma over PostgreSQL. The API owns validation, tariff snapshots, transactions, and calculations; the web client only captures input and renders server results.

**Tech Stack:** TypeScript, pnpm workspaces, React, Vite, React Router, TanStack Query, React Hook Form, Tailwind CSS, shadcn/ui primitives, Fastify, Zod, Prisma, PostgreSQL, Decimal.js, Vitest, Testing Library, Playwright, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-10-03-core-monitoring-slice-design.md`

## Global Constraints

- The default display timezone is exactly `Asia/Kuching`.
- Store readings, tariff rates, consumption, and money in PostgreSQL `numeric` columns; never persist billing values as binary floating-point.
- Seed exactly the six approved SESB bands: 1–200 at 22.02 sen/kWh, 201–300 at 37.76, 301–600 at 49.26, 601–1000 at 51.49, 1001–1500 at 54.69, and 1501 onward at 59.85.
- Every amount shown to the user is labelled as an estimate and formatted in RM to two decimals using half-up rounding.
- A first reading may be backdated and becomes the cycle opening time; subsequent readings may not precede the cycle's starting reading or be in the future.
- Inserted readings must preserve timestamp uniqueness and non-decreasing cumulative values relative to both adjacent readings.
- The active-cycle estimate always uses the chronologically latest confirmed reading.
- No authentication is included; deployment access control remains an infrastructure responsibility.
- Do not create photograph upload, OCR, tariff replacement, cycle transition/undo, or closed-cycle user interfaces in this slice.

## File Structure

```text
apps/
  api/
    src/app.ts                 # Fastify composition and error mapping
    src/server.ts              # Process startup and shutdown
    src/routes/health.ts       # API/database health endpoint
    src/routes/houses.ts       # House CRUD HTTP boundary
    src/routes/readings.ts     # Manual reading HTTP boundary
    src/routes/tariffs.ts      # Active tariff HTTP boundary
    src/services/houses.ts     # Transactional house use cases
    src/services/readings.ts   # Reading validation and cycle recalculation
    test/                      # API integration tests
  web/
    src/app.tsx                # Router and query provider
    src/lib/api.ts             # Typed fetch client and API errors
    src/lib/datetime.ts        # Asia/Kuching input/display conversion
    src/components/            # Focused reusable UI primitives
    src/features/dashboard/    # Active-house cards and dashboard query
    src/features/houses/       # House form and detail views
    src/features/readings/     # Reading form and history
    src/test/                  # Test setup and fixtures
    e2e/                       # Browser smoke test
packages/
  billing/src/                 # Pure tariff calculation and display rounding
  contracts/src/               # Shared Zod schemas and inferred DTO types
  database/prisma/             # Schema, migrations, and seed
  database/src/                # Prisma client export
compose.yaml                   # Web, API, PostgreSQL, and persistent volumes
```

---

### Task 1: Bootstrap the Workspace and Shared Contracts

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.editorconfig`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `packages/contracts/package.json`
- Create: `packages/contracts/tsconfig.json`
- Create: `packages/contracts/src/errors.ts`
- Create: `packages/contracts/src/houses.ts`
- Create: `packages/contracts/src/readings.ts`
- Create: `packages/contracts/src/tariffs.ts`
- Create: `packages/contracts/src/index.ts`
- Test: `packages/contracts/src/contracts.test.ts`

**Interfaces:**
- Produces: `ApiErrorSchema`, `CreateHouseInputSchema`, `UpdateHouseInputSchema`, `HouseSummarySchema`, `HouseDetailSchema`, `CreateReadingInputSchema`, `ReadingSchema`, `ReadingPageSchema`, and `TariffSchema`, plus their inferred TypeScript types.
- Date-time fields are ISO 8601 strings with offsets; decimal values cross JSON as strings to preserve precision.

- [ ] **Step 1: Add failing contract tests**

```ts
import { describe, expect, it } from "vitest";
import { CreateHouseInputSchema, CreateReadingInputSchema } from "./index";

describe("shared contracts", () => {
  it("requires a house and meter label", () => {
    expect(CreateHouseInputSchema.safeParse({ name: "", meterLabel: "" }).success).toBe(false);
  });

  it("accepts decimal strings and offset timestamps", () => {
    const parsed = CreateReadingInputSchema.parse({
      valueKwh: "12345.6",
      captureTimestamp: "2026-10-03T08:30:00+08:00",
    });
    expect(parsed.valueKwh).toBe("12345.6");
  });

  it("rejects JavaScript numbers for persisted decimals", () => {
    expect(CreateReadingInputSchema.safeParse({
      valueKwh: 12345.6,
      captureTimestamp: "2026-10-03T08:30:00+08:00",
    }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Verify the test cannot run yet**

Run: `corepack enable && pnpm --filter @sesb/contracts test`

Expected: failure because the workspace and contracts package do not exist yet.

- [ ] **Step 3: Create the workspace and schemas**

Set root scripts to `build`, `test`, `typecheck`, `verify`, and `dev`; make the first three recursive through pnpm and make `verify` run tests, type checking, and production builds in sequence. Use strict TypeScript with `noUncheckedIndexedAccess`, ESM, and a shared `NodeNext` base config. Add Zod and Vitest to the contracts package.

Define the request schemas exactly as:

```ts
export const DecimalStringSchema = z.string().regex(/^\d+(\.\d+)?$/);
export const OffsetDateTimeSchema = z.string().datetime({ offset: true });

export const CreateHouseInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  address: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(2000).optional(),
  meterLabel: z.string().trim().min(1).max(120),
});

export const UpdateHouseInputSchema = CreateHouseInputSchema
  .omit({ meterLabel: true })
  .partial()
  .extend({ active: z.boolean().optional() })
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const CreateReadingInputSchema = z.object({
  valueKwh: DecimalStringSchema,
  captureTimestamp: OffsetDateTimeSchema,
});
```

Define response DTOs with UUID identifiers, ISO timestamps, and decimal strings. `HouseSummary` contains `latestReading`, `activeCycle`, `consumptionKwh`, and `estimatedChargeRm`; `HouseDetail` adds meter details and recent readings. Define `ApiError` as `{ error: { code: string; message: string; fields?: Record<string, string> } }`.

- [ ] **Step 4: Run contract tests and type checking**

Run: `pnpm --filter @sesb/contracts test && pnpm --filter @sesb/contracts typecheck`

Expected: all contract tests pass with no TypeScript errors.

- [ ] **Step 5: Commit the workspace contract**

```bash
git add package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json .editorconfig .gitignore .env.example packages/contracts
git commit -m "chore: bootstrap workspace and contracts"
```

---

### Task 2: Implement Exact SESB Billing Calculations

**Files:**
- Create: `packages/billing/package.json`
- Create: `packages/billing/tsconfig.json`
- Create: `packages/billing/src/types.ts`
- Create: `packages/billing/src/calculate.ts`
- Create: `packages/billing/src/index.ts`
- Test: `packages/billing/src/calculate.test.ts`

**Interfaces:**
- Consumes: decimal strings from `@sesb/contracts`.
- Produces: `calculateTieredCharge(consumptionKwh: string, tiers: TariffTier[]): ChargeResult` and `formatRm(amountRm: string): string`.
- `TariffTier` is `{ lowerKwh: string; upperKwh: string | null; rateSenPerKwh: string }`.
- `ChargeResult` is `{ consumptionKwh: string; amountRm: string; displayAmountRm: string; allocations: TierAllocation[] }`.

- [ ] **Step 1: Write tariff boundary tests**

```ts
const tiers = [
  { lowerKwh: "0", upperKwh: "200", rateSenPerKwh: "22.02" },
  { lowerKwh: "200", upperKwh: "300", rateSenPerKwh: "37.76" },
  { lowerKwh: "300", upperKwh: "600", rateSenPerKwh: "49.26" },
  { lowerKwh: "600", upperKwh: "1000", rateSenPerKwh: "51.49" },
  { lowerKwh: "1000", upperKwh: "1500", rateSenPerKwh: "54.69" },
  { lowerKwh: "1500", upperKwh: null, rateSenPerKwh: "59.85" },
];

it.each([
  ["0", "0.00"], ["200", "44.04"], ["201", "44.42"],
  ["250", "62.92"], ["300", "81.80"], ["301", "82.29"],
  ["600", "229.58"], ["601", "230.09"], ["1000", "435.54"],
  ["1001", "436.09"], ["1500", "708.99"], ["1501", "709.59"],
])("prices %s kWh", (kwh, expected) => {
  expect(calculateTieredCharge(kwh, tiers).displayAmountRm).toBe(expected);
});
```

Also test negative consumption rejection and a fractional kWh case that proves half-up rounding.

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm --filter @sesb/billing test`

Expected: failure because `calculateTieredCharge` is not implemented.

- [ ] **Step 3: Implement cumulative allocation with Decimal.js**

For each tier, compute `max(0, min(consumption, upper) - lower)`, multiply by the rate in sen, divide by 100 for RM, and sum without converting to `number`. Return internal amounts as canonical decimal strings and `displayAmountRm` via `toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2)`.

Reject negative consumption, negative rates, non-contiguous tiers, a non-zero first lower boundary, and any tier after an open-ended tier.

- [ ] **Step 4: Run billing tests and type checking**

Run: `pnpm --filter @sesb/billing test && pnpm --filter @sesb/billing typecheck`

Expected: all boundary, validation, and rounding tests pass.

- [ ] **Step 5: Commit billing logic**

```bash
git add packages/billing pnpm-lock.yaml
git commit -m "feat: calculate tiered SESB estimates"
```

---

### Task 3: Create the PostgreSQL Schema, Migration, and Seed

**Files:**
- Create: `packages/database/package.json`
- Create: `packages/database/tsconfig.json`
- Create: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/0001_initial/migration.sql`
- Create: `packages/database/prisma/seed.ts`
- Create: `packages/database/src/client.ts`
- Create: `packages/database/src/index.ts`
- Create: `packages/database/test/database.test.ts`
- Create: `compose.test.yaml`

**Interfaces:**
- Produces: singleton `prisma: PrismaClient`, generated Prisma model types, `seedTariffs(client?: PrismaClient): Promise<void>`, and schema constraints relied on by API services.
- Monetary columns: `Decimal(20, 8)` for readings/consumption and `Decimal(20, 8)` for RM; tariff rates use `Decimal(12, 6)` sen/kWh.

- [ ] **Step 1: Write database integration tests**

Test that calling `seedTariffs()` twice leaves one tariff with exactly six ordered tiers, creating two active meters for one house fails, creating two active cycles for one house fails, duplicate meter/capture timestamps fail, and deleting a house cascades only inside an isolated test transaction/database.

```ts
it("seeds the approved tariff idempotently", async () => {
  await seedTariffs(prisma);
  await seedTariffs(prisma);
  const tariffs = await prisma.tariff.findMany({ include: { tiers: { orderBy: { order: "asc" } } } });
  expect(tariffs).toHaveLength(1);
  expect(tariffs[0]?.tiers.map((tier) => tier.rateSenPerKwh.toString()))
    .toEqual(["22.02", "37.76", "49.26", "51.49", "54.69", "59.85"]);
});
```

- [ ] **Step 2: Start test PostgreSQL and verify failure**

Run: `docker compose -f compose.test.yaml up -d postgres-test && pnpm --filter @sesb/database test`

Expected: failure because the schema and generated client are absent.

- [ ] **Step 3: Define the stable V1 Prisma models**

Create enums `CycleStatus { ACTIVE CLOSED }`, `OcrStatus { NOT_APPLICABLE PENDING SUCCEEDED FAILED }`, and `CycleActionType { START UNDO }`. Define `House`, `Meter`, `MeterReading`, `Tariff`, `TariffTier`, `BillingCycle`, and `CycleAction` with the fields and relations in the approved design.

Represent the immutable tariff snapshot as JSON with this runtime-validated shape:

```ts
type TariffSnapshot = {
  tariffId: string;
  name: string;
  effectiveStartDate: string;
  tiers: Array<{
    lowerKwh: string;
    upperKwh: string | null;
    rateSenPerKwh: string;
    order: number;
  }>;
};
```

Store `openingTimestamp`, `closingTimestamp`, `captureTimestamp`, and audit timestamps as `timestamptz`. Add normal indexes for foreign keys and reading history ordering.

- [ ] **Step 4: Add migration-only constraints and seed upsert**

After generating the initial SQL, add partial unique indexes:

```sql
CREATE UNIQUE INDEX "Meter_one_active_per_house"
ON "Meter" ("houseId") WHERE "active" = true;

CREATE UNIQUE INDEX "BillingCycle_one_active_per_house"
ON "BillingCycle" ("houseId") WHERE "status" = 'ACTIVE';

CREATE UNIQUE INDEX "MeterReading_meter_capture_unique"
ON "MeterReading" ("meterId", "captureTimestamp");
```

Add non-negative `CHECK` constraints to reading, rate, consumption, and amount columns. Seed by a stable unique key such as tariff name plus effective date, upserting the tariff and its six tiers inside a transaction so repeated deployments are safe.

- [ ] **Step 5: Apply migration and run integration tests**

Run: `pnpm --filter @sesb/database prisma:migrate:test && pnpm --filter @sesb/database test`

Expected: migration succeeds and all persistence/seed tests pass.

- [ ] **Step 6: Commit the persistence foundation**

```bash
git add packages/database compose.test.yaml pnpm-lock.yaml
git commit -m "feat: add monitoring database schema"
```

---

### Task 4: Build the API Foundation and Health Endpoint

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/src/app.ts`
- Create: `apps/api/src/server.ts`
- Create: `apps/api/src/routes/health.ts`
- Create: `apps/api/test/health.test.ts`

**Interfaces:**
- Consumes: `prisma` from `@sesb/database` and `ApiErrorSchema` from `@sesb/contracts`.
- Produces: `buildApp(options?: { prisma?: PrismaClient }): FastifyInstance` for production and injected tests.
- `GET /health` returns `{ status: "ok", database: "ok" }` or HTTP 503 with the standard error envelope.

- [ ] **Step 1: Write injected health tests**

```ts
it("reports API and database health", async () => {
  const app = buildApp({ prisma });
  const response = await app.inject({ method: "GET", url: "/health" });
  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({ status: "ok", database: "ok" });
});

it("never exposes stack traces", async () => {
  const app = buildApp({ prisma: failingPrisma });
  const response = await app.inject({ method: "GET", url: "/health" });
  expect(response.statusCode).toBe(503);
  expect(response.body).not.toContain("stack");
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `pnpm --filter @sesb/api test -- health.test.ts`

Expected: failure because `buildApp` does not exist.

- [ ] **Step 3: Implement app composition and safe errors**

Register CORS from `WEB_ORIGIN`, JSON schema validation, health routes, and a top-level error handler. Map Zod/Fastify validation to 400, domain validation to 422, missing resources to 404, uniqueness/state conflicts to 409, and unexpected failures to a logged 500 response. `server.ts` validates `PORT`, `HOST`, `DATABASE_URL`, and `WEB_ORIGIN`, listens, and closes Fastify/Prisma on `SIGTERM` or `SIGINT`.

- [ ] **Step 4: Run API health tests and type checking**

Run: `pnpm --filter @sesb/api test -- health.test.ts && pnpm --filter @sesb/api typecheck`

Expected: health tests pass and response bodies validate against the shared contract.

- [ ] **Step 5: Commit the API foundation**

```bash
git add apps/api pnpm-lock.yaml
git commit -m "feat: add API health foundation"
```

---

### Task 5: Implement Transactional House and Tariff APIs

**Files:**
- Create: `apps/api/src/services/houses.ts`
- Create: `apps/api/src/routes/houses.ts`
- Create: `apps/api/src/routes/tariffs.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/test/houses.test.ts`
- Test: `apps/api/test/tariffs.test.ts`

**Interfaces:**
- Produces: `createHouse(input: CreateHouseInput): Promise<HouseDetail>`, `listActiveHouses(): Promise<HouseSummary[]>`, `getHouse(id: string): Promise<HouseDetail>`, and `updateHouse(id: string, input: UpdateHouseInput): Promise<HouseDetail>`.
- HTTP routes: `GET /houses`, `POST /houses`, `GET /houses/:houseId`, `PATCH /houses/:houseId`, and `GET /tariffs/active`.

- [ ] **Step 1: Write house transaction and response tests**

Cover successful creation, whitespace trimming, rollback when meter creation fails, active-only listing, deactivation, missing-house 404, and active tariff tier ordering.

```ts
it("creates a house, meter, and uninitialised cycle atomically", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/houses",
    payload: { name: "Kota Kinabalu", meterLabel: "SESB-01" },
  });
  expect(response.statusCode).toBe(201);
  const body = response.json();
  expect(body.meter.label).toBe("SESB-01");
  expect(body.activeCycle.startingReadingId).toBeNull();
  expect(body.activeCycle.consumptionKwh).toBe("0");
});
```

- [ ] **Step 2: Run focused tests and verify failure**

Run: `pnpm --filter @sesb/api test -- houses.test.ts tariffs.test.ts`

Expected: 404 responses because routes are not registered.

- [ ] **Step 3: Implement house services and routes**

Use `prisma.$transaction` for creation. Create the house, active meter, and active cycle; initialise precise totals to zero and leave starting reading/tariff snapshot null. Query latest reading with `orderBy: { captureTimestamp: "desc" }`. Convert every Prisma Decimal to a string in response mappers.

Updates may change name, address, notes, or active status; they never delete records. List endpoints exclude inactive houses by default.

- [ ] **Step 4: Implement the active tariff endpoint**

Select the tariff whose effective range includes the current server date, order tiers ascending, and return a 404 `ACTIVE_TARIFF_NOT_FOUND` error if none exists. Return all decimal boundaries/rates as strings.

- [ ] **Step 5: Run house/tariff tests and the full API suite**

Run: `pnpm --filter @sesb/api test && pnpm --filter @sesb/api typecheck`

Expected: all tests pass; rollback tests leave no partial house records.

- [ ] **Step 6: Commit house and tariff APIs**

```bash
git add apps/api
git commit -m "feat: add house and tariff APIs"
```

---

### Task 6: Implement Current and Backdated Reading Transactions

**Files:**
- Create: `apps/api/src/services/readings.ts`
- Create: `apps/api/src/routes/readings.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/test/readings.test.ts`

**Interfaces:**
- Produces: `createManualReading(houseId: string, input: CreateReadingInput, now?: Date): Promise<ReadingCreatedResponse>` and `listReadings(houseId: string, cursor?: string, limit?: number): Promise<ReadingPage>`.
- HTTP routes: `POST /houses/:houseId/readings` and `GET /houses/:houseId/readings?cursor=<opaque>&limit=20`.
- `ReadingCreatedResponse` contains the created reading and updated active-cycle summary.

- [ ] **Step 1: Write first-reading and recalculation tests**

Test that the first reading sets cycle opening time and tariff snapshot with zero totals; a later reading recalculates from the snapshot; the 250 kWh example returns RM62.92; and an inactive/missing house is rejected.

```ts
it("uses a backdated first reading as the cycle baseline", async () => {
  const response = await postReading(houseId, {
    valueKwh: "1000",
    captureTimestamp: "2026-09-01T09:15:00+08:00",
  }, new Date("2026-10-03T00:00:00Z"));
  expect(response.activeCycle.openingTimestamp).toBe("2026-09-01T01:15:00.000Z");
  expect(response.activeCycle.consumptionKwh).toBe("0");
  expect(response.activeCycle.estimatedChargeRm).toBe("0.00");
});
```

- [ ] **Step 2: Write surrounding-reading validation tests**

Create readings at 08:00/1000 kWh and 10:00/1200 kWh, then verify 09:00/1100 succeeds, 09:00/999 and 09:00/1201 fail with a `valueKwh` field error, duplicate timestamps return 409, a future timestamp fails, and a reading before the cycle baseline fails. Verify history remains reverse chronological and totals still use 10:00/1200.

- [ ] **Step 3: Run focused tests and verify failure**

Run: `pnpm --filter @sesb/api test -- readings.test.ts`

Expected: 404 because reading routes are not registered.

- [ ] **Step 4: Implement one transactional reading workflow**

Inside a serializable transaction:

1. Load the active house, active meter, and active cycle.
2. Parse the input with shared schemas and Decimal.js.
3. Reject capture times after injected `now`.
4. For an initial reading, select the tariff effective at capture time, create its immutable snapshot, set cycle opening time, and use zero totals.
5. Otherwise reject capture times before the starting reading, query the immediate previous and next readings, and validate the proposed value against both.
6. Insert with `ocrStatus: NOT_APPLICABLE`, `manualCorrection: false`, and null OCR/photo fields.
7. Query the chronologically latest reading, calculate consumption and charge from the cycle snapshot, and update the active cycle.
8. Return mapped decimal strings after commit.

Retry serialization failures a small bounded number of times, then return a safe 409 conflict. Translate the database duplicate timestamp constraint into `READING_TIMESTAMP_CONFLICT`.

- [ ] **Step 5: Implement cursor history**

Default `limit` to 20 and cap it at 100. Order by `captureTimestamp desc, id desc`; use the encoded pair as the cursor so equal-order pagination is stable. Return `{ items, nextCursor }`.

- [ ] **Step 6: Run API integration and billing suites**

Run: `pnpm --filter @sesb/api test && pnpm --filter @sesb/billing test && pnpm typecheck`

Expected: all current, backdated, adjacency, pagination, and recalculation tests pass.

- [ ] **Step 7: Commit reading behavior**

```bash
git add apps/api
git commit -m "feat: add current and backdated readings"
```

---

### Task 7: Build the Web Shell, API Client, and Dashboard

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/index.html`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/app.tsx`
- Create: `apps/web/src/index.css`
- Create: `apps/web/src/lib/api.ts`
- Create: `apps/web/src/lib/datetime.ts`
- Create: `apps/web/src/components/app-shell.tsx`
- Create: `apps/web/src/components/feedback.tsx`
- Create: `apps/web/src/features/dashboard/dashboard-page.tsx`
- Create: `apps/web/src/features/dashboard/house-card.tsx`
- Create: `apps/web/src/test/setup.ts`
- Test: `apps/web/src/features/dashboard/dashboard-page.test.tsx`
- Test: `apps/web/src/lib/datetime.test.ts`

**Interfaces:**
- Consumes: shared response contracts and `GET /houses`.
- Produces: `api.getHouses()`, `api.getHouse(id)`, `api.createHouse(input)`, `api.updateHouse(id, input)`, `api.createReading(houseId, input)`, `api.getReadings(houseId, cursor)`, and route `/`.
- Produces: `toKuchingInputValue(date: Date): string`, `fromKuchingInputValue(value: string): string`, and `formatKuchingDateTime(iso: string): string`.

- [ ] **Step 1: Write dashboard and timezone tests**

```tsx
it("labels charges as estimates and prompts empty houses", async () => {
  server.use(mockHouseList([
    houseSummary({ latestReading: null, estimatedChargeRm: "0.00" }),
    houseSummary({ latestReading: reading({ valueKwh: "1250" }), estimatedChargeRm: "62.92" }),
  ]));
  renderApp("/");
  expect(await screen.findByText("Add first reading")).toBeVisible();
  expect(screen.getByText("Estimated RM62.92")).toBeVisible();
});
```

Test `Asia/Kuching` conversion independently of the machine timezone and assert loading, empty, error, and populated states.

- [ ] **Step 2: Run web tests and verify failure**

Run: `pnpm --filter @sesb/web test -- dashboard-page.test.tsx datetime.test.ts`

Expected: failure because the web application does not exist.

- [ ] **Step 3: Create the web application and typed client**

Configure Vite, React Router, TanStack Query, Tailwind, Testing Library, MSW, and Vitest. The fetch client reads `VITE_API_URL`, parses successful payloads with shared schemas, and throws `ApiClientError` containing `status`, `code`, `message`, and `fields` for standard API errors.

Use `Intl.DateTimeFormat` with `timeZone: "Asia/Kuching"` for display. Convert `datetime-local` values to explicit `+08:00` ISO input without relying on the browser's machine timezone.

- [ ] **Step 4: Implement the responsive dashboard**

Use a single-column phone layout and expanding desktop grid. Every house card displays latest reading/time, cycle date/age, kWh consumption, and `Estimated RMx.xx`. Empty houses expose an `Add first reading` link to `/houses/:id`. Provide retryable unavailable feedback without hiding the page shell.

- [ ] **Step 5: Run dashboard tests, type checking, and production build**

Run: `pnpm --filter @sesb/web test && pnpm --filter @sesb/web typecheck && pnpm --filter @sesb/web build`

Expected: tests pass and Vite creates a production bundle.

- [ ] **Step 6: Commit the web dashboard**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "feat: add responsive usage dashboard"
```

---

### Task 8: Add House Creation and Editing UI

**Files:**
- Create: `apps/web/src/features/houses/house-form.tsx`
- Create: `apps/web/src/features/houses/new-house-page.tsx`
- Create: `apps/web/src/features/houses/edit-house-page.tsx`
- Modify: `apps/web/src/app.tsx`
- Modify: `apps/web/src/features/dashboard/dashboard-page.tsx`
- Test: `apps/web/src/features/houses/house-form.test.tsx`

**Interfaces:**
- Consumes: `api.createHouse`, `api.updateHouse`, shared house inputs, and router navigation.
- Produces routes `/houses/new` and `/houses/:houseId/edit`.

- [ ] **Step 1: Write form behavior tests**

Test required name/meter label errors, optional address/notes, disabled pending submit, retained values after API failure, successful navigation to the new house, populated edit values, and deactivation confirmation.

```tsx
it("retains values when the API rejects creation", async () => {
  server.use(mockCreateHouseError({ code: "HOUSE_CONFLICT", message: "House already exists" }));
  renderApp("/houses/new");
  await user.type(screen.getByLabelText("House name"), "Parents' house");
  await user.type(screen.getByLabelText("Meter label"), "SESB-02");
  await user.click(screen.getByRole("button", { name: "Create house" }));
  expect(await screen.findByText("House already exists")).toBeVisible();
  expect(screen.getByLabelText("House name")).toHaveValue("Parents' house");
});
```

- [ ] **Step 2: Run focused tests and verify failure**

Run: `pnpm --filter @sesb/web test -- house-form.test.tsx`

Expected: failure because the routes and form do not exist.

- [ ] **Step 3: Implement accessible house forms**

Use React Hook Form with the shared Zod schema. Render persistent labels, field errors, a top-level API error, and touch targets at least 44px high. On creation, navigate to `/houses/:id`; on edit, invalidate both detail and dashboard queries. Require an explicit confirmation before deactivation.

- [ ] **Step 4: Verify form and dashboard integration**

Run: `pnpm --filter @sesb/web test && pnpm --filter @sesb/web typecheck`

Expected: house forms pass and the dashboard still renders correctly.

- [ ] **Step 5: Commit house management UI**

```bash
git add apps/web
git commit -m "feat: add house management forms"
```

---

### Task 9: Add House Detail, Backdated Reading Entry, and History

**Files:**
- Create: `apps/web/src/features/houses/house-detail-page.tsx`
- Create: `apps/web/src/features/readings/reading-form.tsx`
- Create: `apps/web/src/features/readings/reading-history.tsx`
- Modify: `apps/web/src/app.tsx`
- Test: `apps/web/src/features/readings/reading-form.test.tsx`
- Test: `apps/web/src/features/houses/house-detail-page.test.tsx`

**Interfaces:**
- Consumes: `api.getHouse`, `api.getReadings`, `api.createReading`, and Kuching date helpers.
- Produces: route `/houses/:houseId`, a current-cycle summary, an explicit `Backdate reading` control, manual reading submission, and reverse-chronological paginated history.

- [ ] **Step 1: Write current and backdated form tests**

```tsx
it("reveals past date and time controls and preserves them after rejection", async () => {
  server.use(mockReadingError({
    code: "READING_SEQUENCE_INVALID",
    message: "Reading must fit between surrounding readings",
    fields: { valueKwh: "Enter a value from 1000 to 1200 kWh" },
  }));
  renderApp(`/houses/${houseId}`);
  await user.click(await screen.findByLabelText("Backdate reading"));
  await user.clear(screen.getByLabelText("Reading date"));
  await user.type(screen.getByLabelText("Reading date"), "2026-09-02");
  await user.clear(screen.getByLabelText("Reading time"));
  await user.type(screen.getByLabelText("Reading time"), "09:30");
  await user.type(screen.getByLabelText("Meter reading (kWh)"), "999");
  await user.click(screen.getByRole("button", { name: "Save reading" }));
  expect(await screen.findByText("Enter a value from 1000 to 1200 kWh")).toBeVisible();
  expect(screen.getByLabelText("Reading date")).toHaveValue("2026-09-02");
  expect(screen.getByLabelText("Reading time")).toHaveValue("09:30");
});
```

Also test that current entry defaults to now, backdate rejects a future local value before submission, pending state prevents double submission, success clears the form, and server field errors map to controls.

- [ ] **Step 2: Write detail and history tests**

Test zero-state baseline guidance, estimated summary display, reverse chronological readings, saved versus captured timestamps, `Manual entry` status, load-more pagination, and insertion of a backdated reading between two existing items without changing the latest summary.

- [ ] **Step 3: Run focused tests and verify failure**

Run: `pnpm --filter @sesb/web test -- reading-form.test.tsx house-detail-page.test.tsx`

Expected: failure because the detail route and reading components do not exist.

- [ ] **Step 4: Implement the reading form**

Keep the kWh control visible at all times. With backdating off, submit the current Kuching timestamp captured at submission. With it on, expose separate native date and time inputs, combine them into an explicit `+08:00` ISO value, and set their maximum to the current Kuching date/time. Do not clear any form state on an error. Disable the entire submit action while pending.

- [ ] **Step 5: Implement detail summary and history**

Show baseline/latest values, consumption, and `Estimated RMx.xx`. Render history as accessible cards on phones and a table-like grid on wider screens. Display capture time first and saved time second. After successful creation, invalidate the house, reading-history, and dashboard queries so totals and ordering update immediately.

- [ ] **Step 6: Run the complete web suite and build**

Run: `pnpm --filter @sesb/web test && pnpm --filter @sesb/web typecheck && pnpm --filter @sesb/web build`

Expected: all form, detail, history, dashboard, and timezone tests pass.

- [ ] **Step 7: Commit the complete manual reading UI**

```bash
git add apps/web
git commit -m "feat: add backdated reading workflow"
```

---

### Task 10: Package with Docker and Verify the Complete Flow

**Files:**
- Create: `apps/api/Dockerfile`
- Create: `apps/web/Dockerfile`
- Create: `apps/web/nginx.conf`
- Create: `compose.yaml`
- Create: `apps/web/playwright.config.ts`
- Create: `apps/web/e2e/manual-monitoring.spec.ts`
- Create: `README.md`
- Modify: `package.json`
- Modify: `.env.example`

**Interfaces:**
- Produces: independently deployable `web`, `api`, and `postgres` services; named `postgres_data` and `meter_photos` volumes; root `pnpm e2e` and `pnpm verify` commands.
- Web health endpoint: `/healthz`; API health endpoint: `/health`; PostgreSQL uses `pg_isready`.

- [ ] **Step 1: Write the Playwright smoke test**

```ts
test("creates a house and preserves latest totals after backdated insertion", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Add house" }).click();
  await page.getByLabel("House name").fill("Family home");
  await page.getByLabel("Meter label").fill("SESB-01");
  await page.getByRole("button", { name: "Create house" }).click();

  await addReading(page, "1000", { backdate: ["2026-09-01", "08:00"] });
  await addReading(page, "1250", { backdate: ["2026-09-03", "08:00"] });
  await expect(page.getByText("250 kWh")).toBeVisible();
  await expect(page.getByText("Estimated RM62.92")).toBeVisible();

  await addReading(page, "1100", { backdate: ["2026-09-02", "08:00"] });
  await expect(page.getByTestId("reading-history").locator("li")).toHaveText([
    /1250/, /1100/, /1000/,
  ]);
  await expect(page.getByText("Estimated RM62.92")).toBeVisible();
});
```

Keep the smoke-test timestamps fixed in the past; service-level future-time tests inject their comparison clock directly into `createManualReading`.

- [ ] **Step 2: Run the smoke test and verify environment failure**

Run: `pnpm --filter @sesb/web e2e`

Expected: failure because the deployable services and Playwright web server are not configured.

- [ ] **Step 3: Create production containers**

Use multi-stage Node builds. The API image runs migrations and the idempotent seed as a controlled startup command before launching the compiled server. The web image serves the Vite bundle with nginx, provides `/healthz`, and routes SPA paths to `index.html`. Do not bake secrets into either image.

Configure Compose dependencies using health conditions, bind API only through its service network where possible, and persist PostgreSQL plus an unused-but-ready `/data/meter-photos` volume for the approved future OCR slice.

- [ ] **Step 4: Document local and Dokploy operation**

Document `corepack enable`, `.env` creation, `docker compose up --build`, migration/seed behavior, ports, health checks, backup coverage for both named volumes, HTTPS routing, and the requirement to restrict access because authentication is absent. Include exact test and verification commands.

- [ ] **Step 5: Run full automated verification**

Run: `pnpm verify`

Expected: contracts, billing, database, API, and web tests pass; all packages type-check; production builds succeed.

- [ ] **Step 6: Run container and browser verification**

Run: `docker compose up -d --build && pnpm --filter @sesb/web e2e`

Expected: all services become healthy and the complete current/backdated reading smoke test passes at phone and desktop Playwright viewports.

- [ ] **Step 7: Inspect runtime health and logs**

Run: `docker compose ps && docker compose logs --no-color --tail=100 api web postgres`

Expected: all services are healthy, no secrets or stack traces appear, and startup shows one successful migration/seed sequence.

- [ ] **Step 8: Commit deployment and verification assets**

```bash
git add apps/api/Dockerfile apps/web/Dockerfile apps/web/nginx.conf apps/web/playwright.config.ts apps/web/e2e compose.yaml README.md package.json .env.example pnpm-lock.yaml
git commit -m "feat: package core monitoring slice"
```

---

## Final Acceptance Check

- [ ] Run `pnpm verify` from a clean checkout.
- [ ] Run `docker compose up -d --build` with a fresh PostgreSQL volume.
- [ ] Confirm the idempotent seed remains unchanged after a restart.
- [ ] Complete house creation, baseline reading, later reading, and valid backdated insertion at a phone viewport.
- [ ] Confirm 250 kWh displays exactly `Estimated RM62.92`.
- [ ] Confirm invalid future, duplicate-time, lower-than-previous, and greater-than-next readings preserve form input and do not change totals.
- [ ] Confirm the desktop layout has no regressions and the API unavailable state is understandable.
- [ ] Confirm `git status --short` contains no generated, secret, or unrelated files staged for commit.
