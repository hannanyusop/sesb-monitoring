# Mobile Cycle Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add safe billing-cycle transitions, undo, kWh/RM budgets, estimated daily usage, average usage, previous-cycle comparison, and a phone-first cycle workspace.

**Architecture:** Extend the existing Prisma schema and shared Zod contracts, keep interpolation/budget/comparison calculations in pure billing-package functions, and execute cycle mutations in serializable API transactions. Refactor the React house page into focused components that consume server-computed insights and use Recharts only for presentation.

**Tech Stack:** TypeScript, Prisma/PostgreSQL, Fastify, Zod, Decimal.js, React, TanStack Query, React Hook Form, Recharts, Vitest, Testing Library, Playwright, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-10-03-cycle-workspace-design.md`

## Global Constraints

- All dates used for chart grouping and cycle duration use `Asia/Kuching`.
- Decimal values cross JSON as strings and remain PostgreSQL numeric/Decimal.js values internally.
- A custom start never modifies the preceding cycle or its final reading.
- A non-zero custom-start gap requires explicit acknowledgement and is recorded in action metadata.
- Undo is eligible through exactly ten minutes and only before a later reading exists.
- House budget changes update the active cycle and future default but never closed cycles.
- Daily points are estimates distributed across represented local dates; no unobserved period is forecast.
- Closed-cycle totals, tariff snapshots, budget snapshots, and readings remain immutable.

## File Structure

```text
packages/contracts/src/cycles.ts             # Cycle, budget, insight DTO schemas
packages/billing/src/insights.ts              # Daily allocation, budget, comparison math
packages/database/prisma/migrations/...       # Budget/source/action metadata migration
apps/api/src/services/cycles.ts               # Preview/start/undo/list/insights transactions
apps/api/src/routes/cycles.ts                 # Cycle and budget HTTP boundary
apps/web/src/features/cycles/                 # Mobile cycle workspace components
apps/web/src/features/houses/house-detail-page.tsx # Composition and selected-cycle state
```

---

### Task 1: Extend Contracts and Persistence

**Files:**
- Create: `packages/contracts/src/cycles.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `packages/contracts/src/readings.ts`
- Modify: `packages/contracts/src/houses.ts`
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/20261003220000_cycle_workspace/migration.sql`
- Test: `packages/contracts/src/contracts.test.ts`
- Test: `packages/database/test/database.test.ts`

**Interfaces:**
- Produces `BudgetTypeSchema`, `CycleModeSchema`, `CyclePreviewInputSchema`, `StartCycleInputSchema`, `CycleSummaryDetailSchema`, `CycleInsightsSchema`, and inferred types.
- Adds `BudgetType { KWH RM }` and `ReadingSource { MANUAL OCR CYCLE_START_OVERRIDE }` Prisma enums.

- [ ] Add failing schema tests for valid carry-forward/custom inputs, rejected unacknowledged gaps, nullable budget removal, and decimal-string responses.
- [ ] Define inputs exactly around `{ startTimestamp, mode, customStartKwh? }`, `{ acknowledgedGap, reason? }`, and `{ type: "KWH" | "RM" | null, value: string | null }`.
- [ ] Add nullable house defaults, nullable cycle snapshots, reading source/reason, and action metadata to Prisma.
- [ ] Add SQL checks requiring paired positive budget type/value fields.
- [ ] Generate Prisma Client, migrate the test database, and prove existing records default to `MANUAL`.
- [ ] Run `pnpm --filter @sesb/contracts test && pnpm --filter @sesb/database test && pnpm typecheck`.
- [ ] Commit with `git commit -m "feat: add cycle workspace data contracts"`.

---

### Task 2: Implement Pure Insight Calculations

**Files:**
- Create: `packages/billing/src/insights.ts`
- Create: `packages/billing/src/insights.test.ts`
- Modify: `packages/billing/src/index.ts`

**Interfaces:**
- `allocateEstimatedDailyUsage(readings: InsightReading[]): DailyUsageResult`
- `calculateBudgetProgress(type: "KWH" | "RM", value: string, consumptionKwh: string, amountRm: string): BudgetProgress`
- `calculateComparison(current: string, previous: string): { difference: string; percentChange: string | null }`

- [ ] Write same-day, multi-day, month-boundary, fractional, empty, and Kuching-offset allocation tests.
- [ ] Implement local-date iteration with a fixed `+08:00` conversion and Decimal.js division/summing.
- [ ] Write budget tests for green, amber, exhausted, and over-budget states for both units.
- [ ] Write comparison tests for increase, decrease, equality, and zero prior baseline.
- [ ] Run `pnpm --filter @sesb/billing test && pnpm --filter @sesb/billing typecheck`.
- [ ] Commit with `git commit -m "feat: calculate cycle usage insights"`.

---

### Task 3: Add Transactional Cycle and Budget APIs

**Files:**
- Create: `apps/api/src/services/cycles.ts`
- Create: `apps/api/src/routes/cycles.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/mappers.ts`
- Modify: `apps/api/src/services/houses.ts`
- Test: `apps/api/test/cycles.test.ts`

**Interfaces:**
- `previewCycle(houseId, input, now?): Promise<CyclePreview>`
- `startCycle(houseId, input, now?, attempt?): Promise<StartCycleResponse>`
- `undoCycle(houseId, cycleId, now?, attempt?): Promise<UndoCycleResponse>`
- `listCycles(houseId): Promise<CycleSummaryDetail[]>`
- `getCycleInsights(houseId, cycleId): Promise<CycleInsights>`
- `setBudget(houseId, input): Promise<BudgetResponse>`

- [ ] Write failing integration tests for carry-forward, custom gaps, equal-value fallback, invalid acknowledgement/time/value, and complete action metadata.
- [ ] Implement a shared preview loader that re-runs inside start transactions so stale previews cannot commit.
- [ ] Close the old cycle and create the new cycle in one serializable transaction; create an override reading only for non-zero custom gaps.
- [ ] Add bounded retry for Prisma `P2034` conflicts.
- [ ] Write and implement undo tests before/at/after ten minutes and after an additional reading.
- [ ] Write and implement budget snapshot tests that prove closed cycles remain unchanged.
- [ ] Implement insights by loading selected/previous cycles and readings, then calling billing-package functions.
- [ ] Register preview/start/undo/list/insights/budget routes with shared Zod parsing and stable domain error codes.
- [ ] Run `pnpm --filter @sesb/api test && pnpm typecheck`.
- [ ] Commit with `git commit -m "feat: add billing cycle and budget APIs"`.

---

### Task 4: Build the Mobile Cycle Workspace

**Files:**
- Create: `apps/web/src/features/cycles/cycle-summary.tsx`
- Create: `apps/web/src/features/cycles/cycle-selector.tsx`
- Create: `apps/web/src/features/cycles/budget-indicator.tsx`
- Create: `apps/web/src/features/cycles/budget-editor.tsx`
- Create: `apps/web/src/features/cycles/daily-usage-chart.tsx`
- Create: `apps/web/src/features/cycles/cycle-comparison.tsx`
- Create: `apps/web/src/features/cycles/start-cycle-sheet.tsx`
- Create: `apps/web/src/features/cycles/undo-cycle-notice.tsx`
- Create: `apps/web/src/features/cycles/cycle-workspace.test.tsx`
- Modify: `apps/web/src/features/houses/house-detail-page.tsx`
- Modify: `apps/web/src/features/readings/reading-form.tsx`
- Modify: `apps/web/src/features/readings/reading-history.tsx`
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/index.css`
- Modify: `apps/web/package.json`

**Interfaces:**
- API client adds `previewCycle`, `startCycle`, `undoCycle`, `getCycles`, `getCycleInsights`, and `setBudget`.
- The house page owns `selectedCycleId`; focused components own only their local form/display state.

- [ ] Write component tests for summary order, full-width start action, cycle selection, budget accessible copy, chart summary/average, comparison empty states, and bottom-sheet retained input.
- [ ] Add Recharts and build an accessible bar chart whose textual summary remains meaningful without SVG.
- [ ] Implement budget editing with kWh/RM segmented control and field-preserving API errors.
- [ ] Implement the start sheet with carry-forward default, server preview, custom value, gap acknowledgement, optional reason, focus restoration, and mobile bottom-sheet CSS.
- [ ] Implement undo notice using the server expiry timestamp; treat the server response as authoritative.
- [ ] Refactor house detail so closed cycles are read-only and the active cycle keeps reading controls.
- [ ] Collapse reading entry/history on phones using accessible disclosure controls.
- [ ] Run `pnpm --filter @sesb/web test && pnpm --filter @sesb/web typecheck && pnpm --filter @sesb/web build`.
- [ ] Commit with `git commit -m "feat: add mobile cycle workspace"`.

---

### Task 5: Verify Containers and Complete Workflows

**Files:**
- Create: `apps/web/e2e/cycle-workspace.spec.ts`
- Modify: `README.md`

**Interfaces:**
- Extends the existing Docker application and Playwright phone/desktop projects without new services.

- [ ] Add browser coverage for RM budget, carry-forward plus undo, custom-gap cycle, later/backdated readings, chart average, closed-cycle selection, and comparison.
- [ ] Run `pnpm verify` against migrated test PostgreSQL.
- [ ] Run `docker compose up -d --build --wait` and confirm web/API/PostgreSQL health.
- [ ] Run `pnpm --filter @sesb/web e2e` at phone and desktop sizes.
- [ ] Inspect logs for uncaught errors, stack traces, migration failures, and retry exhaustion.
- [ ] Document the new workflow and migration behavior in `README.md`.
- [ ] Commit with `git commit -m "test: verify cycle workspace workflows"`.

## Final Acceptance Check

- [ ] Start and undo a carry-forward cycle from a phone viewport.
- [ ] Start a custom-boundary cycle without changing the closed cycle's final reading.
- [ ] Confirm non-zero gaps require acknowledgement and appear in action metadata.
- [ ] Set kWh and RM budgets and verify remaining/over-budget accessible text.
- [ ] Verify estimated daily points and average against known reading intervals.
- [ ] Select a closed cycle and compare it with its predecessor.
- [ ] Confirm all automated suites, builds, health checks, and phone/desktop flows pass.
