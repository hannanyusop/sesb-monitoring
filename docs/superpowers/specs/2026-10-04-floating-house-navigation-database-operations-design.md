# Floating House Navigation and Database Operations Design

## Goal

Remove the global top bar, add a compact floating navigation bar for house workspaces, and expose explicit HTTP operations for applying migrations or fully resetting and seeding the database.

## Scope

This change covers three connected improvements:

1. Remove the existing `Current` top bar from every page.
2. Add contextual floating navigation to existing house detail and edit screens.
3. Add two database administration endpoints: migration-only and destructive fresh-and-seed.

It does not add authentication, a general administration UI, a standalone seed endpoint, new database entities, or unrelated visual restructuring.

## User Experience

### Global shell

The application shell will no longer render the sticky header, brand mark, or brand copy. The main content area remains horizontally constrained and receives responsive top and bottom spacing directly.

The dashboard retains its existing `Add house` action. The new-house page remains a focused form and does not display house-specific navigation because no existing house is in context yet.

### Floating house navigation

House detail and house edit screens will render a fixed, bottom-centered navigation pill. It contains four destinations in this order:

1. **All Houses** — route `/`.
2. **Overview** — route `/houses/:houseId` and the overview section at the top of the workspace.
3. **Readings** — the readings section on `/houses/:houseId`.
4. **Edit** — route `/houses/:houseId/edit`.

The navigation is a reusable house-scoped component that receives the current house ID and determines its active destination from the current route and hash. Overview is active on the detail route without a readings hash, Readings is active when the readings anchor is targeted, and Edit is active on the edit route. All Houses is a navigation destination but is not active while the user is within a house.

On small screens, labels may use shorter visible text while accessible labels preserve the full destination names. The pill respects `env(safe-area-inset-bottom)`, remains within the viewport, and can horizontally fit at the project's 320-pixel minimum width. Pages that render it receive enough bottom padding that no content or controls are obscured.

The Overview and Readings links use stable section anchors. Navigating to Readings opens the existing readings disclosure when necessary and scrolls the section into view. Keyboard focus, visible focus treatment, and meaningful link labels are preserved.

## Database Administration API

### Routes

The API exposes two bodyless POST routes:

- `POST /admin/database/migrate`
- `POST /admin/database/fresh-seed`

No token, session, or application-level authorization is required. Deployment owners remain responsible for restricting the API at the proxy or network layer, as already required for the rest of this private application.

### Migration-only operation

The migrate route executes the existing database package migration command, equivalent to:

```bash
pnpm --filter @sesb/database db:migrate
```

It applies pending versioned migrations and does not invoke the seed or delete application data.

### Fresh-and-seed operation

The fresh-and-seed route performs these steps in order:

1. Disconnect the application's Prisma client.
2. Force-reset the database schema from the committed migrations while skipping implicit seeding.
3. Run the existing explicit database seed.
4. Reconnect the application's Prisma client, including after an operation failure when reconnection remains possible.

Its commands are equivalent to:

```bash
pnpm --filter @sesb/database exec prisma migrate reset --force --skip-seed
pnpm --filter @sesb/database db:seed
```

This operation permanently deletes houses, meters, readings, billing cycles, budgets, and audit actions before restoring the schema and default tariff data.

### Execution boundary

A focused database-operation service owns command execution and operation state. It invokes a fixed executable with fixed argument arrays without a shell, and accepts no command or path input from the HTTP request. Route handlers do not embed shell command construction.

The production service uses the repository root as its working directory so the same commands work in local development and in the current API container. Tests inject a fake runner and never execute migration or reset commands.

A process-wide in-memory lock permits one database operation at a time. A second call made while either operation is running receives HTTP `409` with error code `DATABASE_OPERATION_IN_PROGRESS`.

### Responses and errors

A successful operation returns HTTP `200`:

```json
{
  "operation": "migrate",
  "status": "completed"
}
```

or:

```json
{
  "operation": "fresh-seed",
  "status": "completed"
}
```

Command failures flow through the existing safe internal-error response and do not expose command output, environment variables, database URLs, or stack traces to the caller. Full diagnostic details are written through the Fastify logger. Reconnection is attempted in a `finally` path after a fresh reset so the API does not intentionally remain disconnected.

## Components and Responsibilities

- `AppShell` owns only the page container after removal of the top bar.
- A reusable `HouseNavigation` component owns house-scoped navigation links and active-state semantics.
- House detail owns the Overview and Readings anchor targets and renders `HouseNavigation`.
- House edit renders the same `HouseNavigation` with Edit active.
- A database-operation service owns fixed command execution, serialization, Prisma disconnect/reconnect behavior, and safe result types.
- An admin database route module maps HTTP requests and service results to status codes and response bodies.
- `buildApp` accepts an injectable database-operation service for isolated API testing and registers the admin routes.

## Testing

Frontend component tests will verify:

- the application shell no longer renders the top bar;
- the house navigation exposes all four destinations with correct URLs;
- Overview, Readings, and Edit receive the correct active state;
- the readings destination targets the stable readings section; and
- the house pages render the floating navigation while dashboard and new-house pages do not.

Playwright coverage will confirm that a user can enter a house, move to Readings, open Edit, and return to All Houses without the floating bar obscuring the last interactive content.

API tests will verify:

- migration-only invokes only the migration command;
- fresh-and-seed disconnects, resets, explicitly seeds, and reconnects in order;
- concurrent operations return `409 DATABASE_OPERATION_IN_PROGRESS`;
- injected test runners prevent destructive real commands;
- command failure responses remain generic; and
- reconnection is attempted after fresh-and-seed failure.

The complete repository test, type-check, and build commands remain the final verification gate.

## Documentation

The README will document both POST routes with `curl` examples. The fresh-and-seed example will be immediately preceded by a prominent destructive-data warning. The documentation will also state that the endpoints are unauthenticated and must remain restricted by the deployment proxy or network.
