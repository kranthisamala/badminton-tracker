import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuthService, RoleRecord, UserRole } from '../auth.service';
import { MemberReportModalComponent } from '../components/member-report-modal.component';
import { MemberReport } from '../models';
import { TrackerStoreService } from '../state/tracker-store.service';

type AccountRecord = RoleRecord & { uid: string };

@Component({
  selector: 'app-members-tab',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MemberReportModalComponent
  ],
  templateUrl: './members-tab.component.html'
})
export class MembersTabComponent implements OnInit, OnDestroy {
  selectedMemberReport: MemberReport | null = null;
  showMemberReportModal = false;
  accounts: AccountRecord[] = [];

  private unsubscribeRoles: (() => void) | null = null;

  constructor(
    public readonly store: TrackerStoreService,
    public readonly auth: AuthService
  ) {}

  ngOnInit(): void {
    // Only the owner may list the roles collection (see firestore.rules), so
    // everyone else sees the members list without any account/role columns.
    if (this.auth.isOwner) {
      this.unsubscribeRoles = this.auth.watchAllRoles(roles => { this.accounts = roles; });
    }

    if (this.store.pendingDrilldownMemberId !== null) {
      const memberId = this.store.pendingDrilldownMemberId;
      this.store.pendingDrilldownMemberId = null;
      setTimeout(() => this.openMemberReport(memberId), 0);
    }
  }

  ngOnDestroy(): void {
    this.unsubscribeRoles?.();
  }

  accountFor(username: string): AccountRecord | undefined {
    return this.accounts.find(account => account.username === username);
  }

  get unlinkedAccounts(): AccountRecord[] {
    const memberUsernames = new Set((this.store.data?.members || []).map(member => member.username));
    return this.accounts
      .filter(account => !memberUsernames.has(account.username))
      .sort((a, b) => a.username.localeCompare(b.username));
  }

  setRole(uid: string, role: UserRole): void {
    this.auth.setRole(uid, role);
  }

  openMemberReport(memberId: number): void {
    this.selectedMemberReport = this.store.getMemberReport(memberId);
    this.showMemberReportModal = !!this.selectedMemberReport;
  }

  closeMemberReport(): void {
    this.showMemberReportModal = false;
    this.selectedMemberReport = null;
  }
}
