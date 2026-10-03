# Floating House Navigation and Database Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the global top bar, add bottom-floating navigation to house workspaces, and provide explicit migration-only and destructive fresh-and-seed API operations.

**Architecture:** A reusable React `HouseNavigation` derives its active item from the router and links to stable overview/readings anchors or the existing edit route. A focused Fastify database-operation service serializes fixed Prisma CLI commands, while a thin admin route module exposes the two approved POST endpoints through an injectable interface for safe tests.

**Tech Stack:** React 19, React Router 7, Vitest, Testing Library, Playwright, Fastify 5, Prisma 6, Node.js `child_process`, TypeScript, pnpm.

**Spec:** `docs/superpowers/specs/2026-10-04-floating-house-navigation-database-operations-design.md`

## Global Constraints

- Preserve all pre-existing uncommitted work, especially current changes in `README.md`, `apps/api/src/app.ts`, and `apps/web/src/features/houses/house-detail-page.tsx`.
- Do not add application-level authentication to the database endpoints.
- `fresh-seed` permanently deletes all monitoring data and must remain visibly documented as destructive.
- Commands must be fixed argument arrays executed without a shell and without request-controlled command input.
- The floating navigation must fit the existing 320-pixel minimum viewport and respect the bottom safe area.
- Do not add a database administration UI or a standalone seed endpoint.

---

### Task 1: Remove the top bar and build the reusable house navigation

**Files:**
- Create: `apps/web/src/components/app-shell.test.tsx`
- Create: `apps/web/src/components/house-navigation.tsx`
- Create: `apps/web/src/components/house-navigation.test.tsx`
- Modify: `apps/web/src/components/app-shell.tsx`
- Modify: `apps/web/src/index.css`

**Interfaces:**
- Consumes: React Router location and links from the existing `BrowserRouter`.
- Produces: `HouseNavigation({ houseId }: { houseId: string }): JSX.Element`, stable accessible destination names, and `.page-with-house-nav` layout spacing.

- [ ] **Step 1: Add failing shell and navigation tests**

Create `apps/web/src/components/app-shell.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AppShell } from "./app-shell.js";

describe("AppShell", () => {
  it("renders page content without the former top bar", () => {
    render(<MemoryRouter><AppShell><p>Dashboard content</p></AppShell></MemoryRouter>);
    expect(screen.getByText("Dashboard content")).toBeVisible();
    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
    expect(screen.queryByText("Electric usage monitor")).not.toBeInTheDocument();
  });
});
```

Create `apps/web/src/components/house-navigation.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { HouseNavigation } from "./house-navigation.js";

function renderNavigation(path: string) {
  render(<MemoryRouter initialEntries={[path]}><HouseNavigation houseId="house-1" /></MemoryRouter>);
}

describe("HouseNavigation", () => {
  it("links to every approved house destination", () => {
    renderNavigation("/houses/house-1");
    expect(screen.getByRole("link", { name: "All Houses" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute("href", "/houses/house-1#overview");
    expect(screen.getByRole("link", { name: "Readings" })).toHaveAttribute("href", "/houses/house-1#readings");
    expect(screen.getByRole("link", { name: "Edit" })).toHaveAttribute("href", "/houses/house-1/edit");
  });

  it.each([
    ["/houses/house-1", "Overview"],
    ["/houses/house-1#overview", "Overview"],
    ["/houses/house-1#readings", "Readings"],
    ["/houses/house-1/edit", "Edit"],
  ])("marks %s as %s", (path, label) => {
    renderNavigation(path);
    expect(screen.getByRole("link", { name: label })).toHaveAttribute("aria-current", "page");
  });
});
```

- [ ] **Step 2: Run the focused tests and confirm they fail**

Run:

```bash
pnpm --filter @sesb/web test -- src/components/app-shell.test.tsx src/components/house-navigation.test.tsx
```

Expected: FAIL because `HouseNavigation` does not exist and `AppShell` still renders the banner.

- [ ] **Step 3: Implement the shell and navigation component**

Replace `AppShell` with a page-only wrapper:

```tsx
import type { PropsWithChildren } from "react";

export function AppShell({ children }: PropsWithChildren) {
  return <main className="page">{children}</main>;
}
```

Create `house-navigation.tsx` with fixed destinations and route-derived state:

```tsx
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
```

Remove the obsolete `.topbar`, `.brand`, and `.brand-mark` rules. Add `.house-navigation` styles that fix the pill at bottom center, use the existing ink/teal palette, visibly style `[aria-current="page"]` and `:focus-visible`, and apply `max-width: calc(100vw - 24px)` plus `bottom: max(12px, env(safe-area-inset-bottom))`. Add `.page-with-house-nav { padding-bottom: 130px; }`. In the mobile media query, remove `.topbar` selectors and shorten gaps/padding so all four links fit at 320 pixels.

- [ ] **Step 4: Run focused tests and the web type-check**

Run:

```bash
pnpm --filter @sesb/web test -- src/components/app-shell.test.tsx src/components/house-navigation.test.tsx
pnpm --filter @sesb/web typecheck
```

Expected: all focused tests PASS and TypeScript reports no errors.

- [ ] **Step 5: Commit only this task's changes**

```bash
git add apps/web/src/components/app-shell.tsx apps/web/src/components/app-shell.test.tsx apps/web/src/components/house-navigation.tsx apps/web/src/components/house-navigation.test.tsx apps/web/src/index.css
git commit -m "feat: add floating house navigation"
```

---

### Task 2: Integrate the floating navigation into house pages

**Files:**
- Modify: `apps/web/src/features/houses/house-detail-page.tsx`
- Modify: `apps/web/src/features/houses/edit-house-page.tsx`
- Modify: `apps/web/e2e/manual-monitoring.spec.ts`

**Interfaces:**
- Consumes: `HouseNavigation({ houseId })`, `#overview`, `#readings`, and `.page-with-house-nav` from Task 1.
- Produces: Navigable house detail/edit pages with stable anchor targets and end-to-end coverage.

- [ ] **Step 1: Extend the existing Playwright flow with failing navigation checks**

After house creation in `manual-monitoring.spec.ts`, assert and exercise the navigation before adding readings:

```ts
const houseNavigation = page.getByRole("navigation", { name: "House navigation" });
await expect(houseNavigation).toBeVisible();
await expect(houseNavigation.getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
await houseNavigation.getByRole("link", { name: "Readings" }).click();
await expect(page).toHaveURL(/#readings$/);
await expect(houseNavigation.getByRole("link", { name: "Readings" })).toHaveAttribute("aria-current", "page");
await houseNavigation.getByRole("link", { name: "Edit" }).click();
await expect(page.getByRole("heading", { name: /Edit Family home/ })).toBeVisible();
await page.getByRole("navigation", { name: "House navigation" }).getByRole("link", { name: "Overview" }).click();
await expect(page.getByRole("heading", { name: /^Family home/ })).toBeVisible();
```

Retain the generated suffix in regex-safe form or use the exact generated house name stored in a local variable so the heading assertions remain deterministic.

- [ ] **Step 2: Run the focused E2E test and confirm it fails**

With the test stack running, run:

```bash
pnpm --filter @sesb/web e2e -- e2e/manual-monitoring.spec.ts
```

Expected: FAIL because the house pages do not yet render the navigation or anchor targets.

- [ ] **Step 3: Add navigation and stable sections to both pages**

In `house-detail-page.tsx`:

- import `HouseNavigation`;
- add `id="overview"` and `className="page-with-house-nav"` to the outer section;
- add `id="readings"` to the existing readings `<details>`; and
- render `<HouseNavigation houseId={houseId} />` as the final child of the section.

Keep all current cycle-workspace logic and the user's existing uncommitted `selectedCycleId` behavior intact.

In `edit-house-page.tsx`:

- import `HouseNavigation`;
- add `page-with-house-nav` alongside `narrow` on the outer section; and
- render `<HouseNavigation houseId={houseId} />` after the deactivate button.

- [ ] **Step 4: Run web tests, type-check, and the focused E2E test**

```bash
pnpm --filter @sesb/web test
pnpm --filter @sesb/web typecheck
pnpm --filter @sesb/web e2e -- e2e/manual-monitoring.spec.ts
```

Expected: all commands PASS; the bar is available on detail/edit but absent from dashboard/new-house screens.

- [ ] **Step 5: Commit only the navigation integration hunks**

Because `house-detail-page.tsx` already contains user changes, inspect and stage only the new navigation hunks:

```bash
git diff -- apps/web/src/features/houses/house-detail-page.tsx apps/web/src/features/houses/edit-house-page.tsx apps/web/e2e/manual-monitoring.spec.ts
git add -p apps/web/src/features/houses/house-detail-page.tsx
git add apps/web/src/features/houses/edit-house-page.tsx apps/web/e2e/manual-monitoring.spec.ts
git commit -m "feat: integrate house workspace navigation"
```

---

### Task 3: Build the serialized database-operation service

**Files:**
- Create: `apps/api/src/services/database-operations.ts`
- Create: `apps/api/test/database-operations.test.ts`

**Interfaces:**
- Consumes: `PrismaClient.$disconnect()`, `PrismaClient.$connect()`, fixed pnpm commands, and the existing `DomainError`.
- Produces: `DatabaseOperations` with `migrate(): Promise<DatabaseOperationResult>` and `freshSeed(): Promise<DatabaseOperationResult>`; `createDatabaseOperations(options)` for production and tests.

- [ ] **Step 1: Write failing service tests**

Create tests with injected spies for `runCommand`, `$disconnect`, and `$connect`. Cover these exact behaviors:

```ts
it("runs migration only without disconnecting or seeding", async () => {
  const operations = createDatabaseOperations({ prisma, runCommand });
  await expect(operations.migrate()).resolves.toEqual({ operation: "migrate", status: "completed" });
  expect(runCommand).toHaveBeenCalledOnce();
  expect(runCommand).toHaveBeenCalledWith(["--filter", "@sesb/database", "db:migrate"]);
  expect(prisma.$disconnect).not.toHaveBeenCalled();
});

it("disconnects, resets, seeds, and reconnects in order", async () => {
  const operations = createDatabaseOperations({ prisma, runCommand });
  await expect(operations.freshSeed()).resolves.toEqual({ operation: "fresh-seed", status: "completed" });
  expect(events).toEqual(["disconnect", "reset", "seed", "connect"]);
});

it("rejects a concurrent operation", async () => {
  const first = operations.migrate();
  await expect(operations.freshSeed()).rejects.toMatchObject({ statusCode: 409, code: "DATABASE_OPERATION_IN_PROGRESS" });
  releaseFirstCommand();
  await first;
});

it("attempts to reconnect when reset fails", async () => {
  runCommand.mockRejectedValueOnce(new Error("reset failed"));
  await expect(operations.freshSeed()).rejects.toThrow("reset failed");
  expect(prisma.$connect).toHaveBeenCalledOnce();
});
```

Use a deferred promise in the concurrency test; do not use timers or call a real executable.

- [ ] **Step 2: Run the focused service test and confirm it fails**

```bash
pnpm --filter @sesb/api test -- test/database-operations.test.ts
```

Expected: FAIL because the service module does not exist.

- [ ] **Step 3: Implement the service and fixed command runner**

Define:

```ts
export type DatabaseOperationResult = {
  operation: "migrate" | "fresh-seed";
  status: "completed";
};

export type DatabaseOperations = {
  migrate(): Promise<DatabaseOperationResult>;
  freshSeed(): Promise<DatabaseOperationResult>;
};

type CommandRunner = (args: readonly string[]) => Promise<void>;
```

Use `execFile` via `node:util` `promisify`, never `exec` and never `{ shell: true }`. Locate the workspace root by walking upward from `process.cwd()` until `pnpm-workspace.yaml` exists, then run `pnpm` in that directory.

Use these immutable argument arrays:

```ts
const MIGRATE = ["--filter", "@sesb/database", "db:migrate"] as const;
const RESET = ["--filter", "@sesb/database", "exec", "prisma", "migrate", "reset", "--force", "--skip-seed"] as const;
const SEED = ["--filter", "@sesb/database", "db:seed"] as const;
```

Implement a synchronous lock check before the first `await`. Set the active operation, execute it, and clear the lock in `finally`. Throw:

```ts
new DomainError(409, "DATABASE_OPERATION_IN_PROGRESS", "Another database operation is already running")
```

For `freshSeed`, call `$disconnect`, reset, and seed in the protected body and call `$connect` in `finally` so reconnect is attempted after success or failure.

- [ ] **Step 4: Run the service tests and API type-check**

```bash
pnpm --filter @sesb/api test -- test/database-operations.test.ts
pnpm --filter @sesb/api typecheck
```

Expected: focused tests PASS and TypeScript reports no errors.

- [ ] **Step 5: Commit the isolated service**

```bash
git add apps/api/src/services/database-operations.ts apps/api/test/database-operations.test.ts
git commit -m "feat: add database operation service"
```

---

### Task 4: Expose the migrate and fresh-seed routes

**Files:**
- Create: `apps/api/src/routes/admin-database.ts`
- Create: `apps/api/test/admin-database.test.ts`
- Modify: `apps/api/src/app.ts`

**Interfaces:**
- Consumes: `DatabaseOperations` from Task 3 and Fastify's existing global error handler.
- Produces: `POST /admin/database/migrate` and `POST /admin/database/fresh-seed`.

- [ ] **Step 1: Write failing route tests with an injected service**

Create a fake Prisma object sufficient for app construction and inject fake operations into `buildApp`. Cover:

```ts
it("runs migration only", async () => {
  const response = await app.inject({ method: "POST", url: "/admin/database/migrate" });
  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({ operation: "migrate", status: "completed" });
  expect(operations.migrate).toHaveBeenCalledOnce();
  expect(operations.freshSeed).not.toHaveBeenCalled();
});

it("runs fresh and seed", async () => {
  const response = await app.inject({ method: "POST", url: "/admin/database/fresh-seed" });
  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({ operation: "fresh-seed", status: "completed" });
});

it("keeps command failures private", async () => {
  operations.migrate.mockRejectedValueOnce(new Error("secret command output"));
  const response = await app.inject({ method: "POST", url: "/admin/database/migrate" });
  expect(response.statusCode).toBe(500);
  expect(response.body).not.toContain("secret command output");
});
```

Also inject a `DomainError(409, "DATABASE_OPERATION_IN_PROGRESS", ...)` and assert the existing error envelope and status code.

- [ ] **Step 2: Run the focused route test and confirm it fails**

```bash
pnpm --filter @sesb/api test -- test/admin-database.test.ts
```

Expected: FAIL because `buildApp` does not accept the service and the routes are not registered.

- [ ] **Step 3: Implement the route module and app wiring**

Create a thin registration function:

```ts
export function registerAdminDatabaseRoutes(app: FastifyInstance, operations: DatabaseOperations): void {
  app.post("/admin/database/migrate", async () => operations.migrate());
  app.post("/admin/database/fresh-seed", async () => operations.freshSeed());
}
```

Extend `buildApp` options with `databaseOperations?: DatabaseOperations`. Default to `createDatabaseOperations({ prisma })`, register both routes, and preserve the user's existing CORS method list in `app.ts`.

- [ ] **Step 4: Run API tests, type-check, and build**

```bash
pnpm --filter @sesb/api test
pnpm --filter @sesb/api typecheck
pnpm --filter @sesb/api build
```

Expected: all API commands PASS.

- [ ] **Step 5: Commit only the route wiring hunks**

Because `app.ts` already contains user changes, inspect and stage only the admin-route additions:

```bash
git diff -- apps/api/src/app.ts apps/api/src/routes/admin-database.ts apps/api/test/admin-database.test.ts
git add -p apps/api/src/app.ts
git add apps/api/src/routes/admin-database.ts apps/api/test/admin-database.test.ts
git commit -m "feat: expose database maintenance api"
```

---

### Task 5: Document operations and run full verification

**Files:**
- Modify: `README.md`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: the two HTTP routes from Task 4.
- Produces: deployer-facing invocation and safety documentation; ignores local visual-companion state.

- [ ] **Step 1: Add exact README examples**

Add a `Database operations API` section after the Docker startup details:

````markdown
### Database operations API

Apply pending migrations without deleting data:

```bash
curl -X POST http://localhost:3000/admin/database/migrate
```

> **Warning:** The next operation permanently deletes every house, meter reading, billing cycle, budget, and audit action before rebuilding and seeding the database.

```bash
curl -X POST http://localhost:3000/admin/database/fresh-seed
```

These endpoints have no application-level authentication. Keep the API restricted at the deployment proxy or network layer.
````

Merge this section with the existing uncommitted billing-cycle documentation rather than replacing it.

- [ ] **Step 2: Ignore the local brainstorming artifacts**

Append this exact entry to `.gitignore`:

```gitignore
.superpowers/
```

- [ ] **Step 3: Run formatting checks through build and the full repository verification**

```bash
git diff --check
pnpm verify
```

Expected: no whitespace errors; all tests, type-checks, and builds PASS.

- [ ] **Step 4: Run focused browser verification at both desktop and mobile widths**

Start the existing Docker stack and run:

```bash
docker compose up -d --build
pnpm --filter @sesb/web e2e -- e2e/manual-monitoring.spec.ts
```

Manually inspect the house workspace at 1280×800 and 320×700. Confirm the top bar is absent, all four navigation items fit, focus states are visible, the bar does not cover the last control, and `#readings` scrolls to the reading section.

- [ ] **Step 5: Smoke-test the non-destructive endpoint only**

```bash
curl --fail-with-body -X POST http://localhost:3000/admin/database/migrate
curl --fail-with-body http://localhost:3000/health
```

Expected responses include `{"operation":"migrate","status":"completed"}` and `{"status":"ok","database":"ok"}`. Do not call `fresh-seed` against any database containing user data during smoke verification; its destructive behavior is covered with the injected service tests.

- [ ] **Step 6: Review and commit documentation only**

```bash
git diff --check
git status --short
git add -p README.md
git add .gitignore
git commit -m "docs: describe database operation endpoints"
```

Confirm the final status still contains every pre-existing user change that was intentionally left uncommitted and contains no `.superpowers/` files.
