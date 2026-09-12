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

**Out of the box it runs single-device**, using the browser's `localStorage`
as the data store — zero setup, zero paid services. Turn on the optional
**Firebase real-time sync** (Section 6) to make every phone/PC see the same
machines and problems live, the moment anyone reports/starts/resolves one.

Every mutating action (report a problem, start work, resolve, assign an
operator, admin edits) goes through one file, `src/js/db.js`, which
re-checks the user's role and machine assignment *there* — not just by
hiding a button in the UI. See [Section 7, Security model](#7-security-model)
for exactly what that does and does not protect against.

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
- **Optional real-time multi-device sync** via Firebase (Section 6) — report
  on one phone, see it update live on every other phone/PC

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

## 6. Multi-device real-time sync + real login (Firebase)

By default every phone keeps its own local copy of the data, logged in with
a shared demo ID+PIN — great for trying the app, not something you'd want
live in a factory. Turning on Firebase makes two things happen together:

1. **Real accounts.** Login becomes email + password. Nobody can open the
   app and use it — there's no guest/anonymous access at all. Only people
   an Admin has explicitly created an account for can log in.
2. **Real-time sync.** Every phone/PC signed in sees the same machines and
   problems live, the moment anyone reports/starts/resolves one.

**সহজ ভাষায়:** এই সেটআপ শেষ হলে, অ্যাপে ঢুকতে হলে অবশ্যই ইমেইল+পাসওয়ার্ড
লাগবে — Admin না বানিয়ে দিলে কেউ লগইনই করতে পারবে না। আর একবার লগইন করলে,
একজনের রিপোর্ট করা সমস্যা সাথে সাথে অন্য সব ফোন/পিসিতেও দেখা যাবে।

### Step 1 — Create a Firebase project (free)
1. Go to <https://console.firebase.google.com> → **Add project** → give it
   any name → you can turn off Google Analytics → **Create project**.

### Step 2 — Turn on Firestore
1. In the left menu: **Build → Firestore Database → Create database**.
2. Choose **Start in production mode** → pick any region → **Enable**.

### Step 3 — Turn on Email/Password sign-in
1. Left menu: **Build → Authentication → Get started** (or open it if
   already started).
2. **Sign-in method** tab → **Add new provider** (or click **Email/Password**
   if it's already listed) → enable it → **Save**.
   (If you enabled **Anonymous** sign-in while following an earlier version
   of this guide, you can leave it or disable it — the app no longer uses
   it, so it's just unused, not a security problem either way.)

### Step 4 — Publish the security rules
1. **Firestore Database → Rules** tab.
2. Delete what's there, paste in the contents of `firestore.rules` from
   this repo, click **Publish**.

### Step 5 — Get your web app config
1. Project settings (gear icon, top left) → scroll to **Your apps** →
   click the **`</>`** (Web) icon → register an app (any nickname, no
   hosting needed) → pick **"Use script tag"** (not "Use npm") → copy the
   `firebaseConfig = { ... }` object.

### Step 6 — Paste it into the project
Open `src/js/firebase-config.js` and replace the placeholder values with
the ones you copied, e.g.:

```js
window.KDM_FIREBASE_CONFIG = {
  apiKey: 'AIzaSy...',
  authDomain: 'my-factory.firebaseapp.com',
  projectId: 'my-factory',
  storageBucket: 'my-factory.appspot.com',
  messagingSenderId: '123456789',
  appId: '1:123456789:web:abcdef'
};
```

### Step 7 — Create your first Admin account (one manual step, one time only)

The Admin Panel is what normally creates new logins — but the very first
Admin has to be created manually, since there's no Admin yet to click the
button. Do this once:

1. **Firebase Console → Authentication → Users tab → Add user.**
   Enter an email and password for yourself → **Add user**.
2. Copy the **User UID** shown for that new user (a long string like
   `aB3xY...`).
3. **Firestore Database → Data tab** → **Start collection** → Collection ID:
   `users` → **Document ID: paste the UID you copied** → add these fields:

   | Field | Type | Value |
   |---|---|---|
   | `name` | string | your name |
   | `role` | string | `ADMIN` |
   | `shift` | string | `General / Day Shift` |
   | `active` | boolean | `true` |
   | `email` | string | the email you used in step 1 |

   → **Save**.

That's it — log into the app with that email/password, and use **More →
Admin Panel → Users tab** to create every other Operator/Technician/
Supervisor/Admin account from now on (no more manual Console steps needed
for anyone after this).

Commit and push `firebase-config.js`, then rebuild the APK (Section 5) and
install it on **every** phone/PC that should share data — they all need to
be running a build with the same config.

**What this does and doesn't protect** — see
[Section 7, Security model](#7-security-model).

## 7. Security model

**Every build** (with or without Firebase) keeps all authorization logic in
one place: `src/js/db.js`. Every screen calls into it rather than deciding
on its own whether an action is allowed. This means:

- An operator cannot report a problem on a machine assigned to someone else
  — `db.js` checks the *current* assignment record, not whatever the UI
  happens to be showing.
- Admin-only functions (`addUser`, `addMachine`, role changes, ...) throw an
  `AuthError` if called by anyone but an Admin, even if invoked directly
  from the browser console.
- The audit log has no delete/update function anywhere in the codebase —
  it is structurally append-only, and (once Firebase is on) `firestore.rules`
  also blocks update/delete at the database level, not just in the app.

**Single-device (localStorage only) mode:** because the data lives entirely
on the device, a technically sophisticated user could edit it directly in
browser devtools on *their own phone* to give themselves a different role.
Fine for a free, zero-setup pilot on a small trusted team; not a substitute
for server-side enforcement.

**With Firebase on (real email/password accounts):** this is real
server-side enforcement. `firestore.rules` checks the signed-in user's
actual role and machine assignment (via `/users/{uid}` and
`/meta/assignments`, looked up server-side by their Firebase Auth UID) —
not just "is someone signed in". An operator's account literally cannot
write a downtime record for a machine that isn't assigned to them, an
Admin-only write is rejected by Firestore itself for anyone else, and
nobody can create their own account (`allow write: if isAdmin()` on
`/users/{userId}`) — account creation only happens through the Admin
Panel's "Add User" flow (or the one-time manual bootstrap in Step 7 above).
Passwords are never stored in Firestore; Firebase Authentication handles
those. Keep passwords reasonably strong and don't share the Admin account.

## 8. Database structure

Collections/records (same shape whether you're reading them from
`localStorage` or, once Section 6 is set up, from Firestore):

- **users**: `id, name, role, shift, active` — plus `pin` in local mode, or `email` in Firebase mode (passwords are never stored here; Firebase Authentication handles those)
- **machines**: `id, model, order, status, activeRecordId`
- **meta/assignments** (single doc): `{ [shift]: { [machineId]: operatorId } }`
- **meta/categories** (single doc): `{ list: [{ id, label, icon, items[] }] }`
- **downtimeRecords**: `id, machineId, reportedBy, operatorId, problemCategory, problemType, reportedAt, workStartedAt, workStartedBy, resolvedAt, resolvedBy, downtimeMinutes, status, resolution, notes, shift`
- **auditLogs**: `id, timestamp, userId, userName, machineId, action, details` (append-only)

## 9. Creating machines & operators (Admin Panel)

Log in as `ADMIN1` / `0000` → **More → Admin Panel**:

- **Users tab**: add an operator/technician/supervisor/admin. Without
  Firebase configured, this is an ID/PIN. With Firebase configured (Section 6),
  this creates a real login (email/password) — no separate Firebase Console
  step needed.
- **Machines tab**: add a machine ID, model, and current order.
- **Assignments tab**: pick a shift, then assign an operator to each machine
  for that shift. This is the record `db.js` checks before letting an
  operator touch a machine.
- **Categories tab**: add new problem types under any of the 11 built-in
  categories (Technical, Yarn/Lycra, Quality, Setting, Maintenance, Power,
  Material, Production, Manpower, Factory/Management, Emergency).

If Firebase sync is on, anything you add here appears on every other
device within a second or two.

## 10. QR codes for machines

Each machine's QR code should simply encode its **machine ID as plain text**
(e.g. `K-101`) — print one per machine and stick it on the frame. The in-app
scanner (**Floor → 📷 Scan**) reads it and jumps straight to that machine's
detail screen, running the same authorization check as tapping it from the
list.

## 11. Project structure

```
/
├── index.html
├── package.json
├── capacitor.config.ts
├── firestore.rules
├── scripts/build.js        # assembles ./www for Capacitor
├── src/
│   ├── css/styles.css
│   ├── js/
│   │   ├── firebase-config.js  # paste your Firebase web config here (Section 6)
│   │   ├── sync.js             # Firebase bridge — no-ops if not configured
│   │   ├── db.js               # data + authorization layer
│   │   ├── categories.js, seed-data.js, ui-helpers.js, app.js
│   └── screens/            # one file per screen
├── .github/workflows/build-apk.yml
└── README.md
```
