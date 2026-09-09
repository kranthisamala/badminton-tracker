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
import { MyDashboardTabComponent } from './tabs/my-dashboard-tab.component';
import { QuickAttendanceTabComponent } from './tabs/quick-attendance-tab.component';
import { SessionsTabComponent } from './tabs/sessions-tab.component';
import { SummaryTabComponent } from './tabs/summary-tab.component';
import { TrackerStoreService } from './state/tracker-store.service';

type TabName = 'summary' | 'dashboard' | 'quick-attendance' | 'attendance' | 'sessions' | 'dues' | 'members' | 'activity' | 'access';

interface NavItem {
  id: TabName;
  label: string;
  ownerOnly?: boolean;
}

const ALL_NAV_ITEMS: NavItem[] = [
  { id: 'summary', label: 'Summary' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'quick-attendance', label: 'Quick Attendance' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'sessions', label: 'Sessions' },
  { id: 'dues', label: 'Dues' },
  { id: 'members', label: 'Members' },
  { id: 'activity', label: 'Activity Log' },
  { id: 'access', label: 'Access', ownerOnly: true }
];

const PRIMARY_NAV_IDS: TabName[] = ['summary', 'dashboard', 'sessions', 'dues', 'members'];

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    LoginComponent,
    ChangePasswordComponent,
    SummaryTabComponent,
    DashboardTabComponent,
    MyDashboardTabComponent,
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
    if (this.activeTab === 'access' && !this.auth.isOwner) {
      this.activeTab = 'summary';
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

  selectTab(tab: TabName): void {
    this.activeTab = tab;
    this.showMoreMenu = false;
    this.store.clearMessages();
  }

  toggleMoreMenu(): void {
    this.showMoreMenu = !this.showMoreMenu;
  }

  quickNewSession(): void {
    this.selectTab('sessions');
  }

  quickRecordDues(): void {
    this.selectTab('summary');
    this.store.pendingQuickDuesOpen = true;
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
