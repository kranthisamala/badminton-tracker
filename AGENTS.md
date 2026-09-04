# AGENTS Context File

## Project Overview
- Name: Badminton Tracker
- Stack: Angular frontend + Node.js local API backend
- Primary data store: badminton_data.json
- Entry points:
  - badminton-angular/src (UI and client logic)
  - server.js (/data API)

## Data Model
The JSON payload in badminton_data.json is id-based (members are identified
by a numeric id, not by name) and is expected to contain:
- members: array of { id: number, name: string }
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
- Save operations are debounced on the client and sent to POST /data.
- Session cost is derived from payment row totals in add/edit session forms.
- Balance formula per member:
  - balance = sessionPaid - shareOwed + duesPaid - duesReceived
- Member rename only edits members[].name in place — since every other
  record references the member's id, no other arrays need updating.

## Development Notes
- Run locally with: npm run dev
- API endpoint: http://localhost:5000/data
- Angular app is served by Angular CLI dev server.
- Prefer feature changes in badminton-angular/src instead of root-level legacy files.
