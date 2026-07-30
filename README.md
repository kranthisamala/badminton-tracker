🏸 BADMINTON TRACKER
====================

HOW TO RUN
----------
Angular frontend + Node.js API backend

1. Make sure Node.js 18+ is installed.

2. Open a terminal in this folder and run one command to start both backend and Angular frontend:

  npm run dev

  This starts:
  - Node API at http://localhost:5000
  - Angular dev server on an available local port (starts searching from 4300)

3. Open the Angular URL shown in terminal output.

4. Press Ctrl+C in the same terminal to stop both processes.

BACKEND ONLY
------------
If you only want the Node backend, run:

  node server.js

Then call http://localhost:5000/data from clients.



FILES
-----
  badminton-angular/    ← Angular application
  server.js             ← Node API backend (/data)
  badminton_data.json   ← persistent data store
  scripts/start-all.js  ← starts backend + Angular dev server together


SHARING DATA WITH THE TEAM
---------------------------
To share the latest records:
  → Zip the whole folder and send it.
  → The recipient runs npm run dev and sees all the same data.

The data file (badminton_data.json) is plain text — you can open it in any
text editor to inspect or back it up.


NOTES
-----
- The server only listens on localhost (your own machine), so it's not
  accessible from other computers on the network.
- No internet connection required after first load.
- The JSON schema in badminton_data.json remains unchanged.
