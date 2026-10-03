# Mobile Cycle Workspace Design

## Status

Approved for implementation planning on 3 October 2026.

## Objective

Extend the core electricity-monitoring slice with a mobile-friendly billing-cycle workspace. The owner can start and undo cycles, optionally establish an audited custom starting meter value, set a kWh or RM budget, review estimated daily usage and its average, and compare the selected cycle with the preceding cycle.

This specification promotes cycle comparison charts from the original requirements' future-enhancement list into the next implementation slice at the owner's explicit request.

## Scope

### Included

- A prominent start-cycle action on each house page.
- Server-generated cycle previews before confirmation.
- Standard carry-forward cycle transitions.
- Audited custom-start boundary readings without modifying the preceding cycle.
- Ten-minute undo when no later reading exists.
- Closed-cycle history and cycle selection.
- Per-house default kWh or RM budgets, snapshotted by cycle.
- Remaining-budget and over-budget energy indicators.
- Estimated daily usage charts with a cycle-average reference line.
- Selected-cycle versus preceding-cycle comparisons.
- A reorganised, touch-friendly house page for narrow phone screens.

### Excluded

- Editing or deleting closed-cycle readings or totals.
- Moving readings between cycles.
- Exact daily consumption claims when daily readings do not exist.
- Cross-house comparisons.
- Forecasting the end-of-cycle bill.
- Notifications when a budget threshold is crossed.
- OCR and photograph workflows.

## Mobile Cycle Workspace

The house detail screen becomes a cycle workspace ordered by immediate owner value:

1. A compact header with the house name, meter label, dashboard navigation, and an overflow action for house editing.
2. A current or selected-cycle summary containing consumption, estimated RM charge, cycle age/date range, and budget status.
3. A full-width **Start new bill cycle** button when the active cycle is selected and eligible.
4. A horizontally scrollable cycle selector with **Current cycle** followed by recent closed cycles.
5. An **Estimated daily usage** chart with an average line and accessible text summary.
6. A previous-cycle comparison card.
7. Collapsible reading-entry and reading-history sections on narrow screens.

The primary summary and cycle action appear before charts so they do not require deep scrolling. Touch targets are at least 44 pixels high. The layout has no horizontal page scrolling at common phone widths; only the cycle-selector chips may scroll horizontally within their own container.

The start-cycle interaction opens as a bottom sheet on narrow screens and a centred modal on wider screens. It traps focus, closes with Escape or an explicit cancel action, and restores focus to the trigger. The sheet keeps all input after validation failures.

## Starting a New Cycle

### Eligibility

A new cycle may start only when:

- The house has an active cycle.
- The active cycle has at least one confirmed reading.
- No other cycle transition is in progress.

The API, not the browser, is authoritative for eligibility.

### Preview

Opening the start-cycle sheet initially requests a server preview. The preview shows:

- Current cycle opening time.
- Latest confirmed reading and capture time.
- Consumption and final estimated charge if closed now.
- New cycle opening time.
- The tariff that the new cycle will snapshot.
- The house's default budget that the new cycle will snapshot.

The proposed start time defaults to the current `Asia/Kuching` time and may be backdated no earlier than the latest confirmed reading and no later than server time.

### Carry-forward start

Carry-forward is the default. The active cycle closes using its chronologically latest confirmed reading. That reading becomes both the closed cycle's ending reference and the new cycle's starting reference. The new cycle opens at the selected start time, which cannot precede the shared boundary reading's capture time. No consumption gap is introduced.

### Custom starting kWh

The owner may explicitly select **Custom starting kWh** and enter a value. This is an audited exception to the original no-gap boundary rule:

- The previous cycle closes at its unchanged latest confirmed reading.
- The application never edits or replaces that historical reading.
- The custom value must be greater than or equal to the previous latest value.
- The selected cycle-start time cannot precede the previous latest reading and cannot be in the future.
- A new confirmed reading is created in the new cycle at the selected start time with source `cycle_start_override`.
- The new cycle uses the override reading as its starting reference and begins with zero consumption and RM0.00 estimated charge.
- The difference between the previous ending reading and custom starting reading is excluded from both cycles.
- Before confirmation, the UI states the excluded amount plainly, for example: **5 kWh will not belong to either billing cycle**.
- The owner must check an acknowledgement when the difference is non-zero. An explanatory reason is optional and limited to 500 characters.

If the custom value equals the preceding reading, the system uses the standard carry-forward transition rather than creating a duplicate-timestamp reading.

### Transaction and audit

Closing the old cycle, snapshotting its final totals, creating the new cycle, creating an override boundary when applicable, and writing the action log occur in one serializable transaction with bounded conflict retry.

The start action records the old/new cycle identifiers, old ending reading, new starting reading, selected start time, transition mode, excluded kWh, optional reason, and server action time.

## Undo

After a successful start, the workspace shows an Undo action and countdown for ten minutes from the server-generated action timestamp.

Undo is allowed only when:

- No more than ten minutes have elapsed. Exactly ten minutes remains eligible; any later time is ineligible.
- No confirmed reading has been added to the new cycle after its starting boundary.
- The referenced preceding cycle remains closed and the new cycle remains active.

A successful undo runs in one transaction. It reopens the preceding cycle, restores its closing fields to the active state, deletes the empty new cycle, and deletes a `cycle_start_override` reading created solely for that transition. A shared carry-forward reading is never deleted. The original start action remains in the log and a separate undo action is appended.

When undo is unavailable, the API returns a stable reason code and the interface explains whether the window expired, another reading exists, or cycle state changed.

## Budget Model

### House default

Each house may define one default budget:

- Type: `KWH` or `RM`.
- Positive decimal value.

No budget is valid and produces a setup prompt rather than a zero-budget warning.

Saving a budget from the active cycle updates both the house default and the active cycle snapshot. Closed-cycle snapshots never change. Every new cycle copies the current house default into its own snapshot.

### Progress

For a kWh budget, usage is active-cycle consumption. For an RM budget, usage is the active-cycle estimated charge before display rounding. Progress is `usage / budget × 100` using decimal arithmetic.

The energy indicator communicates both visually and textually:

- More than 40% remaining: green.
- From 1% through 40% remaining: amber.
- Zero remaining or over budget: red.
- Remaining progress is visually clamped from 0% to 100%, while accompanying text reports the exact state.

Examples include **RM42.10 remaining · 38%** and **12.5 kWh over budget · 108% used**. The icon is decorative; an accessible text label carries the meaning.

Historical cycle views use that cycle's budget snapshot. They do not use the house's current default.

## Estimated Daily Usage

The chart is explicitly labelled **Estimated daily usage** because cumulative readings do not reveal the exact day on which energy was consumed.

### Allocation algorithm

For every consecutive reading pair in the selected cycle:

1. Convert capture timestamps to `Asia/Kuching` calendar dates.
2. Calculate the non-negative kWh difference.
3. If both readings fall on the same local date, assign the difference to that date.
4. Otherwise count the local dates after the first reading through and including the second reading.
5. Divide the difference evenly across those dates using decimal arithmetic.
6. Sum allocations when more than one interval contributes to the same date.

The backend returns decimal-string chart points and a display-rounded value. It also returns the source interval for each allocation so a tooltip can explain which readings produced an estimate.

The average reference line is total allocated consumption divided by the number of represented calendar days. A cycle with fewer than two distinct readings returns an empty chart with guidance to add another reading. Missing reading intervals are not silently forecast through the current date.

### Presentation

The chart uses a responsive container, short date labels, touch-friendly tooltips, and a visible average line. It includes a non-graphical summary stating total represented usage, represented days, and average kWh per day. This summary is available to screen readers and remains visible when chart rendering is unavailable.

## Previous-Cycle Comparison

The selected cycle is compared with the immediately preceding closed cycle for the same house and meter. Comparison fields are:

- Total consumption.
- Estimated energy charge.
- Represented daily average.
- Cycle length in local calendar days.
- Budget result when both cycles have comparable budget types.

The API returns absolute values and percentage change. If the preceding value is zero, percentage change is `null` and the interface uses **No comparable baseline** rather than infinity. If no preceding cycle exists, the card explains that comparison becomes available after a cycle closes.

Current incomplete-cycle values are labelled **So far**. The interface does not imply that cycles of different lengths are directly equivalent; it presents daily average alongside totals.

## Data Model Changes

### House

Add nullable `defaultBudgetType` and `defaultBudgetValue` fields. The value uses a precise PostgreSQL numeric type.

### BillingCycle

Add nullable `budgetType` and `budgetValue` snapshot fields. Existing cycles receive null snapshots and display **No budget recorded**.

### MeterReading

Add a `source` enum with `MANUAL`, `OCR`, and `CYCLE_START_OVERRIDE`. Existing records migrate to `MANUAL`. Add an optional `overrideReason` limited by API validation to 500 characters.

### CycleAction

Add a JSON metadata field for the immutable transition details. Action type continues to distinguish `START` and `UNDO`.

Database constraints enforce positive budget values when present and require budget type/value to be either both null or both populated.

## HTTP Interfaces

- `POST /houses/:houseId/cycles/preview` validates `{ startTimestamp, mode, customStartKwh? }` and returns final current-cycle totals, proposed boundary details, excluded kWh, tariff, budget, and eligibility.
- `POST /houses/:houseId/cycles` accepts the preview inputs plus `{ acknowledgedGap, reason? }`, revalidates against current server state, and commits the transition.
- `POST /houses/:houseId/cycles/:cycleId/undo` undoes the specific newly active cycle when eligible.
- `GET /houses/:houseId/cycles` returns the active cycle followed by closed cycles in reverse closing order.
- `GET /houses/:houseId/cycles/:cycleId/insights` returns estimated daily points, average, budget progress, comparison values, and undo state where relevant.
- `PUT /houses/:houseId/budget` accepts `{ type: "KWH" | "RM", value }` or `{ type: null, value: null }` to remove the current/default budget.

Shared Zod contracts define all inputs and outputs. Decimal values cross JSON as strings and date-times as ISO 8601 values.

## Component Boundaries

The existing house-detail page becomes composition-only and delegates to:

- `CycleSummary`: consumption, charge, age/date range, and budget indicator.
- `CycleSelector`: current and closed-cycle selection.
- `BudgetIndicator` and `BudgetEditor`: display and mutation of current/default budgets.
- `DailyUsageChart`: Recharts presentation and accessible summary.
- `CycleComparison`: current/selected versus preceding values.
- `StartCycleSheet`: preview, carry-forward/custom choice, gap acknowledgement, and confirmation.
- `UndoCycleNotice`: server-based countdown and undo failure messages.
- `ReadingWorkspace`: collapsible entry and history content.

The web application consumes insight calculations from the API and never recreates billing, interpolation, or comparison rules in the browser.

## Error Handling

- Preview and commit both validate against current database state; a stale preview returns a conflict and prompts refresh.
- Invalid custom values, times, and gap acknowledgements map to their exact fields.
- Failed cycle transitions leave the previous cycle active and create no action or boundary reading.
- Failed undo leaves both cycles and all readings unchanged.
- Budget mutations reject non-positive, non-numeric, or incomplete type/value pairs without changing the prior budget.
- Chart and comparison failures do not hide reading entry; the insights region shows retryable feedback independently.

## Verification Strategy

### Unit tests

- Daily allocation for same-day, adjacent-day, multi-day, month-boundary, fractional-kWh, and `Asia/Kuching` date cases.
- Average calculation and empty-chart rules.
- Budget remaining, threshold colours, over-budget output, and decimal precision.
- Percentage comparisons with positive, negative, and zero preceding values.

### Database and API integration tests

- Standard carry-forward closes and opens at the same reading.
- Custom start preserves the previous ending reading and records the excluded difference.
- Equal custom values use carry-forward without a duplicate reading.
- Invalid custom value/time and missing acknowledgement roll back fully.
- Start action metadata is complete.
- Undo succeeds before and exactly at ten minutes, fails after ten minutes, and fails after another reading.
- Undo deletes only a transition-created override reading.
- Budget updates affect the house and active cycle but never closed cycles.
- New cycles copy the house default budget.
- Concurrent transition conflicts are retried or returned safely.

### Web tests

- Summary hierarchy and full-width mobile start action.
- Bottom-sheet focus, dismissal, retained input, preview, gap warning, and confirmation.
- Energy indicator colour-independent accessible copy for every threshold.
- Cycle selector and closed-cycle read-only behavior.
- Chart empty state, tooltip content, average line, and text summary.
- Comparison zero-baseline and no-previous-cycle states.
- Undo countdown and server rejection messages.

### End-to-end tests

At phone and desktop viewports:

1. Set an RM budget and observe progress.
2. Start a carry-forward cycle and undo it.
3. Start a custom-boundary cycle with an acknowledged gap.
4. Add later and backdated readings.
5. Verify estimated daily chart order and average summary.
6. Select the preceding cycle and verify preserved totals and budget.
7. Compare current values with the previous cycle.

## Acceptance Criteria

This slice is complete when the owner can find and use the start-cycle action on a phone, safely choose carry-forward or an audited custom start, undo eligible transitions, set a kWh or RM budget with an understandable energy indicator, inspect estimated daily usage and average, and compare the selected cycle with its predecessor. Historical readings, totals, tariff snapshots, and closed-cycle budgets remain immutable throughout these flows.
