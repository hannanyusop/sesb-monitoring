# Electric Usage Monitoring System Requirements

## 1. Document Information

| Field | Value |
|---|---|
| Document type | Software Requirements Specification (SRS) |
| System | Personal Electric Usage Monitoring System |
| Version | 1.0 |
| Status | Approved for implementation planning |
| Date | 3 October 2026 |
| Primary user | System owner |

## 2. Purpose

The system will help one user monitor electricity usage and estimate the current SESB electricity charge across multiple houses. The user can record meter readings manually or upload a meter photograph for OCR-assisted extraction, track readings by date and time, manage billing cycles, and view estimated charges in Malaysian Ringgit (RM).

The system is an estimation and monitoring tool. Its calculated amount is not an official SESB bill.

## 3. Goals

The first release shall:

1. Let the user manage multiple houses.
2. Make meter entry fast and practical from a mobile phone.
3. Extract a possible kWh value from a meter photograph.
4. Require the user to verify or correct every OCR result before saving it.
5. Record the date and time of every confirmed meter reading.
6. Calculate consumption and estimated charges using seeded SESB tariff tiers.
7. Maintain a separate billing cycle for each house.
8. Let the user deliberately start a new billing cycle and undo an accidental cycle change when eligible.
9. Preserve historical readings, billing cycles, and calculated totals.
10. Run as a Docker-based application deployed through Dokploy with PostgreSQL as its database.

## 4. Scope

### 4.1 Included in Version 1

- Personal, single-user usage.
- No authentication or user account management.
- Multiple houses.
- One active electricity meter per house.
- Mobile-first responsive interface.
- Manual meter reading entry.
- Meter photograph capture or upload from a phone.
- Server-side image preprocessing and OCR-assisted number extraction.
- Mandatory confirmation or correction of OCR results.
- Per-house billing cycles.
- Tiered energy-charge calculation.
- Current-cycle usage and estimated bill dashboard.
- Historical readings and closed billing cycles.
- Tariff settings for reviewing and replacing the active tiered rate schedule.
- Time-limited undo for starting a new billing cycle.
- Docker and Dokploy deployment configuration.
- Persistent storage for PostgreSQL data and meter photographs.

### 4.2 Excluded from Version 1

- Multiple users, roles, or permissions.
- Login and authentication.
- Official SESB account integration or automatic bill retrieval.
- Online payments.
- Automated smart-meter integration.
- Notifications or reminders.
- Native Android or iOS applications.
- Multiple simultaneously active meters for one house.
- Taxes, rebates, minimum charges, service charges, discounts, late fees, or other bill adjustments.
- A guarantee that OCR will correctly read every meter photograph.

## 5. Proposed Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React with TypeScript |
| UI components | shadcn/ui |
| Backend | Node.js REST API with TypeScript |
| Database | PostgreSQL |
| Image preprocessing | `sharp` |
| OCR | `tesseract.js` |
| Packaging | Docker containers and Docker Compose-compatible configuration |
| Deployment | Dokploy |
| Photograph storage | Dokploy persistent volume |

The frontend, API, and PostgreSQL database shall be independently deployable services. Billing calculations and final validation shall run in the backend so all devices receive consistent results.

## 6. Users and Access

### 6.1 User Type

Version 1 has one system owner who can access all houses, readings, tariffs, and billing cycles.

### 6.2 Access Assumption

Because authentication is excluded, anyone who can reach the deployed application may access its data. The deployment shall therefore be treated as private and protected at the infrastructure or network level until application authentication is added.

## 7. Functional Requirements

### 7.1 Dashboard

- **FR-DASH-001:** The system shall show all active houses on a mobile-friendly dashboard.
- **FR-DASH-002:** Each house summary shall show its latest confirmed meter reading and reading timestamp.
- **FR-DASH-003:** Each house summary shall show current-cycle consumption in kWh.
- **FR-DASH-004:** Each house summary shall show the estimated current charge in RM.
- **FR-DASH-005:** Each house summary shall show the active cycle start date and its current age.
- **FR-DASH-006:** The user shall be able to open a house to view its active cycle, reading history, and closed-cycle history.

### 7.2 House Management

- **FR-HOUSE-001:** The user shall be able to create a house with a required name.
- **FR-HOUSE-002:** A house may have an address and notes.
- **FR-HOUSE-003:** The user shall be able to edit house details.
- **FR-HOUSE-004:** The user shall be able to mark a house inactive without deleting its historical records.
- **FR-HOUSE-005:** Every house shall have its own meter readings and billing cycles.

### 7.3 Meter Management

- **FR-METER-001:** Each house shall have one active meter in Version 1.
- **FR-METER-002:** A meter shall have a label or identifier.
- **FR-METER-003:** Meter data shall be stored separately from house data to allow meter replacement in a future version.

### 7.4 Meter Reading Entry

- **FR-READ-001:** The user shall be able to enter a kWh meter reading manually.
- **FR-READ-002:** The user shall be able to take a photograph with a phone camera or select an existing image.
- **FR-READ-003:** The backend shall preprocess an uploaded image before OCR by applying suitable operations such as cropping, resizing, grayscale conversion, and contrast enhancement.
- **FR-READ-004:** OCR shall be configured to prioritize digits and a decimal separator.
- **FR-READ-005:** The system shall display the original photograph and the proposed OCR value for review.
- **FR-READ-006:** The system shall never save an OCR result as a confirmed meter reading without explicit user confirmation.
- **FR-READ-007:** The user shall be able to correct the OCR value before confirming it.
- **FR-READ-008:** If OCR cannot produce a usable value, the system shall keep the image visible and allow manual entry.
- **FR-READ-009:** A confirmed reading shall record both a capture timestamp and a server-created timestamp.
- **FR-READ-010:** The capture timestamp shall default to the current date and time.
- **FR-READ-011:** The user shall be able to adjust the capture timestamp when recording an older reading.
- **FR-READ-012:** The system shall retain the raw OCR value and record whether the user corrected it.
- **FR-READ-013:** The system shall link the stored photograph to its meter-reading record.
- **FR-READ-014:** The system shall show the confirmed reading in the house's reading history immediately after a successful save.

### 7.5 Reading Validation

- **FR-VAL-001:** A reading shall be numeric, non-negative, and expressed in kWh.
- **FR-VAL-002:** A new reading shall not be lower than the preceding confirmed reading for the same meter.
- **FR-VAL-003:** Reading timestamps shall maintain chronological order for a meter. An older reading may only be inserted when it does not invalidate the order or value of surrounding readings.
- **FR-VAL-004:** A failed upload, preprocessing operation, or OCR request shall not create a confirmed meter reading.
- **FR-VAL-005:** The reading form shall prevent repeated submission while a save request is in progress.
- **FR-VAL-006:** Validation errors shall explain what must be corrected without discarding the selected photograph or entered value where technically possible.

### 7.6 SESB Tariff

- **FR-TAR-001:** Version 1 shall use a tiered tariff rather than a single flat rate.
- **FR-TAR-002:** The initial database seed shall create the following tariff tiers:

| Consumption band | Rate |
|---|---:|
| 1–200 kWh | 22.02 sen/kWh (RM0.2202/kWh) |
| 201–300 kWh | 37.76 sen/kWh (RM0.3776/kWh) |
| 301–600 kWh | 49.26 sen/kWh (RM0.4926/kWh) |
| 601–1000 kWh | 51.49 sen/kWh (RM0.5149/kWh) |
| 1001–1500 kWh | 54.69 sen/kWh (RM0.5469/kWh) |
| 1501 kWh onwards | 59.85 sen/kWh (RM0.5985/kWh) |

- **FR-TAR-003:** Tariff tiers shall be applied cumulatively to consumption within a billing cycle.
- **FR-TAR-004:** Tariffs shall support effective dates so future rates can be added without changing historical calculations.
- **FR-TAR-005:** A billing cycle shall preserve a snapshot of the tariff and tiers used for its calculation.
- **FR-TAR-006:** Version 1 shall calculate the tiered energy charge only.
- **FR-TAR-007:** The user shall be able to view the active tariff and all of its tiers from a tariff-settings screen.
- **FR-TAR-008:** The user shall be able to create a replacement tariff schedule by entering its name, effective start date, consumption boundaries, and rate for each tier.
- **FR-TAR-009:** The backend shall reject tariff schedules with gaps, overlaps, invalid boundaries, negative rates, or tiers in an invalid order.
- **FR-TAR-010:** Activating a replacement tariff shall not modify the tariff snapshot or result of an existing cycle.
- **FR-TAR-011:** A tariff shall not be deleted when it is referenced by a billing cycle; it may be made inactive for future use.

### 7.7 Billing Calculation

- **FR-CALC-001:** Current-cycle consumption shall equal the latest confirmed reading minus the cycle's starting reading.
- **FR-CALC-002:** If a cycle has only its starting reading, consumption and the estimated charge shall be zero.
- **FR-CALC-003:** The backend shall calculate each tier independently and sum the results.
- **FR-CALC-004:** Calculation shall retain precision beyond two decimal places internally.
- **FR-CALC-005:** RM amounts shall be rounded to two decimal places for display using standard monetary rounding.
- **FR-CALC-006:** The current bill shall be labelled as an estimate.
- **FR-CALC-007:** The estimate shall update after each confirmed reading.

Example for 250 kWh:

```text
First 200 kWh × RM0.2202 = RM44.0400
Next 50 kWh × RM0.3776  = RM18.8800
Estimated total          = RM62.92
```

### 7.8 Billing Cycles

- **FR-CYCLE-001:** Each house shall have no more than one active billing cycle.
- **FR-CYCLE-002:** The first confirmed reading in a house's first cycle shall become its starting reading.
- **FR-CYCLE-003:** Starting a new cycle shall be an explicit user action.
- **FR-CYCLE-004:** The system shall show a confirmation prompt before starting a new cycle.
- **FR-CYCLE-005:** Starting a new cycle shall close the active cycle using its latest confirmed meter reading.
- **FR-CYCLE-006:** The closed cycle's ending reading shall become the new cycle's starting reading, preventing gaps between cycles.
- **FR-CYCLE-007:** The closed cycle shall retain its consumption, tariff snapshot, calculated total, opening timestamp, and closing timestamp.
- **FR-CYCLE-008:** The user shall be able to view closed billing cycles for each house.
- **FR-CYCLE-009:** A new cycle cannot be started until the active cycle has at least one confirmed meter reading.

### 7.9 Undo New Cycle

- **FR-UNDO-001:** After a new cycle is started, the system shall offer an Undo action for 10 minutes.
- **FR-UNDO-002:** Undo shall only be permitted when no additional reading has been added to the new cycle.
- **FR-UNDO-003:** A successful undo shall delete the empty new-cycle boundary and restore the preceding cycle as active.
- **FR-UNDO-004:** The restored cycle shall retain its original readings and become open again.
- **FR-UNDO-005:** If the time limit has expired or a new reading exists, the system shall explain why undo is unavailable.
- **FR-UNDO-006:** Start-cycle and undo operations shall be recorded in an action log with server-generated timestamps.

### 7.10 History

- **FR-HIST-001:** The system shall list readings for a house in reverse chronological order by capture timestamp.
- **FR-HIST-002:** A reading history item shall show the confirmed kWh value, capture timestamp, saved timestamp, OCR/correction status, and photograph when available.
- **FR-HIST-003:** The system shall list closed cycles with their date range, start and end readings, consumption, and final estimated charge.

## 8. Data Requirements

The logical data model shall include at least the following entities.

### 8.1 House

- Identifier
- Name
- Optional address
- Optional notes
- Active status
- Created and updated timestamps

### 8.2 Meter

- Identifier
- House identifier
- Label or meter number
- Active status
- Created and updated timestamps

### 8.3 Meter Reading

- Identifier
- Meter identifier
- Billing-cycle identifier
- Confirmed kWh value
- Raw OCR value, when available
- Manual-correction indicator
- OCR status
- Photograph path and metadata, when available
- Capture timestamp
- Server-created and updated timestamps

### 8.4 Tariff

- Identifier
- Name
- Effective start date
- Optional effective end date
- Created and updated timestamps

### 8.5 Tariff Tier

- Identifier
- Tariff identifier
- Lower and upper consumption boundaries
- Rate in sen per kWh or an equivalently precise decimal representation
- Tier order

### 8.6 Billing Cycle

- Identifier
- House and meter identifiers
- Status: active or closed
- Starting and ending reading references
- Opening and closing timestamps
- Tariff snapshot
- Consumption in kWh
- Calculated amount in RM
- Created and updated timestamps

### 8.7 Cycle Action

- Identifier
- Billing-cycle identifier
- Action type
- Action timestamp
- Related previous/new cycle identifiers where applicable

## 9. Primary User Flows

### 9.1 Add a House

1. The user opens house management.
2. The user enters a house name and optional details.
3. The system creates the house and its active meter.
4. The house appears on the dashboard and prompts for its first reading.

Creating a house shall also create its initial active billing cycle. That cycle remains uninitialised until the first confirmed reading establishes its starting reading.

### 9.2 Add a Reading from a Photograph

1. The user opens a house and selects **Add Meter Reading**.
2. The user takes a photograph or selects an image.
3. The frontend uploads the image to the backend.
4. The backend preprocesses the image and runs OCR.
5. The system displays the photograph, proposed kWh value, and capture timestamp.
6. The user corrects the value or timestamp if necessary.
7. The user confirms the reading.
8. The backend validates and saves the reading.
9. The system refreshes current consumption and the estimated RM charge.

### 9.3 Add a Manual Reading

1. The user selects **Add Meter Reading**.
2. The user enters the kWh value and confirms the capture timestamp.
3. The backend validates and saves the reading.
4. The dashboard and cycle estimate update.

### 9.4 Start a New Billing Cycle

1. The user selects **Start New Cycle** for a house.
2. The system previews the current cycle's end reading, consumption, and estimated total.
3. The user confirms the action.
4. The backend closes the current cycle and creates a new active cycle using the same boundary reading.
5. The UI shows the new active cycle and a 10-minute Undo action.

### 9.5 Undo a New Billing Cycle

1. The user selects **Undo** within 10 minutes.
2. The backend checks that the new cycle has no additional readings.
3. The system removes the new cycle boundary and restores the preceding cycle as active.
4. The dashboard returns to the restored cycle totals.

### 9.6 Replace the Active Tariff

1. The user opens tariff settings and reviews the current tier schedule.
2. The user creates a replacement schedule with an effective start date and ordered tiers.
3. The backend validates that the tiers are complete, non-overlapping, and use valid rates.
4. The new tariff becomes available for cycles that begin on or after its effective date.
5. Existing active and closed cycles keep their original tariff snapshots and calculated results.

## 10. API and Component Boundaries

### 10.1 React Frontend

Responsibilities:

- Responsive dashboard and house views.
- House and meter-reading forms.
- Mobile camera/file input.
- OCR result review and correction.
- Tariff review and replacement form.
- Billing-cycle confirmation and undo interface.
- Display of server-provided calculations and validation errors.

### 10.2 Node.js API

Responsibilities:

- House, meter, reading, tariff, and cycle operations.
- Input validation and chronological consistency.
- Image upload, preprocessing, and OCR execution.
- Tiered billing calculations.
- Transactional cycle transitions and undo operations.
- Photograph metadata management.

### 10.3 PostgreSQL

Responsibilities:

- Persistent relational data.
- Referential integrity.
- Decimal-precision storage for readings and currency calculations.
- Transactions for starting and undoing billing cycles.
- Database migrations and SESB tariff seeding.

### 10.4 Photograph Storage

Responsibilities:

- Store original uploaded meter photographs on a persistent volume.
- Use generated, non-user-controlled filenames.
- Keep file paths linked to database records.
- Prevent uploaded files from being treated as executable content.

## 11. Error Handling

- OCR failure shall fall back to manual entry rather than blocking the user.
- An invalid reading shall not alter consumption or billing totals.
- Failed uploads and OCR operations shall provide a retry action.
- A partial cycle transition shall not be possible; closing one cycle and opening the next shall be one database transaction.
- Undo shall also run as one database transaction.
- The frontend shall clearly report when the API is unavailable.
- Unexpected backend errors shall return a safe error message and be logged without exposing secrets or internal stack traces to the browser.

## 12. Non-Functional Requirements

### 12.1 Usability

- **NFR-USE-001:** Primary actions shall be usable on a typical phone screen without horizontal scrolling.
- **NFR-USE-002:** Controls used during meter entry shall be touch-friendly.
- **NFR-USE-003:** The camera or file picker shall be accessible directly from the reading flow.
- **NFR-USE-004:** Estimated amounts shall always be clearly labelled and formatted in RM.
- **NFR-USE-005:** Destructive or state-changing actions shall require confirmation or provide an eligible undo path.

### 12.2 Performance

- **NFR-PERF-001:** Non-OCR API operations should normally complete within one second under personal-use load, excluding network latency.
- **NFR-PERF-002:** OCR may run asynchronously from the upload request, but the UI shall show visible processing progress.
- **NFR-PERF-003:** The user shall remain able to enter a value manually if OCR is slow or fails.

### 12.3 Data Integrity

- **NFR-DATA-001:** PostgreSQL decimal/numeric types shall be used for meter readings, rates, and money; binary floating-point shall not be used for persisted billing values.
- **NFR-DATA-002:** Server-generated timestamps shall be stored with timezone information and displayed in the configured local timezone.
- **NFR-DATA-003:** The default display timezone shall be `Asia/Kuching`.
- **NFR-DATA-004:** Referential constraints shall prevent orphaned readings, tiers, and cycle records.

### 12.4 Security

- **NFR-SEC-001:** Only supported image MIME types and bounded file sizes shall be accepted.
- **NFR-SEC-002:** Uploaded filenames shall not be trusted for storage paths.
- **NFR-SEC-003:** Database credentials and deployment secrets shall be provided through environment variables and shall not be committed to source control.
- **NFR-SEC-004:** Production traffic shall use HTTPS through the Dokploy routing layer.
- **NFR-SEC-005:** Because Version 1 has no login, infrastructure-level access restriction is strongly recommended.

### 12.5 Operations

- **NFR-OPS-001:** The deployment shall include health checks for the API and PostgreSQL connectivity.
- **NFR-OPS-002:** PostgreSQL data and uploaded photographs shall use persistent storage.
- **NFR-OPS-003:** The operational backup process shall cover both PostgreSQL and the photograph volume.
- **NFR-OPS-004:** Database schema changes shall be applied through versioned migrations.
- **NFR-OPS-005:** Initial deployment shall run an idempotent tariff seed.

## 13. Testing Requirements

### 13.1 Unit Tests

Unit tests shall cover:

- Every SESB tariff boundary, including 0, 200, 201, 300, 301, 600, 601, 1000, 1001, 1500, and 1501 kWh.
- Consumption and tier allocation.
- Monetary precision and display rounding.
- Lower-than-previous reading rejection.
- Reading timestamp and surrounding-reading validation.
- Cycle closing and new-cycle creation.
- Undo eligibility at, before, and after the 10-minute limit.
- Undo rejection after an additional reading.

### 13.2 Integration Tests

Integration tests shall cover:

- PostgreSQL persistence and constraints.
- Idempotent tariff seeding.
- Reading creation with and without a photograph.
- Failed OCR fallback to manual entry.
- Transactional cycle start and undo.
- Recalculation after a confirmed reading.

### 13.3 OCR Test Samples

A small test set of representative meter photographs should include:

- Clear straight-on display.
- Low light.
- Glare or reflection.
- Slightly angled display.
- Digital/seven-segment display where applicable.

OCR tests measure whether a useful candidate is returned. They do not remove the mandatory user-confirmation requirement.

### 13.4 Responsive Verification

The dashboard, photo-entry flow, confirmation form, history, new-cycle confirmation, and undo notification shall be checked at common phone widths and on a desktop viewport.

## 14. Acceptance Criteria

Version 1 is acceptable when:

1. The user can create and view multiple houses.
2. Each house independently shows its latest reading, current-cycle consumption, and estimated RM charge.
3. The user can save a manual reading with a capture timestamp.
4. The user can upload or take a meter photograph, review the OCR candidate, correct it, and explicitly confirm it.
5. Failed OCR does not prevent manual reading entry.
6. A reading lower than the preceding reading is rejected with a clear message.
7. The six specified SESB tiers are seeded and applied cumulatively.
8. The user can create a valid replacement tiered tariff without altering existing cycle calculations.
9. Calculation tests pass at every tariff boundary.
10. The user can start a new cycle only after confirmation.
11. The previous cycle closes and the next cycle starts at the same meter reading.
12. The user can undo a new cycle within 10 minutes when no additional reading exists.
13. Every confirmed meter entry records capture and server-created timestamps.
14. Historical readings and closed cycles remain viewable.
15. The complete system runs through Docker and can be deployed in Dokploy with persistent PostgreSQL and photograph storage.
16. The primary workflow is usable from a phone.

## 15. Assumptions and Constraints

- Meter readings are cumulative and do not normally reset.
- The user is responsible for confirming that an OCR candidate matches the physical meter.
- A meter rollover or physical meter replacement requires a future explicit workflow and is not handled automatically in Version 1.
- The provided SESB rates are accepted as the initial configuration supplied by the system owner; verifying official tariff applicability is outside this document's scope.
- The estimate may differ from an official bill because Version 1 excludes taxes, rebates, minimum charges, service charges, and other adjustments.
- Personal-use load is expected; high availability and large-scale concurrency are not Version 1 goals.

## 16. Future Enhancements

Possible later releases may add:

- Authentication and multiple users.
- Multiple meters per house.
- Meter replacement and rollover workflows.
- Official SESB tariff synchronisation.
- Additional taxes, rebates, minimum charges, and configurable bill items.
- Notifications and reading reminders.
- Consumption charts and comparisons across houses or cycles.
- Export to CSV or PDF.
- Higher-accuracy hosted OCR or a meter-specific recognition model.
- Object storage for photographs.
