import { CommonModule } from '@angular/common';
import { Component, DoCheck, OnInit } from '@angular/core';
import { AuthService } from './auth.service';
import { ChangePasswordComponent } from './change-password.component';
import { LoginComponent } from './login.component';
import { AccessTabComponent } from './tabs/access-tab.component';
import { ActivityLogTabComponent } from './tabs/activity-log-tab.component';
import { AttendanceTabComponent } from './tabs/attendance-tab.component';
import { DashboardTabComponent, DashboardDrilldown } from './tabs/dashboard-tab.component';
import { DuesTabComponent } from './tabs/dues-tab.component';
import { MembersTabComponent } from './tabs/members-tab.component';
import { QuickAttendanceTabComponent } from './tabs/quick-attendance-tab.component';
import { SessionsTabComponent } from './tabs/sessions-tab.component';
import { SummaryTabComponent } from './tabs/summary-tab.component';
import { TrackerStoreService } from './state/tracker-store.service';

type TabName = 'summary' | 'dashboard' | 'quick-attendance' | 'attendance' | 'sessions' | 'dues' | 'members' | 'activity' | 'access';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    LoginComponent,
    ChangePasswordComponent,
    SummaryTabComponent,
    DashboardTabComponent,
    QuickAttendanceTabComponent,
    AttendanceTabComponent,
    SessionsTabComponent,
    DuesTabComponent,
    MembersTabComponent,
    ActivityLogTabComponent,
    AccessTabComponent
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.less'
})
export class AppComponent implements OnInit, DoCheck {
  activeTab: TabName = 'summary';

  private storeInitialized = false;

  constructor(public readonly store: TrackerStoreService, public readonly auth: AuthService) {}

  ngOnInit(): void {}

  ngDoCheck(): void {
    const ready = !!this.auth.user && !this.auth.mustChangePassword;
    if (ready && !this.storeInitialized) {
      this.storeInitialized = true;
      this.store.init();
    }
    if (!ready && this.storeInitialized) {
      this.storeInitialized = false;
      this.store.reset();
    }
    if (this.activeTab === 'access' && !this.auth.isOwner) {
      this.activeTab = 'summary';
    }
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

  async signOut(): Promise<void> {
    await this.auth.signOutUser();
  }

  dismissSuccess(): void {
    this.store.successMessage = '';
  }

  dismissError(): void {
    this.store.errorMessage = '';
  }
}
