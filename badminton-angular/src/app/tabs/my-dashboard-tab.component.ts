import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { MemberReport } from '../models';
import { TrackerStoreService } from '../state/tracker-store.service';

@Component({
  selector: 'app-my-dashboard-tab',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './my-dashboard-tab.component.html'
})
export class MyDashboardTabComponent {
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
}
