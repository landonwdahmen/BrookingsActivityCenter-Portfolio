# Source provenance

This repository was reconstructed later from the final submitted source of the 2023â€“2024 Brookings Activity Center academic team project. The original project was a course scenario, not a production deployment or a real external-client system.

## Original academic team

- Landon Dahmen
- Zander Wysong
- Telson Cowan
- Jake McBride

The original implementation is attributed to this team collectively. No original feature is assigned to an individual without separate supporting documentation; the portfolio copy does not imply sole authorship.

## Imported baseline

- Import commit: `2e64bca5a8fc68997a645f351df8b43fbc65e7b1`
- Import commit subject: `chore: import final academic project snapshot`
- Tag: `academic-final-snapshot`

This first commit/tag records the imported final-submission source snapshot. The original source-development history is not represented here. Git dates, authorship metadata, and subsequent commits in this new repository must not be interpreted as a reconstruction of the academic team's development timeline. No other person's repository is asserted to be this team's original history.

The repository owner has permission to publish this team project. Seeded employee/event records are fake test data. Embedded sample passwords were never reused for real systems. Publication permission does not by itself establish a software license; none is added in this cleanup pass.

## Post-course portfolio work

Changes after the imported snapshot are later portfolio modernization, not retroactive changes to what was submitted for the course. The first cleanup pass adds repository hygiene, a current README, this provenance record, a historical audit, local environment configuration, container corrections, narrower static serving, logging cleanup, and package metadata/dependency cleanup.

The first cleanup was committed as `c68c5c3` (`chore: establish portfolio baseline and local configuration`). The second modernization pass adds scrypt password hashing, PostgreSQL-backed sessions, backend role enforcement, session-derived availability identity, guarded HTML routes, reduced authenticated schedule responses, and compatible dependency security updates. These are post-course portfolio changes; they do not describe the original academic submission. See [authentication documentation](AUTHENTICATION.md) and the focused repeatable checks in `scripts/auth-smoke.js`. The historical audit baseline remains unchanged.

Authentication was committed as `4bcd6e3`. The third portfolio pass repairs event/availability forms, persists existing room/equipment controls, corrects catering interpretation, consolidates calendar loading, normalizes navigation/local date handling, and filters staffing suggestions against documented shift labels. Overnight date ownership and overlap resolution remain explicitly unresolved. See [functionality details](FUNCTIONALITY.md). These repairs are later modernization and do not imply individual ownership of the original team features.

The original [README.txt](../README.txt) is preserved as an artifact. The tag retains the submitted source; the working tree may include later changes. Use `git diff academic-final-snapshot --` to inspect the distinction for tracked files, and `git status --short` to see new untracked documentation before it is committed. Future work should continue documenting this distinction without claiming original individual feature ownership.

The functionality repairs were committed as `e1f19a2`. The fourth portfolio pass formalizes npm checks and sequential integration tests, shares test-only cleanup helpers, adds GitHub Actions validation with a disposable PostgreSQL service, and verifies fresh setup. These engineering improvements are later portfolio modernization; application behavior and the historical academic audit are preserved. See [testing and CI](TESTING.md).
