import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { AttendanceTabComponent } from './tabs/attendance-tab.component';
import { DashboardTabComponent, DashboardDrilldown } from './tabs/dashboard-tab.component';
import { DuesTabComponent } from './tabs/dues-tab.component';
import { MembersTabComponent } from './tabs/members-tab.component';
import { QuickAttendanceTabComponent } from './tabs/quick-attendance-tab.component';
import { SessionsTabComponent } from './tabs/sessions-tab.component';
import { SummaryTabComponent } from './tabs/summary-tab.component';
import { TrackerStoreService } from './state/tracker-store.service';

type TabName = 'summary' | 'dashboard' | 'quick-attendance' | 'attendance' | 'sessions' | 'dues' | 'members';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    SummaryTabComponent,
    DashboardTabComponent,
    QuickAttendanceTabComponent,
    AttendanceTabComponent,
    SessionsTabComponent,
    DuesTabComponent,
    MembersTabComponent
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.less'
})
export class AppComponent implements OnInit {
  activeTab: TabName = 'summary';

  constructor(public readonly store: TrackerStoreService) {}

  ngOnInit(): void {
    this.store.init();
  }

  selectTab(tab: TabName): void {
    this.activeTab = tab;
    this.store.clearMessages();
  }

  onDashboardDrilldown(event: DashboardDrilldown): void {
    this.selectTab(event.tab as TabName);
    if (event.memberId) {
      this.store.pendingDrilldownMemberId = event.memberId;
    }
  }

  dismissSuccess(): void {
    this.store.successMessage = '';
  }

  dismissError(): void {
    this.store.errorMessage = '';
  }
}
