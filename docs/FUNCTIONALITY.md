# Third portfolio modernization pass

This pass repairs verified behavior after authentication commit `4bcd6e3`. It is post-course portfolio work, not part of the original academic submission by Landon Dahmen, Zander Wysong, Telson Cowan, and Jake McBride. [AUDIT-BASELINE.md](AUDIT-BASELINE.md) remains unchanged as the imported-state audit.

## Verified defects and corrected flows

The current source still had a relative event-script path, two conflicting confirmation functions, nonexistent `description`/`availabilityForm` references, `.checked` reads on selects, and reliance on implicit `event`. Availability also combined inline validation, a submit listener, and programmatic submission; its next-Monday arithmetic skipped a week on Sunday. Both calendars mixed a raw JSON event source with a separate transformed fetch, and admin loaded its script twice and referenced absent menu elements. FullCalendar URLs were malformed/unversioned. Relative Home/image/page links failed under `/html/`. These defects were verified before editing.

Each form now uses native browser validation and one confirmation handler: Confirm allows the native POST, Cancel prevents it. No hidden identity fields or URL identities were restored. Dates in the availability dropdown are ISO dates for the next Monday through Sunday; Sunday advances one day and Monday advances seven. Form completion uses a canonical redirect and an inline status message. All local navigation/assets use absolute paths; historical `/html/...` page aliases still work.

The event server validates required text against existing database lengths, a basic email shape, valid dates/times, positive whole-number party size/duration, explicit Yes/No selections, room controls, and nonnegative whole-number equipment quantities. Integer limits reflect PostgreSQL storage; event end must fit the supported four-digit calendar year range. The existing client rule forbidding starts from 03:00 inclusive to 05:00 exclusive now also runs server-side. Past events remain allowed; no new booking horizon is imposed. The room section's existing “one or more” instruction is enforced. Duplicate event names retain the database uniqueness rule and return 409 rather than a generic 500.

## Persistence and catering

The existing contact, party size, duration (whole hours), event name/date/time, description, catering, and equipment fields are saved consistently. Literal `yes` means true and `no` means false. Original formulas remain:

- Cooks: `ceil(party size / 50)` with catering, otherwise zero.
- Event staff: `2 + ceil(party size / 50)`.

Startup makes three additive, idempotent schema changes: `rooms TEXT[]`, `chairs_amount INTEGER`, and `tables_amount INTEGER`, all non-null with empty/zero defaults. They directly represent the already-present seven room checkbox names and two equipment quantity inputs. Checked room names are saved exactly; no room capacities, partition relationships, booking state, or conflict semantics are inferred. An empty equipment quantity means zero. Selecting equipment No saves both quantities as zero and disables their browser controls so stale hidden values are not submitted.

Old records receive empty/zero defaults because their unrecorded selections cannot be reconstructed. Existing academic seed counts are not rewritten. The schedule never suggests cooks for events whose catering flag is false, even if a historical fixture's count is inconsistent. There are no actual catering-detail input fields in the placeholder section, so no catering-detail schema was invented.

Availability accepts a valid date and exactly `Available` or `Not Available` for each of the three shifts. An atomic `INSERT ... ON CONFLICT (username, date) DO UPDATE` uses the existing uniqueness constraint, avoiding the old check-then-insert race. Identity, username, and job come from the authenticated account. The API does not impose a new date-range restriction; the browser offers the upcoming week.

## Calendar and local time

Both views share `calendar.js` with one FullCalendar instance, one `/schedule` event source, and one `eventDataTransform` adapter. Admin's duplicate inclusion, manual extra fetch, nonexistent-menu handler, and unused jQuery reference were removed. FullCalendar uses the pinned [6.1.19 global bundle](https://cdn.jsdelivr.net/npm/fullcalendar@6.1.19/index.global.min.js); no new npm dependency or visual theme was added.

PostgreSQL formats schedule DATE/TIME as `YYYY-MM-DD` and `HH:mm` strings, avoiding a server-local-Date-to-UTC conversion. The adapter creates offset-free start/end timestamps and includes the stored duration, including end-date rollover. Its UTC methods are used only for civil-field arithmetic; no UTC offset is sent to the calendar. FullCalendar displays those values in the browser's local time. No venue timezone, travel conversion, or daylight-saving elapsed-time policy is inferred. Consistent venue timezone behavior remains future work.

## Staffing suggestions and explicit limits

Source: the three labels in `html/employee.html` define shift 1 as 05:00–13:00, shift 2 as 13:00–21:00, and shift 3 as 21:00–03:00. Same-day events from 05:00 through midnight use every shift interval touched by their duration. Intervals are start-inclusive/end-exclusive: an event ending at 13:00 needs shift 1 only; one extending past 13:00 needs both shifts 1 and 2. Every relevant status must be `Available`; missing availability yields no suggestion. Candidates must match an existing employee and job, are ordered by employee ID for repeatability, and are capped by the existing counts.

The source does not define which availability date owns 00:00–03:00 or how a cross-midnight event should combine dated rows. Consequently, events starting before 05:00 or ending after midnight return no staffing suggestions. Shift 3 is used only for its unambiguous same-date 21:00–midnight portion. Exact-midnight endings are supported. This conservative result is not a declaration that staff are unavailable: those events need manual review. Starts during 03:00–05:00 are separately rejected by the existing event rule.

Overlapping events are evaluated independently and may suggest the same employee. No availability is consumed, assignment stored, conflict prevented, optimization performed, or room overlap resolved. The calendar explicitly calls the names **suggestions** and warns that overnight/overlapping events require manual review. Shortages are shown by fewer or no suggested names, not automatically filled.

## Repeatable validation

Use only the BAC demo database, with `.env` configured and its PostgreSQL service healthy:

```powershell
$env:AUTH_SMOKE_TEST = 'bac-local-demo'
node scripts/auth-smoke.js
$env:FUNCTIONALITY_SMOKE_TEST = 'bac-local-demo'
node scripts/functionality-smoke.js
Remove-Item Env:AUTH_SMOKE_TEST, Env:FUNCTIONALITY_SMOKE_TEST
```

The authentication checks are retained. The functionality script launches a temporary app listener and checks real HTTP/SQL event persistence, Yes/No calculations, invalid submissions, availability insert/update, and shift-sensitive suggestions. It tests Sunday/year rollover, Confirm/Cancel handlers with small DOM doubles, the calendar adapter with a FullCalendar double, all local page resources/navigation, and blocked private files. A `finally` block stops the temporary server, removes only this run's availability, tracked sessions (including its admin login), employees, and events, and always attempts to close the PostgreSQL pool. Intended unique names are tracked before writes so partial setup is covered. Cleanup verifies zero matching rows; errors are reported without replacing the original test failure. Cleanup requires a reachable database and a running test process; it does not claim recovery from forced process termination. Existing project records remain. Cleanup validation passed two consecutive successful runs and two deliberately injected failures (after employee creation before ID tracking, and after availability/session creation). Direct database queries found zero matching test records and zero newly created session rows after each run. These are focused checks, not a full test framework or browser end-to-end suite.

Remaining limitations include overnight date ownership, event/room/staff overlap policy, timezone/DST policy, calendar date-range filtering, and production input/abuse controls. External CDN access is still required. No payment, ticketing, account editing/reset, or optimizer was added. The subsequent fourth pass adds [npm commands and CI](TESTING.md) and shares cleanup between the existing suites.
