import { Injectable } from '@angular/core';
import { AuthService } from '../auth.service';
import { DuesPayment, Member, MemberReport, MemberSummary, Payment, Session, SessionCostEdit, Settlement, TrackerData } from '../models';
import { TrackerDataService } from '../tracker-data.service';

@Injectable({ providedIn: 'root' })
export class TrackerStoreService {
  data: TrackerData | null = null;
  summary: MemberSummary[] = [];
  totalSessions = 0;
  loading = true;
  errorMessage = '';
  successMessage = '';

  newSessionDate = '';
  newSessionNotes = '';
  newSessionPayments: Payment[] = [{ memberId: 0, amount: 0 }];
  newSessionTime = '';
  newSessionVenue = '';
  newSessionCourtFee: number | null = null;
  newSessionShuttleCount: number | null = null;
  newSessionShuttlePrice: number | null = null;
  newSessionAttendees: number[] = [];
  newSessionMemberQuery = '';
  // When true, addSession() only requires a date — cost, payments and
  // attendees are all filled in later. See calcSummary(): a session's cost
  // is excluded from every balance until it's finalized via updateSession().
  newSessionInProgress = false;

  duesEditId: number | null = null;
  duesFrom = 0;
  duesTo = 0;
  duesAmount = 0;
  duesDate = '';
  duesNote = '';

  newMemberName = '';

  pendingDrilldownMemberId: number | null = null;

  // The "+ New session" / "Record dues" popups are opened from the app shell
  // header, and dues editing opens the same popup from the Dues tab, so the
  // open/closed state lives here rather than in either component.
  showNewSessionModal = false;
  showRecordDuesModal = false;

  constructor(
    private readonly trackerDataService: TrackerDataService,
    private readonly authService: AuthService
  ) {}

  get canEdit(): boolean {
    return this.authService.canEdit;
  }

  // Group-wide stats for the dashboard's top stat row (mockup 1a) — finalized
  // sessions only, same rule as everywhere else a session's cost is counted.
  get doneSessionsCount(): number {
    return this.data?.sessions.filter(session => session.status !== 'in_progress').length || 0;
  }

  get totalShuttlesUsed(): number {
    return (this.data?.sessions || [])
      .filter(session => session.status !== 'in_progress')
      .reduce((sum, session) => sum + (session.shuttleCount || 0), 0);
  }

  get avgShuttlesPerSession(): number {
    return this.doneSessionsCount ? this.totalShuttlesUsed / this.doneSessionsCount : 0;
  }

  get totalUnsettled(): number {
    return this.summary
      .filter(member => member.balance < -0.5)
      .reduce((sum, member) => sum + Math.abs(member.balance), 0);
  }

  get unsettledMemberCount(): number {
    return this.summary.filter(member => Math.abs(member.balance) > 0.5).length;
  }

  get currentMember(): Member | undefined {
    const username = this.authService.username;
    if (!username || !this.data) return undefined;
    return this.data.members.find(member => member.username === username);
  }

  reset(): void {
    this.data = null;
    this.summary = [];
    this.totalSessions = 0;
    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';
  }

  init(): void {
    this.loading = true;
    this.errorMessage = '';
    this.trackerDataService.loadData().subscribe({
      next: data => {
        this.data = data;
        this.initializeUiDefaults();
        this.recomputeDerivedState();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.errorMessage = 'Unable to load data from Firestore. Check your Firebase config and that trackerData/main has been seeded.';
      }
    });
  }

  // Manual fallback for the rare case where even the automatic retry inside
  // TrackerDataService.loadData() is exhausted (e.g. a genuinely slow
  // connection) — re-attaches a fresh listener without needing a page reload.
  retryLoad(): void {
    this.init();
  }

  clearMessages(): void {
    this.errorMessage = '';
    this.successMessage = '';
  }

  memberById(id: number): Member | undefined {
    return this.data?.members.find(member => member.id === id);
  }

  memberName(id: number): string {
    return this.memberById(id)?.name || '';
  }

  get sessionCost(): number {
    return this.newSessionPayments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
  }

  get newSessionShuttleTotal(): number {
    return (Number(this.newSessionShuttleCount) || 0) * (Number(this.newSessionShuttlePrice) || 0);
  }

  get newSessionHasBreakdown(): boolean {
    return (Number(this.newSessionCourtFee) || 0) > 0 || this.newSessionShuttleTotal > 0;
  }

  // What the session actually cost. Falls back to the collected total when no
  // court-fee/shuttle breakdown was entered, matching how older sessions work.
  get newSessionCost(): number {
    if (!this.newSessionHasBreakdown) return this.sessionCost;
    return (Number(this.newSessionCourtFee) || 0) + this.newSessionShuttleTotal;
  }

  get newSessionPerHead(): number {
    if (!this.newSessionAttendees.length) return 0;
    return this.newSessionCost / this.newSessionAttendees.length;
  }

  get newSessionShortfall(): number {
    return this.newSessionCost - this.sessionCost;
  }

  get newSessionAttendeeMembers(): Member[] {
    if (!this.data) return [];
    return this.newSessionAttendees
      .map(id => this.memberById(id))
      .filter((member): member is Member => !!member);
  }

  get newSessionCandidateMembers(): Member[] {
    if (!this.data) return [];
    const query = this.newSessionMemberQuery.trim().toLowerCase();
    const picked = new Set(this.newSessionAttendees);
    return this.data.members.filter(
      member => !picked.has(member.id) && (!query || member.name.toLowerCase().includes(query))
    );
  }

  get lastSession(): Session | null {
    if (!this.data?.sessions.length) return null;
    return this.sortedSessions.find(session => session.status !== 'in_progress') || null;
  }

  // Sessions that have been started but not finalized — their cost is not
  // yet in anyone's balance (see calcSummary). Newest first.
  get inProgressSessions(): Session[] {
    return this.sortedSessions.filter(session => session.status === 'in_progress');
  }

  get nextSession(): Session | null {
    return this.inProgressSessions[0] || null;
  }

  attendeeMembers(sessionId: number): Member[] {
    if (!this.data) return [];
    return (this.data.attendance[String(sessionId)] || [])
      .map(id => this.memberById(id))
      .filter((member): member is Member => !!member);
  }

  get isOptedInToNextSession(): boolean {
    const session = this.nextSession;
    const member = this.currentMember;
    if (!session || !member) return false;
    return this.isPresent(session.id, member.id);
  }

  // Self-service attendance for a session that hasn't been finalized yet —
  // any signed-in member can opt themselves in or out. Editors keep using
  // toggleAttendance() (Attendance tab) for finalized sessions.
  optInSession(sessionId: number): void {
    if (!this.data) return;
    const session = this.data.sessions.find(s => s.id === sessionId);
    if (!session || session.status !== 'in_progress') return;
    const member = this.currentMember;
    if (!member) {
      this.errorMessage = 'Your account is not linked to a member.';
      return;
    }

    const key = String(sessionId);
    if (!this.data.attendance[key]) this.data.attendance[key] = [];
    if (this.data.attendance[key].includes(member.id)) return;

    this.data.attendance[key].push(member.id);
    this.recomputeDerivedState();
    this.persistData("You're in for " + session.date + '.');
  }

  optOutSession(sessionId: number): void {
    if (!this.data) return;
    const session = this.data.sessions.find(s => s.id === sessionId);
    if (!session || session.status !== 'in_progress') return;
    const member = this.currentMember;
    if (!member) return;

    const key = String(sessionId);
    const arr = this.data.attendance[key] || [];
    if (!arr.includes(member.id)) return;

    this.data.attendance[key] = arr.filter(id => id !== member.id);
    this.recomputeDerivedState();
    this.persistData('Marked as not playing ' + session.date + '.');
  }

  addNewSessionAttendee(memberId: number): void {
    if (!this.newSessionAttendees.includes(memberId)) {
      this.newSessionAttendees = [...this.newSessionAttendees, memberId];
    }
    this.newSessionMemberQuery = '';
  }

  removeNewSessionAttendee(memberId: number): void {
    this.newSessionAttendees = this.newSessionAttendees.filter(id => id !== memberId);
  }

  selectAllNewSessionAttendees(): void {
    this.newSessionAttendees = (this.data?.members || []).map(member => member.id);
  }

  copyAttendeesFromLastSession(): void {
    const last = this.lastSession;
    if (!last || !this.data) {
      this.errorMessage = 'No previous session to copy from.';
      return;
    }
    const previous = this.data.attendance[String(last.id)] || [];
    if (!previous.length) {
      this.errorMessage = 'The last session has no attendance recorded.';
      return;
    }
    this.newSessionAttendees = previous.filter(id => !!this.memberById(id));
  }

  get sortedSessions(): Session[] {
    if (!this.data) return [];
    return [...this.data.sessions].sort((a, b) => b.id - a.id);
  }

  get duesRecords(): DuesPayment[] {
    if (!this.data) return [];
    return [...(this.data.duesPayments || [])].sort((a, b) => b.id - a.id);
  }

  addPaymentRow(): void {
    this.newSessionPayments.push({ memberId: this.data?.members[0]?.id || 0, amount: 0 });
  }

  removePaymentRow(index: number): void {
    if (this.newSessionPayments.length === 1) return;
    this.newSessionPayments.splice(index, 1);
  }

  addSession(): void {
    if (!this.data) return;

    const startingInProgress = this.newSessionInProgress;
    const date = this.newSessionDate.trim();
    const notes = this.newSessionNotes.trim();
    const payments = this.newSessionPayments
      .map(payment => ({ memberId: Number(payment.memberId), amount: Number(payment.amount) || 0 }))
      .filter(payment => payment.memberId && payment.amount > 0);

    const cost = this.newSessionCost;
    const attendees = this.newSessionAttendees.filter(memberId => !!this.memberById(memberId));

    if (!date) {
      this.errorMessage = 'Please pick a session date.';
      return;
    }

    // Starting a session in progress: only the date is required — cost,
    // payments and attendees are all filled in later (attendees opt
    // themselves in; someone finalizes cost/payments when marking it done).
    if (!startingInProgress) {
      if (cost <= 0) {
        this.errorMessage = 'Enter a court fee or shuttle cost, or record what was paid.';
        return;
      }
      if (!payments.length) {
        this.errorMessage = 'Add at least one valid payment row.';
        return;
      }
      if (!attendees.length) {
        this.errorMessage = 'Select who played — the cost is split across them.';
        return;
      }
    }

    const id = this.data.nextId;
    this.data.nextId += 1;

    const session: Session = {
      id, date, notes, payments,
      cost: startingInProgress ? 0 : cost,
      status: startingInProgress ? 'in_progress' : 'done'
    };
    if (this.newSessionTime.trim()) session.time = this.newSessionTime.trim();
    if (this.newSessionVenue.trim()) session.venue = this.newSessionVenue.trim();
    if (!startingInProgress && this.newSessionHasBreakdown) {
      session.courtFee = Number(this.newSessionCourtFee) || 0;
      session.shuttleCount = Number(this.newSessionShuttleCount) || 0;
      session.shuttlePrice = Number(this.newSessionShuttlePrice) || 0;
    }

    this.data.sessions.push(session);
    this.data.attendance[String(id)] = attendees;

    this.recomputeDerivedState();
    this.resetSessionForm();
    this.persistData(startingInProgress ? 'Session started — players can now opt in.' : 'Session saved successfully.');
  }

  deleteSession(id: number): void {
    if (!this.data) return;
    if (!window.confirm('Delete this session?')) return;

    this.data.sessions = this.data.sessions.filter(session => session.id !== id);
    delete this.data.attendance[String(id)];

    this.recomputeDerivedState();
    this.persistData('Session deleted successfully.');
  }

  updateSession(
    id: number,
    date: string,
    notes: string,
    payments: Payment[],
    attendees: number[],
    breakdown?: SessionCostEdit,
    opts?: { keepInProgress?: boolean }
  ): void {
    if (!this.data) return;
    const session = this.data.sessions.find(s => s.id === id);
    if (!session) { this.errorMessage = 'Session not found.'; return; }

    // Editing an in-progress session without finalizing it: cost/payments
    // stay optional, same as when it was started.
    const wasInProgress = session.status === 'in_progress';
    const staysInProgress = wasInProgress && opts?.keepInProgress === true;

    const validAttendees = attendees.filter(memberId => !!this.memberById(memberId));

    // Finalizing a session (whether it started in_progress or was already
    // done) with nobody marked as having played would collect money without
    // splitting it to anyone's share — same "who played" requirement
    // addSession() enforces for a session created done.
    if (!staysInProgress && !validAttendees.length) {
      this.errorMessage = 'Select who played — the cost is split across them.';
      return;
    }

    const valid = payments
      .map(p => ({ memberId: Number(p.memberId), amount: Number(p.amount) || 0 }))
      .filter(p => p.memberId && p.amount > 0);
    const collected = valid.reduce((sum, p) => sum + p.amount, 0);

    const courtFee = Number(breakdown?.courtFee) || 0;
    const shuttleCount = Number(breakdown?.shuttleCount) || 0;
    const shuttlePrice = Number(breakdown?.shuttlePrice) || 0;
    const hasBreakdown = courtFee > 0 || shuttleCount * shuttlePrice > 0;
    const cost = hasBreakdown ? courtFee + shuttleCount * shuttlePrice : collected;

    if (!date.trim()) {
      this.errorMessage = 'Date is required.';
      return;
    }
    if (!staysInProgress && cost <= 0) {
      this.errorMessage = 'Date and at least one valid payment required.';
      return;
    }

    session.date = date.trim();
    session.notes = notes.trim();
    session.payments = valid;
    session.cost = cost;
    session.status = staysInProgress ? 'in_progress' : 'done';
    this.data.attendance[String(id)] = validAttendees;

    const time = breakdown?.time?.trim();
    const venue = breakdown?.venue?.trim();
    if (time) session.time = time; else delete session.time;
    if (venue) session.venue = venue; else delete session.venue;

    if (hasBreakdown) {
      session.courtFee = courtFee;
      session.shuttleCount = shuttleCount;
      session.shuttlePrice = shuttlePrice;
    } else {
      delete session.courtFee;
      delete session.shuttleCount;
      delete session.shuttlePrice;
    }

    this.recomputeDerivedState();
    this.persistData(
      staysInProgress ? 'Session updated.' : (wasInProgress ? 'Session marked as done.' : 'Session updated successfully.')
    );
  }

  toggleAttendance(sessionId: number, memberId: number): void {
    if (!this.data) return;

    const key = String(sessionId);
    if (!this.data.attendance[key]) this.data.attendance[key] = [];

    const arr = this.data.attendance[key];
    const idx = arr.indexOf(memberId);
    if (idx < 0) arr.push(memberId);
    else arr.splice(idx, 1);

    this.recomputeDerivedState();
    this.persistData('Attendance updated.');
  }

  isPresent(sessionId: number, memberId: number): boolean {
    if (!this.data) return false;
    const arr = this.data.attendance[String(sessionId)] || [];
    return arr.includes(memberId);
  }

  attendeesCount(sessionId: number): number {
    if (!this.data) return 0;
    return (this.data.attendance[String(sessionId)] || []).length;
  }

  saveDuesPayment(): void {
    if (!this.data) return;

    if (!this.duesFrom || !this.duesTo) {
      this.errorMessage = 'Please select payer and receiver.';
      return;
    }
    if (this.duesFrom === this.duesTo) {
      this.errorMessage = 'Payer and receiver cannot be the same.';
      return;
    }

    const amount = Number(this.duesAmount) || 0;
    if (amount <= 0) {
      this.errorMessage = 'Enter a valid dues amount.';
      return;
    }

    if (!this.duesDate) {
      this.errorMessage = 'Please choose a date.';
      return;
    }

    if (!this.data.duesPayments) this.data.duesPayments = [];

    if (this.duesEditId !== null) {
      const index = this.data.duesPayments.findIndex(payment => payment.id === this.duesEditId);
      if (index >= 0) {
        this.data.duesPayments[index] = {
          id: this.duesEditId,
          fromId: this.duesFrom,
          toId: this.duesTo,
          amount,
          date: this.duesDate,
          note: this.duesNote.trim()
        };
      }
      this.recomputeDerivedState();
      this.resetDuesForm();
      this.persistData('Dues payment updated.');
      return;
    }

    this.data.duesPayments.push({
      id: Date.now(),
      fromId: this.duesFrom,
      toId: this.duesTo,
      amount,
      date: this.duesDate,
      note: this.duesNote.trim()
    });

    this.recomputeDerivedState();
    this.resetDuesForm();
    this.persistData('Dues payment recorded.');
  }

  editDuesPayment(payment: DuesPayment): void {
    this.duesEditId = payment.id;
    this.duesFrom = payment.fromId;
    this.duesTo = payment.toId;
    this.duesAmount = payment.amount;
    this.duesDate = payment.date;
    this.duesNote = payment.note || '';
  }

  deleteDuesPayment(id: number): void {
    if (!this.data || !this.data.duesPayments) return;
    if (!window.confirm('Delete this dues payment record?')) return;

    this.data.duesPayments = this.data.duesPayments.filter(payment => payment.id !== id);
    this.recomputeDerivedState();
    this.persistData('Dues payment deleted.');
  }

  cancelDuesEdit(): void {
    this.resetDuesForm();
  }

  addMember(): void {
    if (!this.data) return;

    const name = this.newMemberName.trim();
    if (!name) return;

    if (this.data.members.some(member => member.name === name)) {
      this.errorMessage = 'Member already exists.';
      return;
    }

    const id = this.data.nextMemberId;
    this.data.nextMemberId += 1;
    const username = this.generateUsername(name);
    this.data.members.push({ id, name, username });
    this.newMemberName = '';
    this.initializeUiDefaults();
    this.recomputeDerivedState();
    this.persistData(name + ' added.');
  }

  private generateUsername(name: string): string {
    const taken = new Set((this.data?.members || []).map(m => m.username));
    let base = name.toLowerCase().replace(/[^a-z0-9]/g, '') || 'member';
    while (base.length < 6) base += '0';
    let candidate = base;
    let n = 2;
    while (taken.has(candidate)) {
      candidate = base + n;
      n++;
    }
    return candidate;
  }

  removeMember(memberId: number): void {
    if (!this.data) return;
    const name = this.memberName(memberId);
    if (!window.confirm('Remove ' + name + '? This will not alter historical records.')) return;

    this.data.members = this.data.members.filter(member => member.id !== memberId);
    this.initializeUiDefaults();
    this.recomputeDerivedState();
    this.persistData(name + ' removed.');
  }

  renameMember(memberId: number): void {
    if (!this.data) return;
    const member = this.memberById(memberId);
    if (!member) return;

    const typed = window.prompt('Edit name for ' + member.name + ':', member.name);
    if (typed === null) return;

    const nextName = typed.trim();
    if (!nextName) {
      this.errorMessage = 'Name cannot be empty.';
      return;
    }
    if (nextName === member.name) return;
    if (this.data.members.some(m => m.name === nextName)) {
      this.errorMessage = 'Member already exists.';
      return;
    }

    const oldName = member.name;
    member.name = nextName;

    this.initializeUiDefaults();
    this.recomputeDerivedState();
    this.persistData(oldName + ' renamed to ' + nextName + '.');
  }

  formatDate(dateText: string): string {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return dateText;
    const date = new Date(dateText + 'T00:00:00');
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  getMemberReport(memberId: number): MemberReport | null {
    if (!this.data) return null;
    const member = this.memberById(memberId);
    if (!member) return null;

    // In-progress sessions aren't part of anyone's history/dues yet — see
    // calcSummary() for the same rule applied to group balances.
    const sessions = this.data.sessions.filter(session => session.status !== 'in_progress');
    const attendedSessions = sessions
      .filter(session => (this.data?.attendance[String(session.id)] || []).includes(memberId))
      .map(session => ({
        sessionId: session.id,
        date: session.date,
        cost: session.cost,
        notes: session.notes
      }));

    const sessionPayments = sessions
      .flatMap(session =>
        session.payments
          .filter(payment => payment.memberId === memberId)
          .map(payment => ({
            kind: 'session' as const,
            sessionId: session.id,
            date: session.date,
            amount: payment.amount,
            label: 'Session #' + session.id
          }))
      )
      .sort((a, b) => a.sessionId - b.sessionId);

    const totalOwed = attendedSessions.reduce((sum, session) => {
      const attendees = this.data?.attendance[String(session.sessionId)] || [];
      return sum + (attendees.length ? session.cost / attendees.length : 0);
    }, 0);

    const duesPaidRecords = (this.data.duesPayments || [])
      .filter(payment => payment.fromId === memberId)
      .map(payment => ({
        kind: 'dues' as const,
        sessionId: null,
        date: payment.date,
        amount: payment.amount,
        label: 'Dues to ' + this.memberName(payment.toId)
      }));

    const sessionPaid = sessionPayments.reduce((sum, payment) => sum + payment.amount, 0);
    const duesPaid = duesPaidRecords.reduce((sum, payment) => sum + payment.amount, 0);
    const duesReceived = (this.data.duesPayments || [])
      .filter(payment => payment.toId === memberId)
      .reduce((sum, payment) => sum + payment.amount, 0);
    const payments = [...sessionPayments, ...duesPaidRecords].sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return a.kind.localeCompare(b.kind);
    });
    const totalPaid = sessionPaid + duesPaid;

    return {
      id: memberId,
      name: member.name,
      sessionsAttended: attendedSessions.length,
      totalSessions: sessions.length,
      attendanceRate: sessions.length ? Number(((attendedSessions.length / sessions.length) * 100).toFixed(1)) : 0,
      sessionPaid,
      totalPaid,
      totalOwed,
      duesPaid,
      duesReceived,
      netBalance: sessionPaid - totalOwed + duesPaid - duesReceived,
      attendedSessions: attendedSessions.sort((a, b) => b.sessionId - a.sessionId),
      payments
    };
  }

  private initializeUiDefaults(): void {
    if (!this.data) return;

    if (this.data.members.length) {
      if (!this.newSessionPayments[0].memberId || !this.memberById(this.newSessionPayments[0].memberId)) {
        this.newSessionPayments[0].memberId = this.data.members[0].id;
      }

      if (!this.duesFrom || !this.memberById(this.duesFrom)) {
        this.duesFrom = this.data.members[0].id;
      }

      if (!this.duesTo || !this.memberById(this.duesTo) || this.duesTo === this.duesFrom) {
        this.duesTo = this.data.members.find(member => member.id !== this.duesFrom)?.id || this.duesFrom;
      }
    }

    if (!this.duesDate) {
      this.duesDate = new Date().toISOString().split('T')[0];
    }

    if (this.newSessionShuttlePrice === null) {
      const priced = this.sortedSessions.find(session => !!session.shuttlePrice);
      this.newSessionShuttlePrice = priced?.shuttlePrice ?? null;
    }
  }

  get lastUsedVenue(): string {
    return this.sortedSessions.find(session => !!session.venue)?.venue || '';
  }

  private persistData(successMessage: string): void {
    if (!this.data) return;

    this.errorMessage = '';
    this.successMessage = '';
    this.trackerDataService.saveData(this.data).subscribe({
      next: () => {
        this.successMessage = successMessage;
        const uid = this.authService.user?.uid || 'unknown';
        const username = this.authService.username || 'unknown';
        this.trackerDataService.logAction(successMessage, uid, username).subscribe({ error: () => {} });
      },
      error: () => {
        this.errorMessage = 'Failed to save changes to Firestore. Check your connection and Firebase config.';
      }
    });
  }

  private recomputeDerivedState(): void {
    if (!this.data) return;

    this.summary = this.calcSummary(this.data);
    // In-progress sessions haven't been finalized — same rule as calcSummary.
    this.totalSessions = this.data.sessions
      .filter(session => session.status !== 'in_progress')
      .reduce((sum, session) => sum + session.cost, 0);
  }

  private resetSessionForm(): void {
    this.newSessionDate = '';
    this.newSessionNotes = '';
    this.newSessionPayments = [{ memberId: this.data?.members[0]?.id || 0, amount: 0 }];
    this.newSessionTime = '';
    this.newSessionVenue = '';
    this.newSessionCourtFee = null;
    this.newSessionShuttleCount = null;
    this.newSessionAttendees = [];
    this.newSessionMemberQuery = '';
    this.newSessionInProgress = false;
  }

  private resetDuesForm(): void {
    this.duesEditId = null;
    this.duesAmount = 0;
    this.duesDate = new Date().toISOString().split('T')[0];
    this.duesNote = '';

    if (this.data?.members?.length) {
      this.duesFrom = this.data.members[0].id;
      this.duesTo = this.data.members.find(member => member.id !== this.duesFrom)?.id || this.duesFrom;
    }
  }

  // Greedy min-cash-flow: repeatedly match the largest creditor with the
  // largest debtor until everyone's balance is ~0. Read-only suggestion —
  // recording a payment still goes through saveDuesPayment() same as today.
  computeSettlements(): Settlement[] {
    const creditors = this.summary
      .filter(s => s.balance > 0.5)
      .map(s => ({ id: s.id, balance: s.balance }))
      .sort((a, b) => b.balance - a.balance);
    const debtors = this.summary
      .filter(s => s.balance < -0.5)
      .map(s => ({ id: s.id, balance: -s.balance }))
      .sort((a, b) => b.balance - a.balance);

    const settlements: Settlement[] = [];
    let ci = 0;
    let di = 0;

    while (ci < creditors.length && di < debtors.length) {
      const creditor = creditors[ci];
      const debtor = debtors[di];
      const amount = Math.min(creditor.balance, debtor.balance);

      if (amount > 0.5) {
        settlements.push({ fromId: debtor.id, toId: creditor.id, amount: Math.round(amount) });
      }

      creditor.balance -= amount;
      debtor.balance -= amount;
      if (creditor.balance < 0.5) ci++;
      if (debtor.balance < 0.5) di++;
    }

    return settlements;
  }

  private calcSummary(data: TrackerData): MemberSummary[] {
    const owed: Record<number, number> = {};
    const sessionPaid: Record<number, number> = {};
    const duesPaidMap: Record<number, number> = {};
    const duesReceivedMap: Record<number, number> = {};

    data.members.forEach(member => {
      owed[member.id] = 0;
      sessionPaid[member.id] = 0;
      duesPaidMap[member.id] = 0;
      duesReceivedMap[member.id] = 0;
    });

    data.sessions.forEach(session => {
      if (session.status === 'in_progress') return;

      const attendees = data.attendance[String(session.id)] || [];
      if (!attendees.length) return;

      const share = session.cost / attendees.length;
      attendees.forEach(memberId => {
        if (owed[memberId] !== undefined) owed[memberId] += share;
      });

      session.payments.forEach(payment => {
        if (sessionPaid[payment.memberId] !== undefined) {
          sessionPaid[payment.memberId] += payment.amount;
        }
      });
    });

    (data.duesPayments || []).forEach(payment => {
      if (duesPaidMap[payment.fromId] !== undefined) duesPaidMap[payment.fromId] += payment.amount;
      if (duesReceivedMap[payment.toId] !== undefined) duesReceivedMap[payment.toId] += payment.amount;
    });

    return data.members.map(member => ({
      id: member.id,
      name: member.name,
      owed: owed[member.id] || 0,
      paid: sessionPaid[member.id] || 0,
      duesPaid: duesPaidMap[member.id] || 0,
      balance: (sessionPaid[member.id] || 0) - (owed[member.id] || 0) + (duesPaidMap[member.id] || 0) - (duesReceivedMap[member.id] || 0)
    }));
  }
}
