import { Injectable } from '@angular/core';
import { AuthService } from '../auth.service';
import { DuesPayment, Member, MemberReport, MemberSummary, Payment, Session, Settlement, TrackerData } from '../models';
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

  quickAttendanceSessionId: number | null = null;
  quickAttendanceQuery = '';
  quickAttendanceSelectedMembers: number[] = [];

  duesEditId: number | null = null;
  duesFrom = 0;
  duesTo = 0;
  duesAmount = 0;
  duesDate = '';
  duesNote = '';

  newMemberName = '';

  pendingDrilldownMemberId: number | null = null;
  pendingQuickDuesOpen = false;

  constructor(
    private readonly trackerDataService: TrackerDataService,
    private readonly authService: AuthService
  ) {}

  get canEdit(): boolean {
    return this.authService.canEdit;
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

  get sortedSessions(): Session[] {
    if (!this.data) return [];
    return [...this.data.sessions].sort((a, b) => b.id - a.id);
  }

  get duesRecords(): DuesPayment[] {
    if (!this.data) return [];
    return [...(this.data.duesPayments || [])].sort((a, b) => b.id - a.id);
  }

  get quickSession(): Session | null {
    if (!this.data || !this.data.sessions.length) return null;
    const found = this.data.sessions.find(session => session.id === this.quickAttendanceSessionId);
    return found || this.data.sessions[this.data.sessions.length - 1];
  }

  get quickSessionAttendees(): number[] {
    const session = this.quickSession;
    if (!session || !this.data) return [];
    return (this.data.attendance[String(session.id)] || []).slice();
  }

  get quickAttendanceAvailableMembers(): Member[] {
    if (!this.data) return [];
    const selected = new Set(this.quickSessionAttendees);
    return this.data.members.filter(member => !selected.has(member.id));
  }

  get quickAttendanceDropdownMembers(): Member[] {
    const query = this.quickAttendanceQuery.trim().toLowerCase();
    return this.quickAttendanceAvailableMembers.filter(member =>
      !query || member.name.toLowerCase().includes(query)
    );
  }

  get filteredQuickSuggestions(): Member[] {
    return this.quickAttendanceDropdownMembers.slice(0, 12);
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

    const date = this.newSessionDate.trim();
    const notes = this.newSessionNotes.trim();
    const payments = this.newSessionPayments
      .map(payment => ({ memberId: Number(payment.memberId), amount: Number(payment.amount) || 0 }))
      .filter(payment => payment.memberId && payment.amount > 0);

    const cost = payments.reduce((sum, payment) => sum + payment.amount, 0);

    if (!date || cost <= 0) {
      this.errorMessage = 'Please enter session date and valid payments.';
      return;
    }

    if (!payments.length) {
      this.errorMessage = 'Add at least one valid payment row.';
      return;
    }

    const id = this.data.nextId;
    this.data.nextId += 1;

    this.data.sessions.push({ id, date, cost, payments, notes });
    this.data.attendance[String(id)] = [];

    this.recomputeDerivedState();
    this.resetSessionForm();
    this.persistData('Session saved successfully.');
  }

  deleteSession(id: number): void {
    if (!this.data) return;
    if (!window.confirm('Delete this session?')) return;

    this.data.sessions = this.data.sessions.filter(session => session.id !== id);
    delete this.data.attendance[String(id)];

    this.recomputeDerivedState();
    this.persistData('Session deleted successfully.');
  }

  updateSession(id: number, date: string, notes: string, payments: Payment[]): void {
    if (!this.data) return;
    const session = this.data.sessions.find(s => s.id === id);
    if (!session) { this.errorMessage = 'Session not found.'; return; }

    const valid = payments
      .map(p => ({ memberId: Number(p.memberId), amount: Number(p.amount) || 0 }))
      .filter(p => p.memberId && p.amount > 0);
    const cost = valid.reduce((sum, p) => sum + p.amount, 0);

    if (!date.trim() || cost <= 0) {
      this.errorMessage = 'Date and at least one valid payment required.';
      return;
    }

    session.date = date.trim();
    session.notes = notes.trim();
    session.payments = valid;
    session.cost = cost;

    this.recomputeDerivedState();
    this.persistData('Session updated successfully.');
  }

  setQuickAttendanceSession(id: number): void {
    this.quickAttendanceSessionId = id;
    this.quickAttendanceSelectedMembers = [];
    this.quickAttendanceQuery = '';
  }

  isQuickAttendanceMemberPicked(memberId: number): boolean {
    return this.quickAttendanceSelectedMembers.includes(memberId);
  }

  toggleQuickAttendanceMemberSelection(memberId: number, checked: boolean): void {
    if (checked) {
      if (!this.quickAttendanceSelectedMembers.includes(memberId)) {
        this.quickAttendanceSelectedMembers = [...this.quickAttendanceSelectedMembers, memberId];
      }
      return;
    }
    this.quickAttendanceSelectedMembers = this.quickAttendanceSelectedMembers.filter(id => id !== memberId);
  }

  clearQuickAttendanceSelection(): void {
    this.quickAttendanceSelectedMembers = [];
  }

  addSelectedQuickAttendanceMembers(): void {
    if (!this.data || !this.quickSession) return;

    const picked = [...this.quickAttendanceSelectedMembers];
    if (!picked.length) {
      this.errorMessage = 'Select at least one member to add.';
      return;
    }

    const key = String(this.quickSession.id);
    if (!this.data.attendance[key]) this.data.attendance[key] = [];
    const attendees = this.data.attendance[key];

    const added: number[] = [];
    picked.forEach(memberId => {
      if (!attendees.includes(memberId)) {
        attendees.push(memberId);
        added.push(memberId);
      }
    });

    if (!added.length) {
      this.errorMessage = 'Selected members are already added.';
      return;
    }

    this.recomputeDerivedState();
    this.quickAttendanceSelectedMembers = [];
    this.quickAttendanceQuery = '';
    this.persistData(added.length + ' members added to attendance.');
  }

  addQuickAttendanceMember(inputMember?: string): boolean {
    if (!this.data || !this.quickSession) return false;

    const typed = (inputMember || this.quickAttendanceQuery).trim();
    if (!typed) {
      this.errorMessage = 'Enter a member name to add.';
      return false;
    }

    const member = this.data.members.find(m => m.name.toLowerCase() === typed.toLowerCase());
    if (!member) {
      this.errorMessage = 'Member not found.';
      return false;
    }

    const key = String(this.quickSession.id);
    if (!this.data.attendance[key]) this.data.attendance[key] = [];
    if (this.data.attendance[key].includes(member.id)) {
      this.errorMessage = member.name + ' is already added.';
      return false;
    }

    this.data.attendance[key].push(member.id);
    this.recomputeDerivedState();
    this.quickAttendanceQuery = '';
    this.persistData(member.name + ' added to attendance.');
    return true;
  }

  removeQuickAttendanceMember(memberId: number): void {
    if (!this.data || !this.quickSession) return;

    const key = String(this.quickSession.id);
    const arr = this.data.attendance[key] || [];
    this.data.attendance[key] = arr.filter(id => id !== memberId);

    this.recomputeDerivedState();
    this.persistData(this.memberName(memberId) + ' removed from attendance.');
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

  prepareQuickDuesFor(memberId: number): void {
    if (!this.data) return;

    const selected = this.summary.find(item => item.id === memberId);
    const candidates = this.summary
      .filter(item => item.id !== memberId && item.balance > 0.5)
      .sort((a, b) => b.balance - a.balance);

    this.duesEditId = null;
    this.duesFrom = memberId;
    this.duesTo = candidates.length
      ? candidates[0].id
      : this.data.members.find(item => item.id !== memberId)?.id || memberId;
    this.duesAmount = Number(Math.abs(selected?.balance || 0).toFixed(0));
    this.duesDate = new Date().toISOString().split('T')[0];
    this.duesNote = '';

    this.errorMessage = '';
    this.successMessage = 'Dues form prefilled for ' + this.memberName(memberId) + '.';
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

    const sessions = this.data.sessions;
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

    if (this.data.sessions.length && !this.quickAttendanceSessionId) {
      this.quickAttendanceSessionId = this.data.sessions[this.data.sessions.length - 1].id;
    }
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
    this.totalSessions = this.data.sessions.reduce((sum, session) => sum + session.cost, 0);
  }

  private resetSessionForm(): void {
    this.newSessionDate = '';
    this.newSessionNotes = '';
    this.newSessionPayments = [{ memberId: this.data?.members[0]?.id || 0, amount: 0 }];
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
