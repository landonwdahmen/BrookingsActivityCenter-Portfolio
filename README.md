# Brookings Activity Center

A **2023–2024 academic team project** for event-request intake, employee availability, calendar viewing, and basic staffing suggestions. It was a course scenario, not a production deployment or a real external-client system.

**Original team:** Landon Dahmen, Zander Wysong, Telson Cowan, and Jake McBride. The original implementation is shared team work; no individual feature ownership is claimed.

This portfolio copy starts with the final-submission import, tagged `academic-final-snapshot`; its Git history is **not the original team's development history**. Later commits are post-course modernization. See [team provenance and publication permission](docs/PROVENANCE.md).

## Stack and functionality

Node.js / Express, PostgreSQL with `pg`, vanilla JavaScript / HTML / CSS, FullCalendar 6.1.19, Docker Compose, and optional pgAdmin. There is no frontend build step.

- Event requests save contact/event details, room selections, catering/equipment choices, and equipment quantities.
- Employee/admin accounts use scrypt password hashes and PostgreSQL-backed Express sessions, with backend role checks and logout.
- Availability writes use authenticated identity; repeated employee/date submissions update existing availability.
- Protected calendars show local date/time and staffing suggestions filtered by documented same-day shifts. Customer contact fields are excluded from schedule responses.

Post-course passes added repository/configuration hygiene, authentication/authorization, form/calendar repairs, and now explicit check/test commands and CI. Details: [authentication](docs/AUTHENTICATION.md), [functionality and shift limits](docs/FUNCTIONALITY.md), [testing and CI](docs/TESTING.md).

## Run locally

Use Node.js **24 LTS**, npm, and Docker Compose v2 or newer. Calendar rendering requires access to its CDN. From the repository root in PowerShell:

```powershell
# Only copy when .env does not already exist.
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
# Paste that generated value into SESSION_SECRET in .env.
npm ci
docker compose up -d --wait postgres
npm start
```

Open [the application](http://127.0.0.1:3000/) and [employee login](http://127.0.0.1:3000/login.html). Demo credentials: `Johnny` / `123` (admin), `Tom` / `isCool` (employee). Seeded records are fake and sample passwords were never reused for real systems. Use only fake data and disposable passwords.

Node and Compose share `POSTGRES_DB`, `POSTGRES_USER`, and `POSTGRES_PASSWORD`. Defaults are `bac_demo`, `bac_demo`, and the public placeholder `local-demo-only`. If port 5432 is occupied, change `DB_PORT` in `.env` before startup; do not stop another service. Express defaults to `127.0.0.1:3000`. `.env` and `node_modules` are ignored; the lockfile is retained. Shell environment values override `.env`.

Startup creates/additively updates tables and seeds fake academic data in the configured database; **use a dedicated demo database**. It waits for initialization before listening. Old plaintext databases require [explicit conversion opt-in](docs/AUTHENTICATION.md#existing-plaintext-academic-demo-databases). Seeds date from April–May 2024: navigate the calendar to that period.

Optional pgAdmin: `docker compose up -d pgadmin`, then open [pgAdmin](http://127.0.0.1:5050/) with the values from `.env`. Register host `postgres`, port `5432`, and the configured database credentials. Compose pins PostgreSQL 16.15 and pgAdmin 9.18 with named-volume persistence. `docker compose stop` retains data; changing initialization credentials does not change existing volumes.

## Checks and tests

```powershell
npm run check
npm audit --omit=dev
# Explicit opt-in: use only this project's disposable/demo database.
$env:AUTH_SMOKE_TEST = 'bac-local-demo'
$env:FUNCTIONALITY_SMOKE_TEST = 'bac-local-demo'
npm test
Remove-Item Env:AUTH_SMOKE_TEST, Env:FUNCTIONALITY_SMOKE_TEST
```

`npm test` runs authentication then functionality against the same database. Individual commands are `npm run test:auth` and `npm run test:functionality`; each still requires its safety flag. `npm run check` / `npm run check:syntax` parse JavaScript and inline HTML scripts without a database. These are focused integration checks with some DOM/calendar doubles, not broad unit coverage or real-browser end-to-end tests.

The **BAC validation** GitHub Actions workflow runs on pushes and pull requests: Node 24, a health-checked PostgreSQL service, `npm ci`, production-dependency audit, syntax checks, and both suites. It uses fake CI-only credentials, no repository secrets, and no deployment. Local verification and its limits are recorded in [testing documentation](docs/TESTING.md); adding the workflow does not claim it has already run on GitHub.

## Limits

This remains a local portfolio demo, not production-ready software. Known weak demo accounts, missing login throttling/MFA/account recovery, and incomplete abuse controls remain. HTTPS/proxy deployment needs separate validation. The [historical audit](docs/AUDIT-BASELINE.md) and [original README](README.txt) describe earlier states; use the setup instructions above for the current version.

Staffing names are **suggestions, not assignments**. Overnight availability-date ownership is unresolved, so ambiguous overnight events receive no suggestions. Overlapping events can suggest the same employee. There is no persistent assignment, conflict prevention, room-conflict policy, optimizer, venue timezone/DST policy, payment processing, or attendee ticketing. No license has been added.
