# Brookings Activity Center — academic team portfolio

A 2023–2024 academic team project exploring event-request intake and employee availability/schedule viewing with Node.js, Express, and PostgreSQL. This was a course scenario, not a production deployment or a real external-client system.

**Original academic team:** Landon Dahmen, Zander Wysong, Telson Cowan, and Jake McBride. The original implementation is shared team work; this repository does not assign individual feature ownership.

## Repository provenance

This portfolio copy was created later from the final submitted source snapshot, with permission to publish the team project. Its Git history begins at import commit `2e64bca5a8fc68997a645f351df8b43fbc65e7b1`, tagged `academic-final-snapshot`. That commit is an import, **not the original team's development history**. Later changes in this repository are post-course portfolio modernization work.

See [provenance](docs/PROVENANCE.md) and the [historical audit baseline](docs/AUDIT-BASELINE.md). [README.txt](README.txt) is preserved unchanged as a historical artifact; use the setup instructions below for this portfolio copy.

## Implemented academic scope

Verified in the submitted source; these features retain the limitations described below:

- Event-request intake: contact details, event details, catering/equipment selections, and database insertion.
- Employee accounts and an admin/employee distinction: login checks a stored account and redirects to the corresponding page; an admin page provides account creation.
- Employee availability: date and three shift-status fields can be submitted and updated.
- Calendar/schedule viewing using FullCalendar and JSON endpoints.
- Basic staffing calculations and suggestions: party-size-based counts and employee name selection by job/date. These are not persistent assignments or a conflict-free scheduling engine, even where the historical interface says “Assigned.”

The stack is Node.js / Express, PostgreSQL via `pg`, vanilla JavaScript / HTML / CSS, and browser-loaded FullCalendar. Docker Compose supplies PostgreSQL and pgAdmin for local development. The admin page also retains a jQuery CDN reference. There is no frontend build step.

## Local setup

Prerequisites: Node.js 22 with npm (validation used Node 22.14.0 / npm 10.9.2), Docker with Docker Compose v2 or newer, and a browser. Calendar dependencies require internet access to their CDNs.

From the repository root, in PowerShell:

```powershell
Copy-Item .env.example .env
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
# Set SESSION_SECRET in .env to the generated value before continuing.
npm ci
docker compose up -d --wait postgres
npm start
```

Copy the example only when `.env` does not already exist. The session-secret placeholder must be replaced; startup intentionally rejects it. See [authentication setup and legacy database conversion](docs/AUTHENTICATION.md). The example contains public local-demo placeholders, not real secrets. `.env` and `node_modules` are ignored; `package-lock.json` is retained for reproducible dependency installation.

Open [the home page](http://127.0.0.1:3000/), [event request](http://127.0.0.1:3000/form.html), or [employee login](http://127.0.0.1:3000/login.html) through Express, rather than opening HTML files directly. For fake seeded accounts, `Johnny` / `123` opens the admin page and `Tom` / `isCool` opens the employee page. These academic sample passwords were never reused for real systems. Use only fake data and disposable passwords in this demo.

Startup automatically creates tables and inserts the original fake employee, availability, and event seed data into the configured database. **Point it only at a dedicated demo database.** It also adds an availability uniqueness constraint. Startup now hashes seed passwords and completes transactional database initialization before listening. Existing plaintext databases cause startup to fail unless the explicit demo-only conversion is enabled; see [conversion instructions](docs/AUTHENTICATION.md#existing-plaintext-academic-demo-databases). Seeds date from April–May 2024: navigate calendars to that period, and expect the future-events endpoint to exclude old events. Some form/calendar flows still have known defects; these modernization passes do not claim an end-to-end repaired demo.

### Configuration

Both Compose and the Node application use `POSTGRES_DB`, `POSTGRES_USER`, and `POSTGRES_PASSWORD`; defaults are `bac_demo`, `bac_demo`, and the public placeholder `local-demo-only`. Node loads `.env` via `dotenv`; already-set process environment variables take precedence.

| Variable | Purpose / default |
| --- | --- |
| `HOST`, `PORT` | Express binding: `127.0.0.1`, `3000` |
| `DB_HOST`, `DB_PORT` | Node database connection: `127.0.0.1`, `5432`; `DB_PORT` also sets the Compose host port |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | Shared database configuration |
| `PGADMIN_PORT` | Local pgAdmin HTTP port: `5050` |
| `PGADMIN_DEFAULT_EMAIL`, `PGADMIN_DEFAULT_PASSWORD` | pgAdmin login, shown in `.env.example` |
| `SESSION_SECRET` | Required random secret, at least 32 characters; no built-in fallback |
| `SESSION_COOKIE_SECURE` | `false` for local HTTP; `true` for HTTPS, required in production mode |
| `TRUST_PROXY` | `false`; enable only behind one correctly configured trusted proxy |
| `MIGRATE_LEGACY_PASSWORDS` | `false`; explicit one-time plaintext demo conversion opt-in |

Forms use same-origin actions, so changing the Express port needs no HTML edits. Compose publishes services on loopback only. It uses the `bac-portfolio-demo` project namespace and named volumes, with PostgreSQL `16.15` at `/var/lib/postgresql/data` and pgAdmin `9.18` at `/var/lib/pgadmin`. These are explicit version tags, not immutable digest pins. See [PostgreSQL releases](https://www.postgresql.org/docs/16/release.html) and [pgAdmin container documentation](https://www.pgadmin.org/docs/pgadmin4/9.18/container_deployment.html).

If port 5432 is occupied, change `DB_PORT` in your ignored `.env` before startup; leave unrelated services untouched.

Optionally start pgAdmin with `docker compose up -d pgadmin`. Open [pgAdmin](http://127.0.0.1:5050/) and sign in with the `.env` pgAdmin values. Register a server with host `postgres`, port `5432`, and the database/user/password from `.env`. Inside pgAdmin's container, `localhost` is not the PostgreSQL container. pgAdmin registration is optional; Node connects directly.

Stop Node with Ctrl+C; `docker compose stop` stops the local services while retaining data. Changing initialization credentials in `.env` does not modify an already-initialized database or pgAdmin volume. This pass does not destroy existing databases. Legacy password conversion runs only with the documented explicit opt-in.

## Limitations and modernization status

**First portfolio cleanup pass:** repository hygiene, provenance/audit documentation, environment-based configuration, pinned local containers with corrected persistence, restricted frontend static serving, and removal of sensitive debug logging and unused dependencies. No application source, CSS, HTML, or images were deleted. The historical package's generic `ISC` metadata was removed; this pass does not grant or add a license.

**Second portfolio modernization pass:** passwords use Node scrypt hashes; Express sessions are stored in PostgreSQL; backend guards protect employee/admin pages and APIs, including both historical HTML URL forms. Availability derives employee identity from the authenticated session, never browser-supplied IDs. Only admins can create accounts. `/schedule` requires authentication and omits customer contact/account fields; `/Eventschedule` is admin-only with a reduced response. Logout destroys the session. See [authentication design, configuration, conversion, and limitations](docs/AUTHENTICATION.md).

These protections are later portfolio work, not part of the original academic implementation. The app remains an isolated local demo: it retains known weak demo accounts and lacks login rate limiting, account recovery, and comprehensive production security controls.

Known remaining functionality issues include event-form confirmation/field mismatches, inconsistent relative navigation, malformed FullCalendar URLs, duplicate calendar initialization/fetch behavior, a catering truthiness bug, and staffing suggestions that ignore shift-status fields and overlapping events. Room/equipment quantities are not fully persisted. A focused HTTP/PostgreSQL authentication smoke script is now included; there is no broad application test suite or CI. Compatible dependency updates resolved the seven audit findings observed before this pass.

This project does not implement attendee ticket registration, payments, fully automated workforce scheduling, or persistent conflict-free staff assignments. Subsequent portfolio work should address remaining security hardening, validation and privacy, and the broken form/calendar flows while preserving attribution and the snapshot baseline.

### First-pass validation (2026-09-25)

- `npm ci` succeeded after allowing registry access; npm reported 7 dependency vulnerabilities (3 low, 1 moderate, 3 high). No automatic dependency upgrade was applied, and retained lockfile package versions were unchanged.
- `node --check` passed for all five application JavaScript files; inline HTML JavaScript also parsed successfully.
- `docker compose --env-file .env.example config --quiet` passed. Containers were not started and image pulls/database initialization were not tested.
- An isolated `npm start` smoke check served 28 frontend URLs and returned 404 for 14 source/configuration/private paths. A temporary non-database socket prevented any connection to an existing database; the database-error response/logging was checked, not successful SQL workflows.
- `git diff --check` passed. There is no test/lint/build script beyond `start`, and no browser end-to-end validation was performed.

### Second-pass validation

`node scripts/auth-smoke.js` (with the documented demo opt-in) passed all 12 check groups against this project's fresh PostgreSQL 16.15 database: protected routes, employee/admin login and permissions, new account validation/hash storage, forged identity rejection, reduced schedule fields, PostgreSQL session state, rotation, and logout. Test-created account/availability data was removed. The local `.env` uses port 15432 because 5432 was occupied; the example default remains 5432.

The pre-pass audit reported 7 vulnerabilities (3 low, 1 moderate, 3 high); the updated production dependency audit reports 0. The original first-pass validation above is retained as historical context. Browser calendar/form correctness and HTTPS/proxy deployment are not covered by the authentication smoke checks.
