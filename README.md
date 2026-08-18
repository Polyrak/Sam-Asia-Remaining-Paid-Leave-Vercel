# Remaining Paid Leave

A small dashboard that shows each employee's remaining paid leave, sourced from
an [OpenProject](https://www.openproject.org/docs/api/endpoints/) instance.

Leave isn't tracked as individual work packages per request — it's tracked as
**time entries** logged against a shared "Paid leave" work package (commonly
under a project set up for leave management, e.g. one work package per leave
*category*: "Paid leave", "Unpaid leave", "Public holidays", etc., with each
employee's individual bookings logged as time entries against the relevant
one). Annual entitlement isn't a native OpenProject concept, so it's stored
locally by this app (`backend/src/data/entitlements.json`) and edited from the
Settings page.

Each employee's annual entitlement is **base days + a manual adjustment**
(e.g. `19 + 15 = 34`), matching how this is tracked in HR's own records —
the adjustment is typically a carried-over balance from a prior year or a
correction, and isn't something derivable from OpenProject, so it's entered
by hand per employee on the Settings page (same idea as the "Annual PL"
column in an HR leave spreadsheet).

**Remaining = (base days + adjustment) − days logged on the "Paid leave"
work package this year**, with a Jan–Dec monthly breakdown of days used
shown on the dashboard, mirroring a typical HR leave tracking sheet.

Employees are read from the **members of one OpenProject project**, not the
global user list — a non-admin API key generally can't list every user in the
instance, but it can always see the members of projects it belongs to.

There's no login screen — anyone who can reach the app's URL sees the
dashboard directly. If you need to restrict access later, put the app behind
your existing network/VPN or a reverse proxy with basic auth, rather than
building sign-in into the app itself.

## Structure

- `backend/` — Node.js/Express API that authenticates to OpenProject with an
  API key, fetches project members and paid-leave time entries, and computes
  the summary. Includes a `/api/discover` endpoint to help you find the
  OpenProject IDs you need to configure.
- `frontend/` — Vue 3 + Vuetify 3 (Vite) single-page app: a dashboard table,
  a per-employee leave history page, and a Settings page.

## One-time OpenProject setup

In OpenProject, you'll need:

1. A project whose members are the employees you want on the dashboard.
2. A work package in that project that employees log their paid leave time
   against (e.g. subject "Paid leave").
3. An API key: **My Account → Access tokens → API** in OpenProject.

## Running it

### 1. Backend config (one-time)

```bash
cd backend
cp .env.example .env
# edit .env: set OPENPROJECT_URL and OPENPROJECT_API_KEY
```

### 2. Start both servers

From the repo root:

```bash
npm run install:all   # first time only — installs backend/ and frontend/ deps
npm run dev           # starts backend (:4000) and frontend (:5173) together
```

Output is prefixed `[backend]`/`[frontend]` so you can tell which process
logged what. Open `http://localhost:5173`.

(You can still run `npm run dev` inside `backend/` or `frontend/` individually
if you only need one of them.)

### 3. Finish configuration

Open the app's **Settings** page and click **Run discovery**. It lists:

- projects → copy the id of your project into `OP_LEAVE_PROJECT_ID`
- once that's set and you re-run discovery, it also lists work packages in
  that project whose subject or type mentions "leave"/"holiday" — copy the id
  of the one employees log paid leave against into
  `OP_PAID_LEAVE_WORK_PACKAGE_ID`

Restart the backend after editing `.env`. Then set a default base entitlement,
and per-employee base days/adjustment overrides to match your HR records, on
the same Settings page.

`OP_HOURS_PER_DAY` (default `8`) controls how logged hours convert to days —
adjust it if your organization uses a different standard workday length.

## Entitlement fields (Settings → Per-employee overrides)

Each override has three fields:

| Field | Accepts | Examples |
| --- | --- | --- |
| **Base days** | A single plain number (integer or decimal). Leave blank to use the org-wide default. | `18`, `19`, `19.5` |
| **Adjustment** | A single number, **or several numbers added together** (as an HR spreadsheet cell often writes a carried-over balance) — copy the spreadsheet cell in as-is. Leave blank for `0`. | `-7.5`, `15`, `24.5 + (-7.5)`, `(-2) + 2.5`, `17.5 (-0.5)` |
| **Display as** *(optional)* | Any free text, purely cosmetic. Auto-filled with the original expression when Adjustment is a multi-number sum, so the dashboard/exports still show e.g. `24.5 + (-7.5)` instead of the collapsed `17` — only fill this in yourself to override that text. | `17.5 (-0.5)` |

A bare `-` meant as subtraction (spaces on both sides, like `17.5 - 0.5`)
isn't understood, since it's ambiguous with a negative number that happens to
follow another term — write the negative number's sign directly against it
instead (`17.5 (-0.5)` or `17.5 -0.5`). Anything that isn't a number or a sum
of numbers (stray letters, `*`, `/`, unbalanced parentheses, etc.) is
rejected with an error rather than silently saved wrong.

## API summary (backend)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | liveness + whether leave tracking is configured |
| GET | `/api/discover` | introspect OpenProject projects and candidate leave work packages |
| GET | `/api/employees` | members of the configured project |
| GET | `/api/leave-requests?userId=` | paid-leave time entries this year, optionally filtered by user |
| GET | `/api/leave-summary` | per-employee entitlement (base + adjustment), Jan–Dec monthly usage, used/remaining |
| GET/PUT | `/api/entitlements`, `/api/entitlements/default`, `/api/entitlements/:userId` | manage local entitlement config |

## Notes

- Responses from OpenProject are cached in-memory for `CACHE_TTL_SECONDS`
  (default 60s) to avoid hammering the API; editing entitlements clears the
  cache immediately.
- Employee names come from project memberships; per-user email/login aren't
  reliably visible to a non-admin API key, so they're not shown.
- There is no authentication layer on this app itself — it's meant to run
  behind your existing internal network/SSO. Add auth before exposing it
  publicly.
