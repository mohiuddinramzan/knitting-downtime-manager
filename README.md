# Knitting Machine Downtime Manager

An Android app for circular knitting factories that turns machine downtime into
three colors an operator can read from across the floor:

- 🟢 **GREEN** — Running
- 🔴 **RED** — Problem reported, machine stopped
- 🟡 **YELLOW** — Work in progress

Downtime is never typed in by hand — it's calculated automatically from the
timestamps of Report → Work Started → Resolved.

---

## 1. What's in this build

This is plain HTML/CSS/JS (no framework, no bundler) packaged into an Android
APK with **Capacitor**. That choice is deliberate: factory phones are often
low/mid-range Android devices, and a plain WebView app stays light and fast
on them.

**Out of the box it runs with zero setup and zero paid services**, using the
browser's `localStorage` as the data store. Every mutating action (report a
problem, start work, resolve, assign an operator, admin edits) goes through
one file, `src/js/db.js`, which re-checks the user's role and machine
assignment *there* — not just by hiding a button in the UI. See
[Section 6, Security model](#6-security-model) for exactly what that does
and does not protect against, and how to move to a real backend
(Firebase/Firestore) for a multi-device factory rollout.

## 2. Features

- Role-based dashboard, machine list (search/filter by status, shift,
  operator), and machine detail screen
- Report Problem flow: category → specific problem → confirm, in 2 taps
- Automatic downtime timer with 10 / 30 / 60-minute loss classification
  (⚠️ Production Loss / 🔴 Major Downtime / 🚨 Critical Downtime)
- QR scanner (camera + [jsQR](https://github.com/cozmo/jsQR), no paid plugin)
  to jump straight to a machine, with a machine-list fallback
- Full state-machine validation (no `GREEN → RESOLVED`, no double-reporting,
  one active downtime event per machine, etc.)
- Append-only audit log (Supervisor/Admin only) — no update/delete function
  exists for it anywhere in the code
- Reports: totals, averages, top downtime machines, top problem categories,
  by day/week/month/all-time
- Admin panel: users, machines, shift assignments, problem categories
- Bilingual (English/Bengali) labels on all status and action text
- Offline banner + non-blocking UI if the connection drops

## 3. User roles

| Role | Can do |
|---|---|
| **Operator** | See assigned machines, report a problem / start work / resolve on **their own assigned machine only** |
| **Technician** | See & act on machines with an active problem (start work, resolve, add notes); cannot report new problems or touch admin data |
| **Supervisor** | Everything an operator/technician can see, plus: assign operators to machines/shifts, cancel or correct a wrongly-reported problem (audited), view audit log |
| **Admin** | Full access: users, machines, assignments, problem categories, reports, audit log, settings |

Demo accounts (seeded on first run — replace these from the Admin Panel
before real use):

| ID | PIN | Role |
|---|---|---|
| ADMIN1 | 0000 | Admin |
| SUP01 | 1111 | Supervisor |
| TECH05 | 2222 | Technician |
| OP101 | 1010 | Operator — assigned K-101, K-117 |
| OP102 | 1020 | Operator — assigned K-102, K-132 |
| OP103 | 1030 | Operator — assigned K-103, K-109 |

## 4. Local development

```bash
# no install needed — it's static files. Just serve the folder, e.g.:
npx serve .
# or
python3 -m http.server 8080
```

Open the served URL on your phone/laptop browser. QR scanning needs camera
access, which most browsers only grant on `https://` or `localhost` — use
`localhost` for local testing.

## 5. Building the Android APK

### Option A — GitHub Actions (recommended, free, no local Android setup)

1. Push this repository to GitHub.
2. Go to **Actions → Build Android APK → Run workflow** (or just push to
   `main` — it runs automatically).
3. When it finishes, download the APK from the workflow run's **Artifacts**
   section, or, if you pushed a git tag (e.g. `v1.0.0`), from the created
   **Release**.
4. Install the APK on an Android phone (enable "Install unknown apps" for
   your browser/file manager first).

The workflow (`.github/workflows/build-apk.yml`) does exactly what a human
would do locally: install deps, build the web assets, `npx cap add android`
(if you haven't committed an `android/` folder yourself), `npx cap sync`,
then `./gradlew assembleDebug`.

**To enable camera permission for QR scanning**, run `npx cap add android`
once locally, add this line to `android/app/src/main/AndroidManifest.xml`
inside the `<manifest>` tag:

```xml
<uses-permission android:name="android.permission.CAMERA" />
```

then commit the `android/` folder. (If you don't commit it, the workflow
generates a fresh one on every run using Capacitor's defaults, which does
**not** include the camera permission — the app still works, it'll just
fall back to the "Open Machine List" button instead of the live scanner.)

### Option B — Build locally

Requires Node.js 20+, a JDK 17, and the Android SDK.

```bash
npm install
npm run build              # assembles ./www
npx cap add android         # first time only
npx cap sync android
cd android && ./gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```

## 6. Security model

**Default (localStorage) mode.** All authorization logic lives in
`src/js/db.js`, in one place, and every screen calls into it rather than
deciding on its own whether an action is allowed. This means:

- An operator cannot report a problem on a machine assigned to someone else
  — `db.js` checks the *current* assignment record, not whatever the UI
  happens to be showing.
- Admin-only functions (`addUser`, `addMachine`, role changes, ...) throw an
  `AuthError` if called by anyone but an Admin, even if invoked directly
  from the browser console.
- The audit log has no delete/update function anywhere in the codebase —
  it is structurally append-only.

**What this does *not* do:** because `localStorage` lives entirely on the
device, a technically sophisticated user could still edit it directly in
browser devtools on *their own phone* to give themselves a different role.
This is the correct trade-off for a free, zero-setup pilot on a single
device or a small trusted team, but **it is not a substitute for
server-side enforcement in a real multi-device rollout.**

**Moving to a real backend.** `firestore.rules` in this repo mirrors the
exact same rules as `db.js` (assignment checks, role checks, append-only
audit log) enforced server-side by Firestore. To switch:

1. Create a Firebase project (free Spark plan is enough for a factory pilot).
2. `firebase deploy --only firestore:rules` using the provided
   `firestore.rules`.
3. Replace the bodies of the functions in `src/js/db.js` with calls to the
   Firebase SDK (Auth for login, Firestore for reads/writes) — the function
   *signatures* (`reportProblem(user, machineId, ...)` etc.) are designed
   to stay the same so the screens in `src/screens/*.js` don't need to change.
4. Never put a Firebase service-account key or admin secret in this repo —
   only the public web SDK config, which is safe to ship in a client app
   *because* the security rules (not the client) are what actually enforce
   permissions.

## 7. Database structure

Collections/records (used as-is by the localStorage layer; the same shape
Firestore documents should use if you migrate):

- **users**: `id, name, pin, role, shift, active`
- **machines**: `id, model, order, status, activeRecordId`
- **machineAssignments**: `{ [shift]: { [machineId]: operatorId } }`
- **problemCategories**: `id, label, icon, items[]`
- **downtimeRecords**: `id, machineId, reportedBy, operatorId, problemCategory, problemType, reportedAt, workStartedAt, workStartedBy, resolvedAt, resolvedBy, downtimeMinutes, status, resolution, notes, shift`
- **auditLogs**: `id, timestamp, userId, userName, machineId, action, details` (append-only)

## 8. Creating machines & operators (Admin Panel)

Log in as `ADMIN1` / `0000` → **More → Admin Panel**:

- **Users tab**: add an operator/technician/supervisor/admin with an ID, name,
  PIN, role and shift. Disable (don't delete) users who leave.
- **Machines tab**: add a machine ID, model, and current order.
- **Assignments tab**: pick a shift, then assign an operator to each machine
  for that shift. This is the record `db.js` checks before letting an
  operator touch a machine.
- **Categories tab**: add new problem types under any of the 11 built-in
  categories (Technical, Yarn/Lycra, Quality, Setting, Maintenance, Power,
  Material, Production, Manpower, Factory/Management, Emergency).

## 9. QR codes for machines

Each machine's QR code should simply encode its **machine ID as plain text**
(e.g. `K-101`) — print one per machine and stick it on the frame. The in-app
scanner (**Floor → 📷 Scan**) reads it and jumps straight to that machine's
detail screen, running the same authorization check as tapping it from the
list.

## 10. Project structure

```
/
├── index.html
├── package.json
├── capacitor.config.ts
├── firestore.rules
├── scripts/build.js        # assembles ./www for Capacitor
├── src/
│   ├── css/styles.css
│   ├── js/                 # data layer, auth, categories, router, ui helpers
│   └── screens/            # one file per screen
├── .github/workflows/build-apk.yml
└── README.md
```
