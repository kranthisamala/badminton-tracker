🏸 BADMINTON TRACKER
====================

Angular frontend + Node.js API backend, backed by a local JSON data file
(no database, no auth, no internet connection needed after first setup).

QUICK START
-----------

Prerequisites: Node.js 18+ and npm installed.

1. Clone the repo and move into it:

  git clone https://github.com/kranthisamala/badminton-tracker.git
  cd badminton-tracker

2. Install the Angular app's dependencies (one-time, or whenever
   badminton-angular/package.json changes):

  npm install --prefix badminton-angular

3. Start both the backend and the frontend with one command, run from the
   repo root:

  npm run dev

  This starts:
  - Node API at http://localhost:5000
  - Angular dev server on an available local port (starts searching from
    4300; if 4300 is busy it tries 4301, 4302, ...)

  The terminal will print the exact Angular URL to open, e.g.:

  Starting Angular dev server on port 4300
  ➜  Local:   http://localhost:4300/

4. Open that URL in your browser.

5. Press Ctrl+C in the same terminal to stop both processes.

RUNNING THE BACKEND ONLY
-------------------------
If you only want the Node API (no UI), run from the repo root:

  node server.js

Then call http://localhost:5000/data from clients.



FILES
-----
  badminton-angular/               ← Angular application
  server.js                        ← Node API backend (/data)
  badminton_data.json              ← persistent data store
  backups/                         ← point-in-time data backups
  scripts/start-all.js             ← starts backend + Angular dev server together
  scripts/migrate-to-id-schema.js  ← one-off: name-based → id-based data migration
  scripts/validate-migration.js    ← checks a migrated data file against its backup


SHARING DATA WITH THE TEAM
---------------------------
The repo (code + badminton_data.json) lives at
https://github.com/kranthisamala/badminton-tracker — pull the latest with
`git pull` to get the current records, and commit/push after making changes
you want to share.

The data file (badminton_data.json) is plain text — you can open it in any
text editor to inspect or back it up. `backups/` holds point-in-time copies
taken before structural changes to the data (see scripts/ for how they were
generated).


NOTES
-----
- The server only listens on localhost (your own machine), so it's not
  accessible from other computers on the network.
- No internet connection required after first load (only for git clone/pull).
- Members, sessions, attendance, and dues payments in badminton_data.json are
  id-based (each member has a numeric `id`; sessions/attendance/dues
  reference that id, not the member's name) — renaming a member no longer
  requires touching every record that mentions them.
