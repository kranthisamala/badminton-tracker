import { Injectable } from '@angular/core';
import { DuesPayment, MemberReport, MemberSummary, Payment, Session, TrackerData } from '../models';
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
  newSessionPayments: Payment[] = [{ player: '', amount: 0 }];

  quickAttendanceSessionId: number | null = null;
  quickAttendanceQuery = '';
  quickAttendanceSelectedMembers: string[] = [];

  duesEditId: number | null = null;
  duesFrom = '';
  duesTo = '';
  duesAmount = 0;
  duesDate = '';
  duesNote = '';

  newMemberName = '';

  pendingDrilldownMember: string | null = null;

  constructor(private readonly trackerDataService: TrackerDataService) {}

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
        this.errorMessage = 'Unable to load data from server. Ensure python server is running on localhost:5000.';
      }
    });
  }

  clearMessages(): void {
    this.errorMessage = '';
    this.successMessage = '';
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

  get quickSessionAttendees(): string[] {
    const session = this.quickSession;
    if (!session || !this.data) return [];
    return (this.data.attendance[String(session.id)] || []).slice();
  }

  get quickAttendanceAvailableMembers(): string[] {
    if (!this.data) return [];
    const selected = new Set(this.quickSessionAttendees);
    return this.data.members.filter(member => !selected.has(member));
  }

  get quickAttendanceDropdownMembers(): string[] {
    const query = this.quickAttendanceQuery.trim().toLowerCase();
    return this.quickAttendanceAvailableMembers.filter(member =>
      !query || member.toLowerCase().includes(query)
    );
  }

  get filteredQuickSuggestions(): string[] {
    return this.quickAttendanceDropdownMembers.slice(0, 12);
  }

  addPaymentRow(): void {
    this.newSessionPayments.push({ player: this.data?.members[0] || '', amount: 0 });
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
      .map(payment => ({ player: payment.player, amount: Number(payment.amount) || 0 }))
      .filter(payment => payment.player && payment.amount > 0);

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
      .map(p => ({ player: p.player, amount: Number(p.amount) || 0 }))
      .filter(p => p.player && p.amount > 0);
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

  isQuickAttendanceMemberPicked(member: string): boolean {
    return this.quickAttendanceSelectedMembers.includes(member);
  }

  toggleQuickAttendanceMemberSelection(member: string, checked: boolean): void {
    if (checked) {
      if (!this.quickAttendanceSelectedMembers.includes(member)) {
        this.quickAttendanceSelectedMembers = [...this.quickAttendanceSelectedMembers, member];
      }
      return;
    }
    this.quickAttendanceSelectedMembers = this.quickAttendanceSelectedMembers.filter(name => name !== member);
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

    const added: string[] = [];
    picked.forEach(member => {
      if (!attendees.includes(member)) {
        attendees.push(member);
        added.push(member);
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

    const member = this.data.members.find(m => m.toLowerCase() === typed.toLowerCase());
    if (!member) {
      this.errorMessage = 'Member not found.';
      return false;
    }

    const key = String(this.quickSession.id);
    if (!this.data.attendance[key]) this.data.attendance[key] = [];
    if (this.data.attendance[key].includes(member)) {
      this.errorMessage = member + ' is already added.';
      return false;
    }

    this.data.attendance[key].push(member);
    this.recomputeDerivedState();
    this.quickAttendanceQuery = '';
    this.persistData(member + ' added to attendance.');
    return true;
  }

  removeQuickAttendanceMember(member: string): void {
    if (!this.data || !this.quickSession) return;

    const key = String(this.quickSession.id);
    const arr = this.data.attendance[key] || [];
    this.data.attendance[key] = arr.filter(name => name !== member);

    this.recomputeDerivedState();
    this.persistData(member + ' removed from attendance.');
  }

  toggleAttendance(sessionId: number, member: string): void {
    if (!this.data) return;

    const key = String(sessionId);
    if (!this.data.attendance[key]) this.data.attendance[key] = [];

    const arr = this.data.attendance[key];
    const idx = arr.indexOf(member);
    if (idx < 0) arr.push(member);
    else arr.splice(idx, 1);

    this.recomputeDerivedState();
    this.persistData('Attendance updated.');
  }

  isPresent(sessionId: number, member: string): boolean {
    if (!this.data) return false;
    const arr = this.data.attendance[String(sessionId)] || [];
    return arr.includes(member);
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
          from: this.duesFrom,
          to: this.duesTo,
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
      from: this.duesFrom,
      to: this.duesTo,
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
    this.duesFrom = payment.from;
    this.duesTo = payment.to;
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

  prepareQuickDuesFor(member: string): void {
    if (!this.data) return;

    const selected = this.summary.find(item => item.name === member);
    const candidates = this.summary
      .filter(item => item.name !== member && item.balance > 0.5)
      .sort((a, b) => b.balance - a.balance);

    this.duesEditId = null;
    this.duesFrom = member;
    this.duesTo = candidates.length
      ? candidates[0].name
      : this.data.members.find(item => item !== member) || member;
    this.duesAmount = Number(Math.abs(selected?.balance || 0).toFixed(0));
    this.duesDate = new Date().toISOString().split('T')[0];
    this.duesNote = '';

    this.errorMessage = '';
    this.successMessage = 'Dues form prefilled for ' + member + '.';
  }

  addMember(): void {
    if (!this.data) return;

    const name = this.newMemberName.trim();
    if (!name) return;

    if (this.data.members.includes(name)) {
      this.errorMessage = 'Member already exists.';
      return;
    }

    this.data.members.push(name);
    this.newMemberName = '';
    this.initializeUiDefaults();
    this.recomputeDerivedState();
    this.persistData(name + ' added.');
  }

  removeMember(name: string): void {
    if (!this.data) return;
    if (!window.confirm('Remove ' + name + '? This will not alter historical records.')) return;

    this.data.members = this.data.members.filter(member => member !== name);
    this.initializeUiDefaults();
    this.recomputeDerivedState();
    this.persistData(name + ' removed.');
  }

  renameMember(oldName: string): void {
    if (!this.data) return;

    const typed = window.prompt('Edit name for ' + oldName + ':', oldName);
    if (typed === null) return;

    const nextName = typed.trim();
    if (!nextName) {
      this.errorMessage = 'Name cannot be empty.';
      return;
    }
    if (nextName === oldName) return;
    if (this.data.members.includes(nextName)) {
      this.errorMessage = 'Member already exists.';
      return;
    }

    this.data.members = this.data.members.map(member => (member === oldName ? nextName : member));

    Object.keys(this.data.attendance).forEach(sessionId => {
      this.data!.attendance[sessionId] = (this.data!.attendance[sessionId] || []).map(name =>
        name === oldName ? nextName : name
      );
    });

    this.data.sessions.forEach(session => {
      session.payments = session.payments.map(payment =>
        payment.player === oldName ? { ...payment, player: nextName } : payment
      );
    });

    if (this.data.duesPayments) {
      this.data.duesPayments = this.data.duesPayments.map(payment => ({
        ...payment,
        from: payment.from === oldName ? nextName : payment.from,
        to: payment.to === oldName ? nextName : payment.to
      }));
    }

    this.initializeUiDefaults();
    this.recomputeDerivedState();
    this.persistData(oldName + ' renamed to ' + nextName + '.');
  }

  formatDate(dateText: string): string {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return dateText;
    const date = new Date(dateText + 'T00:00:00');
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  getMemberReport(member: string): MemberReport | null {
    if (!this.data) return null;

    const sessions = this.data.sessions;
    const attendedSessions = sessions
      .filter(session => (this.data?.attendance[String(session.id)] || []).includes(member))
      .map(session => ({
        sessionId: session.id,
        date: session.date,
        cost: session.cost,
        notes: session.notes
      }));

    const sessionPayments = sessions
      .flatMap(session =>
        session.payments
          .filter(payment => payment.player === member)
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
      .filter(payment => payment.from === member)
      .map(payment => ({
        kind: 'dues' as const,
        sessionId: null,
        date: payment.date,
        amount: payment.amount,
        label: 'Dues to ' + payment.to
      }));

    const sessionPaid = sessionPayments.reduce((sum, payment) => sum + payment.amount, 0);
    const duesPaid = duesPaidRecords.reduce((sum, payment) => sum + payment.amount, 0);
    const duesReceived = (this.data.duesPayments || [])
      .filter(payment => payment.to === member)
      .reduce((sum, payment) => sum + payment.amount, 0);
    const payments = [...sessionPayments, ...duesPaidRecords].sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return a.kind.localeCompare(b.kind);
    });
    const totalPaid = sessionPaid + duesPaid;

    return {
      name: member,
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
      if (!this.newSessionPayments[0].player || !this.data.members.includes(this.newSessionPayments[0].player)) {
        this.newSessionPayments[0].player = this.data.members[0];
      }

      if (!this.duesFrom || !this.data.members.includes(this.duesFrom)) {
        this.duesFrom = this.data.members[0];
      }

      if (!this.duesTo || !this.data.members.includes(this.duesTo) || this.duesTo === this.duesFrom) {
        this.duesTo = this.data.members.find(member => member !== this.duesFrom) || this.duesFrom;
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
      },
      error: () => {
        this.errorMessage = 'Failed to save changes. Please ensure backend server is running.';
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
    this.newSessionPayments = [{ player: this.data?.members[0] || '', amount: 0 }];
  }

  private resetDuesForm(): void {
    this.duesEditId = null;
    this.duesAmount = 0;
    this.duesDate = new Date().toISOString().split('T')[0];
    this.duesNote = '';

    if (this.data?.members?.length) {
      this.duesFrom = this.data.members[0];
      this.duesTo = this.data.members.find(member => member !== this.duesFrom) || this.duesFrom;
    }
  }

  private calcSummary(data: TrackerData): MemberSummary[] {
    const owed: Record<string, number> = {};
    const sessionPaid: Record<string, number> = {};
    const duesPaidMap: Record<string, number> = {};
    const duesReceivedMap: Record<string, number> = {};

    data.members.forEach(member => {
      owed[member] = 0;
      sessionPaid[member] = 0;
      duesPaidMap[member] = 0;
      duesReceivedMap[member] = 0;
    });

    data.sessions.forEach(session => {
      const attendees = data.attendance[String(session.id)] || [];
      if (!attendees.length) return;

      const share = session.cost / attendees.length;
      attendees.forEach(member => {
        if (owed[member] !== undefined) owed[member] += share;
      });

      session.payments.forEach(payment => {
        if (sessionPaid[payment.player] !== undefined) {
          sessionPaid[payment.player] += payment.amount;
        }
      });
    });

    (data.duesPayments || []).forEach(payment => {
      if (duesPaidMap[payment.from] !== undefined) duesPaidMap[payment.from] += payment.amount;
      if (duesReceivedMap[payment.to] !== undefined) duesReceivedMap[payment.to] += payment.amount;
    });

    return data.members.map(member => ({
      name: member,
      owed: owed[member] || 0,
      paid: sessionPaid[member] || 0,
      duesPaid: duesPaidMap[member] || 0,
      balance: (sessionPaid[member] || 0) - (owed[member] || 0) + (duesPaidMap[member] || 0) - (duesReceivedMap[member] || 0)
    }));
  }
}
