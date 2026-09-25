# Authentication: post-course portfolio modernization

These protections were added after the imported 2023–2024 academic submission and first portfolio cleanup. They are not claims about the original team's implementation. The original team was Landon Dahmen, Zander Wysong, Telson Cowan, and Jake McBride. See [provenance](PROVENANCE.md); [AUDIT-BASELINE.md](AUDIT-BASELINE.md) intentionally retains the historical findings.

## Password storage

`auth.js` uses asynchronous Node `crypto.scrypt`, available on Windows/Linux without an additional native-build package. Each password has a random 16-byte salt, a 32-byte derived key, and encoded parameters: `N=32768`, `r=8`, `p=3` (64 MiB maximum working allocation). Verification accepts the supported hash format and uses `timingSafeEqual`; login never compares plaintext database passwords. Password hashes use the existing `employees.password` column, widened to `TEXT`.

All new employee and demo-seed passwords are hashed before insertion. Known demo credentials remain `Johnny` / `123` (administrator) and `Tom` / `isCool` (employee). These weak public credentials are exclusively for the local demo, not real accounts. The short academic credentials are preserved; new accounts require 12–256 characters. Passwords and hashes are not returned by application APIs. Error logging avoids submitted values, database row details, and session contents.

## Sessions and authorization

`express-session` stores only an opaque signed session identifier in cookie `bac.sid`. `connect-pg-simple` stores session state in PostgreSQL table `user_sessions`, created automatically. There is no MemoryStore or JWT fallback. Sessions contain an employee ID and cookie metadata, not a password or browser-supplied role.

Login regenerates the session identifier and saves the session before redirecting. Every protected request reloads employee ID, username, role, and job from PostgreSQL. Role changes/deletions therefore apply on the next protected request. Availability always uses that employee ID; `userId` query/body values and submitted job values cannot select another employee. Administrators are also employee accounts and may use employee functionality as themselves.

| Route | Access |
| --- | --- |
| `/`, `/index.html`, `/login`, login/event-form pages and frontend assets | Public |
| `POST /login` | Public; successful credentials create a session |
| `/employee.html`, `/html/employee.html`, `/viewSchedule.html`, `/html/viewSchedule.html` | Authenticated employee, including administrators |
| `/admin.html`, `/html/admin.html`, `POST /create_employee` | Authenticated administrator |
| `POST /submit_availability` | Authenticated employee; session identity only |
| `/schedule` | Authenticated employee; reduced calendar fields and staffing name suggestions |
| `/Eventschedule` | Administrator only; event name/date/time/duration, future events only |
| `POST /logout` | Destroys session and clears cookie; also safe when already logged out |
| `POST /submit_form` | Public event-request intake, retained from the academic design |

There is no static HTML-directory mount. Both historical URL forms use the same guards. Unauthenticated protected pages redirect to login; protected APIs return 401; insufficient roles receive 403. Protected responses use `Cache-Control: no-store`.

Both actual calendar consumers use the same fields, so `/schedule` shares one reduced response for admins/employees. It omits customer name/email/phone, database IDs, internal staffing counts, and account fields. Event descriptions and employee staffing suggestions remain visible to authenticated staff because the views display them. `/Eventschedule` has no current frontend consumer and is restricted to admins. No public event directory was added.

Account creation validates username (trimmed, 1–50 characters), password (12–256, not blank), job (trimmed, 1–100), and a JSON boolean `isAdmin` (defaults to false). Only an already-authorized admin may create another admin. Invalid input receives 400; duplicate usernames receive 409. Job remains a text field to preserve the academic model.

## Local setup and session configuration

Copy `.env.example` to `.env` only if `.env` does not exist. Generate a local secret:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Put that value in `.env` as `SESSION_SECRET`. Do not publish it or use the example placeholder. Startup rejects missing, short (under 32 characters), and `replace-...` placeholder values. A random value matters: length checking alone does not establish entropy. `.env` remains ignored. Rotating the secret invalidates existing signed cookies.

Cookies are `HttpOnly`, `SameSite=Strict`, path `/`, with an eight-hour browser lifetime. PostgreSQL retains server-side expiration and prunes expired sessions. `SESSION_COOKIE_SECURE=false` supports local HTTP; set it to `true` for HTTPS. `NODE_ENV=production` refuses startup unless secure cookies are enabled. This check does not make the demo production-ready.

`TRUST_PROXY=false` is the default. Set `true` only behind exactly one trusted reverse proxy that overwrites forwarding headers and prevents direct public access to Node. This allows Express to recognize forwarded HTTPS for secure cookies and origin checks. Other proxy topologies need deliberate configuration, not this boolean shortcut.

Authentication/account/availability/logout POSTs reject supplied foreign `Origin` headers and `Sec-Fetch-Site: cross-site`. Non-browser clients may omit these headers. SameSite and origin checks provide browser CSRF defenses; no synchronizer-token system is implemented. Public event intake is unchanged.

Use the same hostname consistently for browser navigation. If 5432 is occupied, set `DB_PORT` in `.env` to a free port before `docker compose up -d --wait postgres`; Node uses the same value. pgAdmin is optional and still connects to `postgres:5432` within the Compose network.

## Existing plaintext academic-demo databases

Fresh startup creates/seeds tables with hashes and begins listening only after database initialization succeeds. Startup initialization is transactional. Existing valid scrypt hashes are left unchanged.

By default, finding any unsupported/non-hash password value causes startup to roll back and exit with `LEGACY_PASSWORDS_REQUIRE_OPT_IN`; there is no plaintext-login fallback. The existing database is not silently converted or deleted.

Only for a known academic/demo database whose old values are plaintext:

1. Stop the application and back up that database if its contents matter.
2. Set `MIGRATE_LEGACY_PASSWORDS=true` in its local `.env`.
3. Run `npm start` once. Startup hashes each legacy value in place, preserves account IDs/roles and existing passwords' meaning, and widens the column. It never prints credential values.
4. After successful initialization, stop the app, restore `MIGRATE_LEGACY_PASSWORDS=false`, and restart normally.

This is an explicit demo conversion, not a general production migration. It treats every unsupported stored format as plaintext: do not enable it for another hashing scheme or an unknown database. Old database backups may still contain plaintext. Hashing does not strengthen the known weak demo passwords. Automatic demo seeding remains enabled; never point this app at an unrelated database.

## Repeatable checks

With the project's disposable database running and `.env` configured:

```powershell
$env:AUTH_SMOKE_TEST = 'bac-local-demo'
node scripts/auth-smoke.js
Remove-Item Env:AUTH_SMOKE_TEST
```

The script starts a temporary app listener on a free loopback port, performs real HTTP requests and SQL assertions, and stops that listener. It checks both protected-page URL forms, roles, hash storage/login, identity tampering, schedule field allowlists, session rotation, logout, and cross-origin rejection. It creates a unique test account and availability record, then removes only those records. The app's normal academic seeding still runs. No external test framework or CI was added.

## Remaining limitations

This is an isolated local portfolio demo, not a production-ready identity system. There is no login rate limiting/account lockout, password reset/editing, MFA, breached-password screening, or comprehensive audit trail. Known demo accounts are automatically seeded. Login hashing can consume resources under abuse. HTTPS/reverse-proxy deployment, browser end-to-end behavior, and broader security testing require separate validation. Schedule descriptions may contain whatever text a submitter entered; authorization and field selection are not content redaction. Event-input validation/spam controls and general form/calendar/staffing defects remain deferred.
