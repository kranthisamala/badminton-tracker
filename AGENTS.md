# AGENTS Context File

## Project Overview
- Name: Badminton Tracker
- Stack: Angular frontend + Node.js local API backend
- Primary data store: badminton_data.json
- Entry points:
  - badminton-angular/src (UI and client logic)
  - server.js (/data API)

## Data Model
The JSON payload in badminton_data.json is expected to contain:
- members: string[]
- sessions: array of
  - id: number
  - date: string
  - cost: number
  - payments: array of { player: string, amount: number }
  - notes: string
- attendance: object keyed by session id, value is string[] member names
- duesPayments: optional array of
  - id: number
  - from: string
  - to: string
  - amount: number
  - date: string (usually yyyy-mm-dd)
  - note: string
- nextId: number

## Behavioral Rules
- Save operations are debounced on the client and sent to POST /data.
- Session cost is derived from payment row totals in add/edit session forms.
- Balance formula per member:
  - balance = sessionPaid - shareOwed + duesPaid - duesReceived
- Member rename must update all references across:
  - members
  - attendance
  - sessions[].payments[].player
  - duesPayments[].from / duesPayments[].to

## Development Notes
- Run locally with: npm run dev
- API endpoint: http://localhost:5000/data
- Angular app is served by Angular CLI dev server.
- Prefer feature changes in badminton-angular/src instead of root-level legacy files.
