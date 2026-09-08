# AGENTS Context File

## Project Overview
- Name: Badminton Tracker
- Stack: Angular frontend talking directly to Firebase Firestore + Firebase Authentication (cloud). **Members are the users** — no public sign-up. Every member is pre-provisioned a login (username = `members[].username`, default password = the same username, forced change on first sign-in) via an Admin SDK script; email is optional/informational only. Everyone signed in can view everything; only the owner-promoted `editor`/`owner` roles can write. See README ACCESS MODEL.
- Primary data store: a single Firestore document, `trackerData/main` (originally seeded from badminton_data.json), plus three supporting collections: `roles/{uid}` (access control), `usernames/{username}` (login lookup: `{memberId, uid}`, public-read, write:false — only ever written by the Admin SDK), and `auditLog/{autoId}` (who changed what, when)
- Entry points:
  - badminton-angular/src/app/tracker-data.service.ts (trackerData + auditLog read/write — onSnapshot for realtime, setDoc to save, addDoc to log)
  - badminton-angular/src/app/auth.service.ts (username/password login via a synthetic email, live `role`/`username`/`mustChangePassword` from `roles/{uid}`, `canEdit`/`isOwner` getters, role management for the Access tab, forced password change)
  - badminton-angular/src/app/firebase.config.json (Firebase project config — not secret)
  - scripts/provision-member-accounts.js (Admin SDK — creates the Firebase Auth account + roles + usernames doc for each member; idempotent)
  - firestore.rules (server-side access control — source of truth, paste into Firebase Console)
  - serviceAccountKey.json (Admin SDK credentials — gitignored, NEVER commit; required by the two provisioning/seed scripts, not by the Angular app itself)
- There is no backend process at all — no local server, no Cloud Functions. The Angular app talks to Firestore/Auth directly from the browser; the only Node.js usage is the Angular CLI build tooling and the two one-off Admin SDK scripts above (which must run in Node, never in a browser).

## Data Model
The `trackerData/main` Firestore document (originally seeded from badminton_data.json, now the live source of truth) is id-based (members are identified
by a numeric id, not by name) and is shaped as:
- members: array of { id: number, name: string, username: string } — `username` is unique, single-word (auto-generated from `name`, padded to >= 6 chars since it doubles as the default first-login password), and stable even if `name` changes
- sessions: array of
  - id: number
  - date: string
  - cost: number
  - payments: array of { memberId: number, amount: number }
  - notes: string
- attendance: object keyed by session id, value is number[] member ids
- duesPayments: optional array of
  - id: number
  - fromId: number
  - toId: number
  - amount: number
  - date: string (usually yyyy-mm-dd)
  - note: string
- nextId: number (session/dues id counter)
- nextMemberId: number (member id counter)

## Behavioral Rules
- Every mutation in `TrackerStoreService` calls `persistData()`, which writes the *entire* `TrackerData` object back to `trackerData/main` via `setDoc` (not a partial/field update — same all-or-nothing shape as the old POST /data), then writes one `auditLog` entry (uid, username, action, timestamp) reusing the same success-message string shown in the toast.
- `loadData()` uses `onSnapshot`, so `this.data` in the store updates live on any remote change (another tab/device, or the echo of the app's own write) — not just once at startup.
- `TrackerStoreService.canEdit` proxies `AuthService.canEdit` (true for `editor`/`owner` roles). Every tab template gates its mutation-triggering controls (add/edit/delete buttons, attendance toggle, chip remove, etc.) behind `*ngIf="store.canEdit"` or `[disabled]="!store.canEdit"` — but this is UI-level defense-in-depth only; the real boundary is `firestore.rules`.
- Session cost is derived from payment row totals in add/edit session forms.
- Balance formula per member:
  - balance = sessionPaid - shareOwed + duesPaid - duesReceived
- Member rename only edits members[].name in place — `username` never changes on rename (it's the stable login identifier); every other
  record references the member's id anyway, so nothing else needs updating.
- `TrackerStoreService.addMember()` generates a `username` client-side (same slugify-and-pad algorithm as `scripts/add-member-usernames.js`) but does **not** create a login account — that needs Admin SDK privileges the browser doesn't have. The owner must re-run `npm run provision-accounts` afterward, which reads the live roster from `trackerData/main` (not the local `badminton_data.json`, which goes stale after the initial seed).
- Roles: `roles/{uid}` → `{ username, memberId, role: 'viewer'|'editor'|'owner', mustChangePassword, contactEmail?, createdAt }`. Accounts/roles docs are created ONLY by `scripts/provision-member-accounts.js` (Admin SDK, bypasses rules) — the client can never create or delete a roles doc. A signed-in user can update their OWN doc but only to clear `mustChangePassword`/set `contactEmail` (rules-enforced field-equality check prevents touching `role`/`username`/`memberId`). Only `role:'owner'` can change anyone's `role` (promotion via the in-app Access tab). There is exactly one owner, bootstrapped manually in the Firebase Console (see README FIRESTORE SETUP) — never build a way to self-grant or app-side-grant owner.
- Login: `AuthService.login(username, password)` looks up `usernames/{username}` (public read, to work pre-auth) for the linked uid, then signs in via `signInWithEmailAndPassword` using a synthetic email (`${username}@members.badminton-tracker.local` — this domain string must stay in sync between `auth.service.ts` and `scripts/provision-member-accounts.js`). No self-serve sign-up path exists in the app at all.

## Development Notes
- Run locally with: npm run dev (Angular dev server only; no backend process)
- Firestore project config lives in badminton-angular/src/app/firebase.config.json (not secret)
- Admin SDK service account key lives at serviceAccountKey.json (repo root, gitignored, NEVER commit — grants full project access)
- Access-control rules live in firestore.rules (repo root) — the Firebase Console copy must be kept in sync manually (no automated deploy from this session)
- To provision a login for every member (idempotent, safe to re-run for new members): npm run provision-accounts
- To seed Firestore from badminton_data.json (destructive, run once — also writes the "Historical data import" audit entry): npm run seed-firestore
- Hosting: firebase.json + .firebaserc (project id placeholder until a real Firebase project exists); npm run build in badminton-angular then `firebase deploy --only hosting`
- Prefer feature changes in badminton-angular/src — the root is just Admin SDK scripts + config now, no app code lives there.
