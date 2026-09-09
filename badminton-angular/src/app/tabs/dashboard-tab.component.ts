import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { MemberReport, Session } from '../models';
import { TrackerStoreService } from '../state/tracker-store.service';

const RECENT_SPEND_SESSIONS = 8;
const TOP_ATTENDANCE_ROWS = 6;

@Component({
  selector: 'app-dashboard-tab',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard-tab.component.html'
})
export class DashboardTabComponent {
  constructor(public readonly store: TrackerStoreService) {}

  get report(): MemberReport | null {
    const member = this.store.currentMember;
    return member ? this.store.getMemberReport(member.id) : null;
  }

  isSettled(balance: number): boolean {
    return Math.abs(balance) <= 0.5;
  }

  isOwing(balance: number): boolean {
    return balance < -0.5;
  }

  isReceiving(balance: number): boolean {
    return balance > 0.5;
  }

  isOptedIn(sessionId: number): boolean {
    const member = this.store.currentMember;
    return !!member && this.store.isPresent(sessionId, member.id);
  }

  // Recent sessions is the group's ledger at a glance, not just the sessions
  // this player personally attended — matches mockup 1a.
  get recentSessions(): Session[] {
    return this.store.sortedSessions.filter(s => s.status !== 'in_progress').slice(0, 5);
  }

  perHead(session: Session): number {
    const attendees = this.store.attendeesCount(session.id);
    return attendees ? session.cost / attendees : 0;
  }

  get undecidedCount(): number {
    const session = this.store.nextSession;
    if (!session || !this.store.data) return 0;
    return Math.max(0, this.store.data.members.length - this.store.attendeesCount(session.id));
  }

  get nextSessionProgressPct(): number {
    const session = this.store.nextSession;
    const total = this.store.data?.members.length || 0;
    if (!session || !total) return 0;
    return Math.min(100, (this.store.attendeesCount(session.id) / total) * 100);
  }

  // Mockup 1a's two mini-visualizations ("SPEND PER SESSION", "ATTENDANCE
  // RATE") are plain CSS bars in the design itself, not a charting library —
  // matched here directly rather than reaching for Chart.js for something
  // this simple.
  get spendBars(): { date: string; cost: number; pct: number; current: boolean }[] {
    const sessions = this.store.sortedSessions
      .filter(s => s.status !== 'in_progress')
      .slice(0, RECENT_SPEND_SESSIONS)
      .reverse();
    if (!sessions.length) return [];

    const max = Math.max(...sessions.map(s => s.cost), 1);
    return sessions.map((s, i) => ({
      date: s.date,
      cost: s.cost,
      pct: Math.max(4, Math.round((s.cost / max) * 100)),
      current: i === sessions.length - 1
    }));
  }

  get attendanceRateRows(): { name: string; rate: number }[] {
    if (!this.store.data) return [];
    const sessions = this.store.data.sessions.filter(s => s.status !== 'in_progress');
    const total = sessions.length;
    if (!total) return [];

    return this.store.data.members
      .map(member => {
        const attended = sessions.filter(session => (this.store.data?.attendance[String(session.id)] || []).includes(member.id)).length;
        return { name: member.name, rate: Number(((attended / total) * 100).toFixed(1)) };
      })
      .filter(row => row.rate > 0)
      .sort((a, b) => b.rate - a.rate || a.name.localeCompare(b.name))
      .slice(0, TOP_ATTENDANCE_ROWS);
  }
}
