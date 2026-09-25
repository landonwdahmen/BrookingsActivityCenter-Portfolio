# Historical implementation audit baseline

Source reviewed: import commit `2e64bca5a8fc68997a645f351df8b43fbc65e7b1`, tag `academic-final-snapshot`, representing the final submitted 2023–2024 academic team source. These are source-verified historical implementation findings, not active production incidents. The system was a course scenario; seeded employee/event data is fake, and sample passwords were never reused for real systems.

| Finding | Evidence in the academic snapshot | First-pass disposition |
| --- | --- | --- |
| No persistent session/token authentication | `server.js` `/login` queries accounts then redirects; it issues no session or token and routes have no authentication middleware. | Unchanged; redesign deferred. |
| Plaintext password handling | `employees.password`, seeded passwords, `/login` equality query, and `/create_employee` insertion use plaintext. Declared `bcrypt` is never imported. | Unchanged; unused dependency removed, no hashing/migration. |
| Unrestricted employee/admin creation | `/create_employee` accepts caller-supplied `isAdmin` without authorization. | Unchanged. |
| URL/form-controlled employee identity | Login redirects include `userId`; `employeeScript.js` copies URL identity into a hidden field; `/submit_availability` trusts it. | Unchanged. |
| Public schedule/contact exposure | `/schedule` and `/Eventschedule` expose event data, including name/email/phone, without authorization. `/schedule` also returns employee name suggestions. | Unchanged; only logging/static exposure addressed. |
| Project-root static serving | `express.static(__dirname)` exposes root source and package/Compose files. Express normally ignores dotfiles, but this is not an appropriate repository access boundary. | Replaced with frontend-only directory mounts and explicitly named root files. |
| Hard-coded local service credentials | `server.js` uses `admin` / `root`; Compose repeats local credentials and pgAdmin defaults. | Environment configuration and public local-demo defaults added. Academic sample account passwords remain. |
| Browser logging of password/form values | `html/admin.html` logs each `FormData` value, including password; calendar scripts log complete event objects; availability script logs employee identity. | Removed. Server error logs now retain context/error codes without PostgreSQL details that may echo row values. |
| `BAC` / `test_db` mismatch | Node selects `BAC`; Compose initializes `test_db`. | Both now use `POSTGRES_DB`, default `bac_demo`. |
| Incorrect Docker persistence paths | Unversioned images mount `/var/lib/BACv2.00/data` and `/var/lib/BACv2pgadmin`, rather than image data locations. | Explicit image versions, corrected paths, loopback bindings, shared configuration, and a database healthcheck. |
| Event-form/navigation defects | `script.js` defines `displayConfirmationBox` twice, references absent `description` and `availabilityForm` elements, reads `.checked` on selects, and relies on implicit `event`. `html/form.html` references relative `script.js`; several relative Home/image links fail under `/html/`. | Business/form defects deferred; hard-coded form origins replaced with same-origin actions. |
| Calendar defects | `html/admin.html` and `html/viewSchedule.html` use `https:/cdn...`; admin loads `admin.js` twice and lacks elements its menu handler expects. Both calendar scripts combine raw endpoint events with a separate transformed fetch. | Unchanged. |
| Catering truthiness bug | `/submit_form` calculates cooks using the truthiness of the submitted string; both `yes` and `no` are truthy. | Unchanged. |
| Scheduling ignores shift status | `/schedule` selects names by job and date with a limit; it does not filter `SHIFT_1`, `SHIFT_2`, or `SHIFT_3`, check overlaps, or persist assignments. | Unchanged; documented as suggestions. |
| No application tests | No test files/framework or test script in the imported tracked source. | No test framework added; first-pass checks are installation, syntax, and targeted runtime checks. |
| No CI | No CI configuration in the imported tracked source. | Unchanged. |

Additional limitations: table creation/seeding runs at every startup, outside a migration system; the HTTP listener does not await initialization. Database errors can leave the listener running without working data endpoints. Seeds use historical 2024 dates. Room selections and chair/table quantities are not persisted by the event insert. Input validation and error handling require later review.

The first pass does not implement sessions, RBAC, password migration, CSRF protection, privacy filtering, staffing redesign, a test framework, or CI. Future security and functionality work belongs to post-course portfolio modernization and must remain distinct from the academic baseline.
