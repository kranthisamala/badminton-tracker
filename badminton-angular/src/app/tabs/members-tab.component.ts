import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MemberReportModalComponent } from '../components/member-report-modal.component';
import { MemberReport } from '../models';
import { TrackerStoreService } from '../state/tracker-store.service';

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
export class MembersTabComponent implements OnInit {
  selectedMemberReport: MemberReport | null = null;
  showMemberReportModal = false;

  constructor(public readonly store: TrackerStoreService) {}

  ngOnInit(): void {
    if (this.store.pendingDrilldownMemberId !== null) {
      const memberId = this.store.pendingDrilldownMemberId;
      this.store.pendingDrilldownMemberId = null;
      setTimeout(() => this.openMemberReport(memberId), 0);
    }
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
