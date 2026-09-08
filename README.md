🏸 BADMINTON TRACKER
====================

Angular app backed by Firebase Firestore (cloud, NoSQL) — no backend server
to run. Members ARE the users: every member gets a login (username +
password, no email required), pre-provisioned by the owner. Everyone can
view everything; only people the owner promotes to editor can make changes.
Every change is logged with who made it. See ACCESS MODEL below.

QUICK START
-----------

Prerequisites: Node.js 18+, npm, and a Firebase project (see FIRESTORE SETUP
below if you don't have one yet).

1. Clone the repo and move into it:

  git clone https://github.com/kranthisamala/badminton-tracker.git
  cd badminton-tracker

2. Install dependencies (one-time, or whenever package.json changes):

  npm install --prefix badminton-angular
  npm install

3. Complete FIRESTORE SETUP below (one-time per Firebase project).

4. Start the Angular dev server, run from the repo root:

  npm run dev

  The terminal will print the local URL, e.g.:

  ➜  Local:   http://localhost:4300/

5. Open that URL and sign in with your username (default password is your
   username — see ACCESS MODEL). Press Ctrl+C to stop.

FIRESTORE SETUP (one-time, per Firebase project)
--------------------------------------------------
1. https://console.firebase.google.com → Add project → Create.
2. Authentication → Sign-in method → enable **Email/Password** (used
   internally — members never see or type an email; see ACCESS MODEL).
3. Build → Firestore Database → Create database → production mode.
4. Firestore Database → Rules tab → paste the contents of `firestore.rules`
   (kept in this repo as the source of truth) → Publish.
5. Project Settings → General → "Your apps" → Add app → Web (</>) →
   register → copy the shown config values into
   `badminton-angular/src/app/firebase.config.json`.
6. Project Settings → Service Accounts → Generate new private key → save as
   `serviceAccountKey.json` in the repo root. This file grants full admin
   access to your project — it's already gitignored, **never commit it**.
7. Make sure `badminton_data.json`'s members each have a `username` (already
   true if you're using this repo's data — see `scripts/add-member-usernames.js`
   if you add members outside the app).
8. Provision a login account for every member:

  npm run provision-accounts

   This creates one Firebase Auth account per member (default password =
   their own username, forced change on first sign-in), plus their `roles`
   and `usernames` records. Safe to re-run later for newly added members —
   it skips anyone already provisioned.
9. Pick one member to be the **owner** (usually yourself). Firebase Console
   → Firestore Database → Data → `roles` collection → their document → edit
   `role` from `viewer` to `owner`. Nobody can do this from inside the app —
   that's intentional, see ACCESS MODEL.
10. Seed `trackerData/main` from the current `badminton_data.json` and
    record the "Historical data import" audit entry (attributed to the
    owner from step 9 — override the username via `OWNER_USERNAME` if it's
    not "kranthi"):

  npm run seed-firestore

ACCESS MODEL
------------
- **Members are the users** — there's no public sign-up. Every member in
  `badminton_data.json` gets a pre-provisioned login (step 8 above):
  username = `members[].username`, default password = the same username.
- **First sign-in**: enter your username as both username and password —
  you'll immediately be asked to set a real password (a contact email is
  optional, only used if you ever need... nothing yet; it's just stored for
  future reference, not required).
- Everyone lands as a **viewer**: can see every tab and every record, can't
  change anything.
- **Owner** (one person, bootstrapped manually in step 9) can promote any
  member's account to **editor** from the in-app **Access** tab, or demote
  it back to viewer. Only the owner can do this — nobody can grant
  themselves editor access.
- **Editor**: everything a viewer can do, plus add/edit/delete sessions,
  attendance, members, and dues payments.
- Every change (session/attendance/dues/member edit) is recorded in the
  in-app **Activity Log** tab (visible to everyone) with the username that
  made it and when. Data that existed before this access model shipped is
  attributed to the owner as a single "Historical data import" entry.
- This is enforced by `firestore.rules` server-side (not just hidden in the
  UI) — a signed-in viewer's browser cannot write to Firestore even if they
  bypass the app's UI.
- Adding a member via the in-app Members tab only adds them to the roster
  with an auto-generated username — it does **not** provision their login
  (that needs the Admin SDK, which the browser can't run). Re-run
  `npm run provision-accounts` afterward to create their account.

DEPLOYING TO FIREBASE HOSTING
-------------------------------
The app is a static Angular build, so hosting it is just:

  npm install -g firebase-tools   # one-time
  firebase login                  # one-time, opens a browser for your Google account
  # update the "default" project id in .firebaserc to your Firebase project id
  cd badminton-angular && npm run build && cd ..
  firebase deploy --only hosting

Firebase prints the hosted URL (`https://<project-id>.web.app`) — open that
from any device, no local server needed.

FILES
-----
  badminton-angular/                    ← Angular application
  badminton-angular/src/app/firebase.config.json
                                         ← your Firebase project config (not secret)
  serviceAccountKey.json                ← Admin SDK key (gitignored, NEVER commit — see FIRESTORE SETUP)
  firestore.rules                       ← access-control rules (source of truth; paste into console)
  firebase.json / .firebaserc           ← Firebase Hosting config
  badminton_data.json                   ← seed source for the two scripts below (see NOTES)
  backups/                              ← point-in-time data backups
  scripts/provision-member-accounts.js  ← creates a login account per member (idempotent)
  scripts/push-data-to-firestore.js     ← seeds Firestore from badminton_data.json (destructive, run once)
  scripts/add-member-usernames.js       ← one-off: assigns members[].username
  scripts/migrate-to-id-schema.js       ← one-off: name-based → id-based data migration
  scripts/validate-migration.js         ← checks a migrated data file against its backup

NOTES
-----
- Requires an internet connection (talks to Firestore/Auth directly; no
  local server involved).
- Members, sessions, attendance, and dues payments are id-based (each
  member has a numeric `id`; sessions/attendance/dues reference that id,
  not the member's name) — renaming a member is a single field edit.
- Each member also has a unique `username` (single word, derived from their
  name) used for login — separate from their display `name`, which can
  change freely without affecting their account.
- `badminton_data.json` is only the one-time seed source. Once
  `trackerData/main` exists in Firestore, `provision-member-accounts.js`
  reads the live roster from there instead (so members added later via the
  app get accounts too) — the local file goes stale after go-live and is
  kept mainly as a point-in-time record, not a source of truth.
