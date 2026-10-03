# Core Monitoring Slice Design

## Status

Approved for implementation planning on 3 October 2026.

## Objective

Deliver the first independently usable slice of the Personal Electric Usage Monitoring System: a Docker-based application that lets the owner create houses, record manual cumulative meter readings, and see current-cycle consumption and an estimated SESB tiered energy charge.

This slice establishes the production architecture and stable data model needed by later OCR, tariff-replacement, billing-cycle transition, undo, and closed-history slices. It does not expose incomplete interfaces for those later capabilities.

## Scope

### Included

- A pnpm TypeScript monorepo.
- Independently deployable React web, Fastify API, and PostgreSQL services.
- Docker Compose-compatible local and Dokploy-oriented service configuration.
- The complete stable V1 data model and its initial migration.
- An idempotent seed for the six supplied SESB tariff tiers.
- Transactional house creation with one active meter and one uninitialised billing cycle.
- House editing and deactivation without historical deletion.
- Manual cumulative meter-reading entry with adjustable capture time.
- Chronological and cumulative-value validation, including valid insertion between existing readings.
- Current-cycle consumption and cumulative tiered charge calculation in the backend.
- A mobile-first dashboard, house form, house detail, active-cycle summary, and reading history.
- Health checks and automated verification for the implemented flow.

### Deferred to later slices

- Photograph upload, image preprocessing, OCR, and OCR confirmation.
- Creating replacement tariff schedules.
- Starting, closing, and undoing billing cycles.
- Closed-cycle history views.
- Authentication, notifications, exports, charts, and all other SRS exclusions or future enhancements.

The schema includes fields and entities required by these later V1 slices where their shape is already stable. Deferred operations will not receive placeholder endpoints or non-functional controls.

## Architecture

The repository will be a pnpm workspace with these bounded units:

- `apps/web`: React, Vite, TypeScript, Tailwind CSS, and shadcn/ui. It owns responsive presentation, forms, navigation, and API interaction. It never performs authoritative billing calculations.
- `apps/api`: Fastify with TypeScript. It owns HTTP transport, validation orchestration, transactions, safe error responses, and server-side logging.
- `packages/database`: Prisma schema, migrations, PostgreSQL client lifecycle, and idempotent seed logic.
- `packages/billing`: framework-independent tariff validation and decimal billing calculations. It has no HTTP, browser, or database dependencies.
- `packages/contracts`: shared Zod request/response schemas and inferred TypeScript types used by both applications.

The web, API, and PostgreSQL database remain independently deployable services. Billing rules and final validation run in the API so all clients receive consistent results.

## Data Model

### House

Stores its identifier, required name, optional address and notes, active status, and created/updated timestamps. Deactivation hides a house from the default dashboard without deleting its history.

### Meter

Stores its identifier, house identifier, label, active status, and timestamps. The database enforces no more than one active meter per house. Keeping this entity separate supports a future meter-replacement workflow.

### Tariff and TariffTier

A tariff stores its name, effective start date, optional effective end date, and timestamps. Its ordered tiers store inclusive lower and upper consumption boundaries, with a nullable upper boundary for the final open-ended tier, and a precise rate in sen per kWh.

The seed is idempotent and creates this ordered schedule:

| Band | Rate |
|---|---:|
| 1–200 kWh | 22.02 sen/kWh |
| 201–300 kWh | 37.76 sen/kWh |
| 301–600 kWh | 49.26 sen/kWh |
| 601–1000 kWh | 51.49 sen/kWh |
| 1001–1500 kWh | 54.69 sen/kWh |
| 1501 kWh onward | 59.85 sen/kWh |

### BillingCycle

Stores its house and meter identifiers, active or closed status, optional starting and ending reading references, opening and closing timestamps, an immutable JSON tariff snapshot, precise consumption and calculated RM amount, and timestamps. A partial unique index enforces no more than one active cycle per house.

A newly created house receives an active but uninitialised cycle. Its starting-reading reference and tariff snapshot remain empty until the first confirmed reading.

### MeterReading

Stores its meter and cycle identifiers, confirmed kWh value, optional raw OCR value, manual-correction flag, OCR status, optional photograph metadata, capture timestamp, and server-created/updated timestamps. Fields unused by manual readings remain null or use an explicit `not_applicable` status.

Readings, tariff rates, consumption, and money use PostgreSQL `numeric` columns and decimal arithmetic. Persisted billing values never use binary floating-point.

### CycleAction

Stores its cycle identifier, action type, server-generated action timestamp, and optional related previous/new cycle identifiers. The table is created in this slice because it is part of the stable V1 model; records are added when the cycle-transition slice is implemented.

## Core Transactions and Rules

### Create a house

One database transaction creates the house, its active meter, and its active uninitialised billing cycle. Failure rolls back all three records.

### Confirm the first reading

The API locks or otherwise serialises the active cycle update, validates the reading, selects the tariff effective at the cycle opening time, saves an immutable snapshot of its ordered tiers, creates the reading, assigns it as the starting reading, and sets consumption and charge to zero in one transaction.

### Confirm a later reading

For a proposed `(captureTimestamp, value)` pair, the API finds the immediately preceding and following confirmed readings for the meter. It requires:

- A unique capture timestamp for that meter.
- `value >= preceding.value` when a preceding reading exists.
- `value <= following.value` when a following reading exists.

This permits a historically captured reading only when it preserves both chronological and cumulative-value order. On success, the reading is stored and the active cycle totals are recalculated using the chronologically latest reading in that cycle.

### Calculate the estimate

Consumption is the latest confirmed reading minus the cycle starting reading. A cycle with only its starting reading has zero consumption and zero charge. Each tariff tier applies only to consumption within its band; tier results are summed using exact decimal arithmetic. Internal precision is retained, while the API provides a standard half-up two-decimal display amount. The interface always labels the result as an estimate.

The tariff snapshot, not the mutable tariff tables, is authoritative for every calculation within an initialised cycle.

## HTTP Interfaces

The first slice exposes:

- `GET /health`: process and PostgreSQL connectivity status.
- `GET /houses`: active houses with latest reading and active-cycle summary.
- `POST /houses`: create a house, its meter, and its initial cycle.
- `GET /houses/:houseId`: house details, active-cycle summary, and recent readings.
- `PATCH /houses/:houseId`: update details or active status.
- `POST /houses/:houseId/readings`: validate and confirm a manual reading.
- `GET /houses/:houseId/readings`: paginated reverse-chronological reading history.
- `GET /tariffs/active`: active tariff and ordered tiers.

`packages/contracts` defines the Zod schemas and inferred types for every request, successful response, and error response. Identifiers are UUIDs. Date-time values cross the API as ISO 8601 strings with offsets or `Z`; the frontend displays them in `Asia/Kuching` by default.

Errors use a consistent envelope containing a safe human-readable message, a machine-readable code, and optional field errors. Validation errors use 400 or 422 as appropriate, missing resources use 404, conflicts use 409, and unexpected failures use 500 without exposing stack traces.

## User Interface

### Dashboard

The mobile-first dashboard lists active houses. Each card shows the house name, latest confirmed reading and capture time, active cycle opening date and age, current consumption, and clearly labelled estimated charge in RM. A house without readings prompts the owner to add its first reading.

### House form

The form captures a required house name, optional address and notes, and a required initial meter label. Editing supports the same house fields and deactivation.

### House detail

The detail page shows the current cycle summary, a manual reading form, and reverse-chronological reading history. Each history item shows the confirmed kWh value, capture timestamp, saved timestamp, and manual-entry status.

### Reading form behavior

The capture timestamp defaults to the current date and time in `Asia/Kuching` and remains adjustable. Submission is disabled while a save is in progress. Field values remain intact after validation or API errors. Successful creation refreshes the detail view and dashboard data immediately.

Controls are touch-friendly and no primary flow requires horizontal scrolling at typical phone widths.

## Error Handling and Operations

- Invalid readings never change cycle totals.
- Database mutations that span records are transactional.
- The API logs unexpected errors with request context while excluding secrets and returning a safe message.
- The web application presents an explicit unavailable state when it cannot reach the API.
- PostgreSQL credentials and deployment secrets come only from environment variables.
- API and PostgreSQL services have health checks.
- PostgreSQL data and the future photograph directory use named persistent volumes.
- Production HTTPS and access restriction are responsibilities of the Dokploy routing and infrastructure layer because V1 has no authentication.

## Verification Strategy

### Billing unit tests

Test cumulative allocation and exact display rounding at 0, 200, 201, 300, 301, 600, 601, 1000, 1001, 1500, and 1501 kWh, including the documented 250 kWh result of RM62.92.

### Domain validation unit tests

Test negative and non-numeric values, lower-than-preceding values, greater-than-following inserted values, duplicate timestamps, valid insertion between surrounding readings, and timezone-bearing capture timestamps.

### PostgreSQL integration tests

Test idempotent tariff seeding, referential and uniqueness constraints, transactional house creation, first-reading cycle initialisation, later-reading recalculation, valid historical insertion, rejected invalid insertion, and rollback on failure.

### Web tests

Use component tests for populated and empty dashboard cards, RM estimate labelling, first-reading prompts, pending submission state, retained form values, and field-specific validation messages.

### End-to-end and responsive verification

A browser smoke test creates a house, records its baseline reading, records a later reading, and observes updated consumption and estimate. Verify the dashboard, house form, house detail, and reading form at representative phone and desktop widths.

## Delivery Boundary

This slice is complete when it runs through Docker Compose, the database migrates and seeds repeatably, the owner can complete the manual house-to-estimate flow from a phone-sized viewport, all implemented API operations are covered by proportionate automated tests, and the documented SESB tariff-boundary tests pass.
