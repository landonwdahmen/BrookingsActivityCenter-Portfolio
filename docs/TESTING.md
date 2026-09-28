# Testing and CI — fourth portfolio pass

These validation tools are post-course modernization, not part of the imported academic submission. Application behavior, authentication, seed identities, and scheduling rules are unchanged in this pass.

## Commands and explicit safety flags

| Command | Checks |
| --- | --- |
| `npm run check` | Alias for `check:syntax`; no database required |
| `npm run check:syntax` | Node syntax parsing for root/scripts JavaScript and inline HTML JavaScript |
| `npm run test:auth` | Existing authentication HTTP/PostgreSQL smoke checks |
| `npm run test:functionality` | Existing form, persistence, availability, calendar-adapter, navigation checks |
| `npm test` | Authentication followed by functionality; stops on failure |
| `npm audit --omit=dev` | Registry advisory audit; requires network access |

Run tests only against a dedicated, disposable BAC demo database. The application performs normal schema initialization and academic seeding at startup. Tests assume documented demo accounts `Johnny` / `123` and `Tom` / `isCool` remain usable. They do not reset account passwords or delete other records to force a pass.

PowerShell opt-in:

```powershell
$env:AUTH_SMOKE_TEST = 'bac-local-demo'
$env:FUNCTIONALITY_SMOKE_TEST = 'bac-local-demo'
npm test
Remove-Item Env:AUTH_SMOKE_TEST, Env:FUNCTIONALITY_SMOKE_TEST
```

Linux/macOS shell opt-in:

```sh
AUTH_SMOKE_TEST=bac-local-demo FUNCTIONALITY_SMOKE_TEST=bac-local-demo npm test
```

Individual scripts require their own flag. The combined runner checks both before launching either suite. No npm command silently sets the guards. `.env` supplies local configuration, but environment variables take precedence; CI sets all required values directly and never creates or reads a developer's local `.env`.

## Isolation and resource lifecycle

Both existing smoke scripts remain; a small `scripts/smoke-support.js` shares the failure-safe cleanup already developed for functionality testing. Both use unique account/event names, track intended writes before asserting responses, record exact session IDs (including seed-account test logins), and clean up in `finally`.

Cleanup stops only the script's temporary Node child with bounded exit waits; it resolves IDs from run-specific names, deletes availability and sessions before employees, removes run-specific events, verifies zero matching rows, and always attempts to close the PostgreSQL pool. It never deletes all sessions belonging to a seed user. Cleanup failures produce nonzero exits and do not hide an earlier test failure. Database unavailability or forcible termination of the entire test process can still prevent cleanup; errors are not reported as success.

Both suites run sequentially against one database in CI. The normal demo seeds remain; temporary test data must not remain. Each hosted job receives a new PostgreSQL service with no persistent volume. No separate test framework, coverage percentage, or complete browser simulation is claimed. Confirm/Cancel and calendar behavior use small doubles; HTTP/SQL and session behavior use the real application and PostgreSQL.

## GitHub Actions

`.github/workflows/ci.yml` defines `BAC validation` on `push` and `pull_request`. It uses an Ubuntu hosted runner, Node 24 LTS, and PostgreSQL 16.15. The service health check runs `pg_isready -U bac_ci -d bac_ci` every five seconds, with five-second timeouts and twelve retries. The job has a fifteen-minute timeout.

The service and application both use database/user `bac_ci`, port 5432, and a public fake CI-only password. The job sets a public fake session secret, HTTP cookie mode, disabled proxy trust/legacy conversion, and both smoke opt-ins. These credentials have no purpose outside the disposable CI service; no repository secrets are required.

Steps: checkout without persisted Git credentials; setup Node with npm download caching keyed by the lockfile; `npm ci`; `npm audit --omit=dev`; `npm run check`; `npm test`. Only `contents: read` permission is granted. Normal failed steps stop the job. There are no deployments, publishing steps, badges, or secret-bearing artifacts. An advisory newly published after this pass can make the audit fail even without a code change.

## Fresh setup verification

Verified on 2026-09-28:

- Main checkout: Windows Node 22.14.0 / npm 10.9.2; fresh `npm ci`, audit (0 findings), syntax checks, and `npm test` passed. Both missing-opt-in guards stop the combined runner before launching suites.
- Fresh Windows setup: copied only candidate repository files into an ignored temporary directory, excluding `.git`, `.env`, `node_modules`, caches, and local artifacts. Generated a new local secret from `.env.example`, used a separate BAC Compose project on port 15434 with a newly created volume, installed dependencies afresh, and passed syntax checks and both suites. No main-checkout database data was reused.
- Linux CI-equivalent commands: Node 24.21.0 / npm 11.19.0 in a disposable container, a fresh empty `bac_ci` database within that verification project, no `.env`, and no copied `node_modules`. `npm ci`, production audit (0 findings), syntax checks, and two consecutive `npm test` runs passed. Authentication: 12 groups per run; functionality: 6 groups per run.
- SQL checks after those runs: 0 temporary employees, 0 temporary availability rows, 0 temporary events, 0 session rows; 10 demo employees and 10 seed events remained. An injected auth failure immediately after employee creation also preserved the original error and verified zero run-specific leftovers.
- Compose configuration validated. Actionlint 1.7.12 accepted the workflow (shellcheck integration disabled; run steps are simple npm invocations). Both `actions/checkout@v6` and `actions/setup-node@v6` refs were verified against their official repositories. No local GitHub Actions runner was available and no hosted workflow execution is claimed.

Only the separate disposable verification containers/network/volume were removed afterward. The main BAC demo resources and working checkout were preserved. Temporary source copies/tool downloads remain ignored under `.cache`. The CI-equivalent Linux check used the PostgreSQL service's network hostname; the hosted workflow uses its published loopback port, both with the same application environment interface.

Limitations: local commands and a Linux container can validate the workflow's commands and services, but cannot certify GitHub-hosted action execution. No hosted CI run is claimed before publication. Real-browser end-to-end tests, failure injection for every resource error, coverage measurement, and a comprehensive static linter remain future work.
