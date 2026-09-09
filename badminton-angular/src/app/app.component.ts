import { CommonModule } from '@angular/common';
import { Component, DoCheck, OnInit } from '@angular/core';
import { AuthService } from './auth.service';
import { ChangePasswordComponent } from './change-password.component';
import { LoginComponent } from './login.component';
import { ActivityLogTabComponent } from './tabs/activity-log-tab.component';
import { AttendanceTabComponent } from './tabs/attendance-tab.component';
import { DashboardTabComponent } from './tabs/dashboard-tab.component';
import { DuesTabComponent } from './tabs/dues-tab.component';
import { MembersTabComponent } from './tabs/members-tab.component';
import { ReportsTabComponent, ReportsDrilldown } from './tabs/reports-tab.component';
import { NewSessionFormComponent } from './forms/new-session-form.component';
import { RecordDuesFormComponent } from './forms/record-dues-form.component';
import { SessionsTabComponent } from './tabs/sessions-tab.component';
import { TrackerStoreService } from './state/tracker-store.service';

type TabName = 'dashboard' | 'reports' | 'attendance' | 'sessions' | 'dues' | 'members' | 'activity';

interface NavItem {
  id: TabName;
  label: string;
  ownerOnly?: boolean;
}

// Dashboard is the same personal-at-a-glance view for every role, and it's
// first; Reports (the old owner-only charts) moved down since it's not
// anyone's "front page" the way Dashboard is. Summary was retired — the Dues
// tab's balance table already covered the same ground.
const ALL_NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'reports', label: 'Reports' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'sessions', label: 'Sessions' },
  { id: 'dues', label: 'Dues' },
  { id: 'members', label: 'Members' },
  { id: 'activity', label: 'Activity Log' }
];

const PRIMARY_NAV_IDS: TabName[] = ['dashboard', 'reports', 'sessions', 'dues', 'members'];

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    LoginComponent,
    ChangePasswordComponent,
    DashboardTabComponent,
    ReportsTabComponent,
    AttendanceTabComponent,
    SessionsTabComponent,
    DuesTabComponent,
    MembersTabComponent,
    ActivityLogTabComponent,
    NewSessionFormComponent,
    RecordDuesFormComponent
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.less'
})
export class AppComponent implements OnInit, DoCheck {
  activeTab: TabName = 'dashboard';
  showMoreMenu = false;

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
  }

  get sidebarNavItems(): NavItem[] {
    return ALL_NAV_ITEMS.filter(item => !item.ownerOnly || this.auth.isOwner);
  }

  get bottomPrimaryItems(): NavItem[] {
    return ALL_NAV_ITEMS.filter(item => PRIMARY_NAV_IDS.includes(item.id));
  }

  get moreNavItems(): NavItem[] {
    return ALL_NAV_ITEMS.filter(item => !PRIMARY_NAV_IDS.includes(item.id) && (!item.ownerOnly || this.auth.isOwner));
  }

  get tabTitle(): string {
    return ALL_NAV_ITEMS.find(item => item.id === this.activeTab)?.label || '';
  }

  // Distinguishes the fatal "couldn't load data at all" state (no data yet)
  // from a transient form-validation error surfaced via the same
  // store.errorMessage field — the nav/tabs must stay visible for the latter,
  // otherwise every validation message (e.g. "select who played") blanks the
  // whole app down to just the toast.
  get loadFailed(): boolean {
    return !!this.store.errorMessage && !this.store.data;
  }

  selectTab(tab: TabName): void {
    this.activeTab = tab;
    this.showMoreMenu = false;
    this.store.clearMessages();
  }

  toggleMoreMenu(): void {
    this.showMoreMenu = !this.showMoreMenu;
  }

  quickNewSession(): void {
    this.store.showNewSessionModal = true;
  }

  closeNewSession(): void {
    this.store.showNewSessionModal = false;
  }

  quickRecordDues(): void {
    this.store.cancelDuesEdit();
    this.store.showRecordDuesModal = true;
  }

  closeRecordDues(): void {
    this.store.showRecordDuesModal = false;
    this.store.cancelDuesEdit();
  }

  onReportsDrilldown(event: ReportsDrilldown): void {
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
