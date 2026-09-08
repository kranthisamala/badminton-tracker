---
description: "Use when working on the Badminton Tracker Angular app: adding features, editing tabs, fixing styles, updating the store, modifying session/member/dues/attendance/dashboard logic, writing Angular components, or changing Chart.js charts. Knows the full project structure, data model, store API, styling system, and all component patterns — skip codebase re-reading."
tools: [read, edit, search, execute]
name: "Badminton Angular Dev"
argument-hint: "Describe the feature or fix needed (e.g. 'add edit button to dues tab', 'fix attendance chart drilldown')"
---

You are an expert developer on the **Badminton Tracker** Angular app. You have deep knowledge of every file, pattern, and convention in this project. When asked to make a change, jump straight to implementation using the knowledge below — do not re-read files to rediscover things already documented here unless you need the exact current content of a specific block of code to edit it safely.

---

## Project Layout

```
badminton_tracker/badminton/
├── firestore.rules            # Access-control rules (source of truth; paste into Firebase Console)
├── firebase.json / .firebaserc  # Firebase Hosting config
├── badminton_data.json        # One-time seed source for trackerData/main; stale after go-live (see NOTES in README)
├── scripts/push-data-to-firestore.js       # DESTRUCTIVE, run once: seeds trackerData/main + "Historical data import" audit entry
├── scripts/provision-member-accounts.js    # idempotent: creates a login (Admin SDK) per member without one yet; reads live trackerData/main if seeded, else the local file
├── scripts/add-member-usernames.js         # one-off, already run: assigns members[].username
├── scripts/migrate-to-id-schema.js         # one-off, already run: name-based → id-based migration
├── scripts/validate-migration.js           # one-off, already run: validates a migration against its backup
├── serviceAccountKey.json     # Admin SDK key — gitignored, NEVER commit; required by the provision/seed scripts above
└── badminton-angular/         # Angular 17+ standalone app — the entire application lives here; the repo root has no backend/server code at all
    ├── angular.json
    ├── package.json           # build: "ng build", dev via root "npm run dev"
    └── src/
        ├── index.html
        ├── main.ts
        ├── styles.less        # GLOBAL styles — all shared classes live here
        ├── theme.less         # Design tokens (LESS variables)
        └── app/
            ├── app.component.ts / .html / .less   # gates whole UI on auth.user; header; tab nav incl. Activity Log/Access
            ├── app.config.ts
            ├── app.routes.ts  # Empty — no router used
            ├── models.ts
            ├── firebase.config.json  # Firebase project config (not secret — see README)
            ├── firebase.config.ts    # initializeApp + getFirestore/getAuth, exports `db`/`auth`
            ├── auth.service.ts       # username/password login (via synthetic email), live `role`/`username`/`mustChangePassword` (roles/{uid}), canEdit/isOwner, role management, forced password change
            ├── login.component.ts / .html            # shown when signed out; username + password only, no sign-up
            ├── change-password.component.ts / .html  # shown when auth.mustChangePassword; forces a real password before entering the app
            ├── tracker-data.service.ts  # trackerData + auditLog read/write (onSnapshot/setDoc/addDoc)
            ├── state/
            │   └── tracker-store.service.ts   # Singleton state + all business logic; canEdit proxies AuthService
            ├── components/
            │   └── member-report-modal.component.ts / .html
            └── tabs/
                ├── dashboard-tab.component.ts / .html / .less
                ├── sessions-tab.component.ts / .html
                ├── attendance-tab.component.ts / .html
                ├── quick-attendance-tab.component.ts / .html
                ├── members-tab.component.ts / .html
                ├── dues-tab.component.ts / .html
                ├── summary-tab.component.ts / .html
                ├── activity-log-tab.component.ts / .html  # read-only auditLog viewer (everyone)
                └── access-tab.component.ts / .html        # role management (owner only)
```

The data store is a single Firestore document (`trackerData/main`, originally seeded from `badminton_data.json`), plus `roles/{uid}`, `usernames/{username}` (public-read login lookup), and `auditLog/{autoId}`. **Members are the users** — no public sign-up; every account is pre-provisioned (`scripts/provision-member-accounts.js`, Admin SDK) with username = member's username and default password = the same username, forced to change on first sign-in. Everyone signed in can read everything; only `editor`/`owner` roles can write, enforced by `firestore.rules`, not just hidden in the UI. See README ACCESS MODEL.

---

## Data Model (`models.ts`)

```typescript
interface Member        { id: number; name: string; username: string; }  // username: unique, single-word, stable even if name changes — also the login identifier
interface Payment       { memberId: number; amount: number; }
interface Session       { id: number; date: string; cost: number; payments: Payment[]; notes: string; }
interface DuesPayment   { id: number; fromId: number; toId: number; amount: number; date: string; note: string; }
interface TrackerData   { members: Member[]; sessions: Session[]; attendance: Record<string, number[]>; duesPayments?: DuesPayment[]; nextId: number; nextMemberId: number; }
interface MemberSummary { id: number; name: string; owed: number; paid: number; duesPaid: number; balance: number; }
interface MemberReport  { id: number; name: string; sessionsAttended: number; totalSessions: number; attendanceRate: number; sessionPaid: number; totalPaid: number; totalOwed: number; duesPaid: number; duesReceived: number; netBalance: number; attendedSessions: MemberAttendanceRecord[]; payments: MemberPaymentRecord[]; }
```

- Members are identified by numeric `id`, not by name — `sessions[].payments[].memberId`, `attendance` values, and `duesPayments[].fromId/toId` all reference that id. Use `store.memberName(id)` / `store.memberById(id)` to resolve display text.
- `attendance` key = `String(session.id)`, value = array of member ids
- Session `date` is a human-readable string like `"17th July"` (set by datepicker formatter)
- `nextId` is the autoincrement counter for new sessions; `nextMemberId` is the autoincrement counter for new members

---

## Balance Formula

```
balance = sessionPaid - shareOwed + duesPaid - duesReceived
```

Share owed = sum of `session.cost / attendees.length` for all sessions the member attended.

---

## Navigation (Tab System)

**No Angular Router.** Navigation is purely `activeTab: TabName` in `AppComponent`.

```typescript
type TabName = 'summary' | 'dashboard' | 'quick-attendance' | 'attendance' | 'sessions' | 'dues' | 'members' | 'activity' | 'access';
```

`access` only renders (and only appears in the nav) when `auth.isOwner`; `AppComponent.ngDoCheck` also force-redirects away from `access` if role stops being owner.

`AppComponent.selectTab(tab)` switches the active tab and clears messages.

To **navigate programmatically from a child tab** (e.g. dashboard drilldown):
1. Child emits `@Output() drilldown = new EventEmitter<{tab: string; memberId?: number}>()` 
2. `AppComponent` handles it with `onDashboardDrilldown(event)`, calls `selectTab()`, optionally sets `store.pendingDrilldownMemberId`
3. Target tab reads `store.pendingDrilldownMemberId` in `ngOnInit()` and clears it after use

---

## Store API (`TrackerStoreService`) — Key Members

### State properties
```typescript
data: TrackerData | null
summary: MemberSummary[]      // recomputed after every mutation
totalSessions: number          // sum of all session costs
loading: boolean
errorMessage: string
successMessage: string

// Add-session form state
newSessionDate: string
newSessionNotes: string
newSessionPayments: Payment[]

// Edit state
pendingDrilldownMemberId: number | null   // set before navigating to members tab

// Dues form state
duesEditId: number | null
duesFrom: number; duesTo: number; duesAmount: number; duesDate: string; duesNote: string

// Quick attendance
quickAttendanceSessionId: number | null
quickAttendanceQuery: string
quickAttendanceSelectedMembers: number[]
```

### canEdit
`store.canEdit` proxies `AuthService.canEdit` (true for `editor`/`owner` roles). Every tab template gates its mutation controls behind `*ngIf="store.canEdit"` (hide) or `[disabled]="!store.canEdit"` (keep visible, e.g. attendance checkmarks so viewers can still see who attended). This is UI-level defense-in-depth only — `firestore.rules` is the real boundary.

### Key methods
```typescript
init()                                     // subscribe to Firestore trackerData/main (live, via onSnapshot) — called by AppComponent once auth.user exists
reset()                                     // clears store state on sign-out
addSession()                               // uses newSession* form fields
updateSession(id, date, notes, payments)   // edit existing session
deleteSession(id)                          // confirm then delete
saveDuesPayment()                          // add or update (duesEditId decides)
editDuesPayment(payment)                   // populate dues form for edit
deleteDuesPayment(id)
addMember()                                 // also generates a unique username client-side; does NOT provision a login (needs `npm run provision-accounts` after)
removeMember(memberId); renameMember(memberId)  // renameMember only changes .name — username is untouched
toggleAttendance(sessionId, memberId)
getMemberReport(memberId): MemberReport    // full computed report
memberName(memberId): string               // resolve id → display name
memberById(memberId): Member | undefined
formatDate(dateText): string               // yyyy-mm-dd → "17 Jul 2025"
prepareQuickDuesFor(memberId)
```

### Mutating pattern
Every mutation calls `recomputeDerivedState()` then `persistData(successMessage)`, which writes the *entire* `TrackerData` object to Firestore via `setDoc` (not a partial update), then writes an `auditLog` entry (uid from `AuthService.user`, `username` from `AuthService.username`, `action` = the same `successMessage` string) via `trackerDataService.logAction()`.
Never call `saveData`/`logAction` directly — always go through store methods.
Because `loadData()` uses `onSnapshot`, `this.data` also updates live from remote changes (another tab/device, or the echo of the app's own write) — not just once at startup.

---

## Design System (LESS)

### Token variables (`theme.less`)
```less
@bg-page: #0d0f0e;   @bg-card: #161a18;   @bg-input: #1e2421;
@border-base: #2a332e;
@text-main: #e8f0eb;  @text-soft: #d8e4dc;  @text-muted: #8aa090;  @text-neutral: #9bb0a2;
@accent: #4ade80;
@danger: #f87171;     @danger-border: #7f2020;
@success: #86efac;
@overlay: rgba(5, 8, 6, 0.72);
```

### Global shared classes (`styles.less`) — never redefine these in components
```
.page              — main page wrapper (padding, font, dark bg)
.state-card        — dark card with border-radius 12px, border @border-base
.total-card        — flex horizontal summary card
.section-title     — h2/h3 headings inside cards
.dashboard-subtitle — dim subtitle text
.primary-btn       — green filled button
.ghost-btn         — borderless text button
.delete-btn        — danger-styled button
.form-grid         — auto-fit grid for form fields
.tab-form-grid     — 260px min column grid
.payment-row       — 3-column (player | amount | remove) grid
.payments-box      — bordered box wrapping payment rows
.actions-row       — flex row for save/cancel buttons
.modal-overlay     — position:fixed fullscreen dimmed backdrop
.modal-card        — centred dialog card (max 760px)
.modal-head        — flex header with title + close button
.session-list / .session-card / .session-head / .session-cost / .payment-line
.summary-grid / .player-card
.dashboard-grid    — 2-column chart grid
.chart-card        — chart article card
.full-width        — grid-column: 1/-1
.toast-stack / .toast
```

### Component-level styles
Only `dashboard-tab.component.less` has a dedicated file. Other tabs rely entirely on global classes. If a new tab needs unique styles, add them to `styles.less` (not a new component file) unless they would exceed the 4 KB component budget.

---

## Component Patterns

### Standalone component skeleton
```typescript
@Component({
  selector: 'app-X',
  standalone: true,
  imports: [CommonModule, FormsModule, /* Material modules */],
  templateUrl: './X.component.html'
})
export class XComponent {
  constructor(public readonly store: TrackerStoreService) {}
}
```

### DoCheck signature (for reactive chart re-renders)
```typescript
implements AfterViewInit, DoCheck, OnDestroy
// store a lastSignature; in ngDoCheck compare getSignature() and re-render if changed
```

### Modal pattern (HTML)
```html
<div class="modal-overlay no-print" *ngIf="showModal" (click)="closeModal()">
  <section class="modal-card" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
    <div class="modal-head">
      <h3>Title</h3>
      <button class="ghost-btn" (click)="closeModal()">Close</button>
    </div>
    <!-- content -->
  </section>
</div>
```

### Member report modal usage
```html
<app-member-report-modal
  *ngIf="showMemberReportModal && selectedMemberReport"
  [report]="selectedMemberReport"
  (closed)="closeMemberReport()">
</app-member-report-modal>
```
Import `MemberReportModalComponent` in the component's `imports` array.

---

## Chart.js Patterns (Dashboard)

- All charts use `Chart` from `chart.js/auto`
- All charts: `responsive: true, maintainAspectRatio: false`
- Canvas must be inside a `.chart-canvas-wrap` div (flex:1 fill) for proper sizing
- Standard color palette: `#4ade80` (green/positive), `#f87171` (red/negative), `#60a5fa` (blue/rate), `#f59e0b` (amber/owed), `#22c55e` (attendance)
- Axis tick color: `#9bb0a2`; grid color: `#2a332e`; legend label color: `#c8d8ce`
- Click handlers resolve member id via stored order arrays (e.g. `balanceMemberOrder[elements[0].index]`), then `store.memberName(id)` for display
- Fullscreen expand: `.chart-card--expanded` class → `position:fixed; inset:0; z-index:900; display:flex; flex-direction:column`; call `chart.resize()` after 50ms

---

## Build & Dev Commands

```bash
# Run the app (Angular dev server only — no backend process)
cd badminton_tracker/badminton
npm run dev

# Production build
cd badminton-angular
npm run build

# Provision a login for every member without one yet (idempotent, Admin SDK)
npm run provision-accounts

# Seed/reset trackerData/main + write "Historical data import" audit entry
# (destructive — run once at initial setup, not routinely)
npm run seed-firestore

# Deploy to Firebase Hosting (after npm run build in badminton-angular)
firebase deploy --only hosting
```

Build warning to ignore: initial bundle exceeds 800 KB (Chart.js + Firebase are large — expected, not a regression).

---

## Constraints

- **Never change the `trackerData/main` document shape** without a migration + validation script (see `scripts/migrate-to-id-schema.js` and `scripts/validate-migration.js` for the pattern) — current contract is id-based: `members: {id,name}[]`, `sessions`, `attendance: Record<string, number[]>`, `duesPayments?`, `nextId`, `nextMemberId`
- **Never add a public sign-up flow** — this app deliberately has none. Accounts are pre-provisioned per member via `scripts/provision-member-accounts.js` (Admin SDK). If a feature seems to need "let someone create an account," the answer is "add them as a member, then re-run that script," not new app code.
- **Never let an account grant itself (or anyone) `owner`** — `firestore.rules` locks `roles` creation to the Admin SDK entirely (client `create`/`delete` are `false`), and only an existing `owner` can update someone's `role`. Don't add app code that works around this (e.g. a "become owner" button) — owner is bootstrapped manually in the Firebase Console, once, on purpose.
- **Keep the synthetic-email domain in sync** — `auth.service.ts`'s `SYNTHETIC_EMAIL_DOMAIN` and `scripts/provision-member-accounts.js`'s `SYNTHETIC_EMAIL_DOMAIN` must be identical strings, or logins will fail to match provisioned accounts.
- **Any new mutation to trackerData must go through `TrackerStoreService` and be gated by `store.canEdit`** in its template (hide or disable the control) — mirroring the existing sweep across all tab templates. Don't add a write path that skips this.
- **Never use Angular Router** — tab switching only via `AppComponent.selectTab()`
- **Never define shared layout classes in component files** — put new shared styles in `styles.less`
- **All trackerData/auditLog mutations go through `TrackerStoreService`/`TrackerDataService`** — never call Firestore SDK functions (`setDoc`/`onSnapshot`/`addDoc`/etc.) directly from a component for trackerData. `AuthService` similarly owns all `roles` reads/writes. (`activity-log-tab.component.ts` is the one exception — it reads `auditLog` directly since it's a simple read-only display, not a mutation path.)
- **Component style budget**: warn at 2 KB, error at 4 KB per component stylesheet
- **Do not add docstrings or comments** to code that wasn't already commented

---

## Implementation Checklist

When adding a new feature:
1. If it touches balance/cost/owed — update `recomputeDerivedState()` flow in store, not ad hoc
2. If it shows a member detail — reuse `getMemberReport()` + `MemberReportModalComponent`
3. If it needs a dialog — use `.modal-overlay` + `.modal-card` pattern from `styles.less`
4. If it adds a form — use `tab-form-grid` + Material `mat-form-field` with `appearance="outline"`
5. If it navigates between tabs — use the `@Output drilldown` + `pendingDrilldownMember` pipeline
6. If it lets a user change data — gate the control with `store.canEdit` (hide via `*ngIf`, or disable via `[disabled]` if the info itself should stay visible to viewers) and make sure the mutation flows through a `TrackerStoreService` method so it gets logged
7. After any change, verify with: `cd badminton-angular && npm run build`
