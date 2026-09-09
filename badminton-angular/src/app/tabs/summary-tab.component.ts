import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MemberReportModalComponent } from '../components/member-report-modal.component';
import { MemberReport } from '../models';
import { TrackerStoreService } from '../state/tracker-store.service';

@Component({
  selector: 'app-summary-tab',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MemberReportModalComponent
  ],
  templateUrl: './summary-tab.component.html'
})
export class SummaryTabComponent implements OnInit {
  @ViewChild('quickAmountInput') quickAmountInput?: ElementRef<HTMLInputElement>;

  showQuickDuesModal = false;
  quickDuesMemberId: number | null = null;
  selectedMemberReport: MemberReport | null = null;
  showMemberReportModal = false;
  actionMenuMemberId: number | null = null;

  constructor(public readonly store: TrackerStoreService) {}

  ngOnInit(): void {
    if (this.store.pendingQuickDuesOpen) {
      this.store.pendingQuickDuesOpen = false;
      setTimeout(() => this.recordDuesFor(this.store.duesFrom), 0);
    }
  }

  recordDuesFor(memberId: number): void {
    this.store.prepareQuickDuesFor(memberId);
    this.quickDuesMemberId = memberId;
    this.showQuickDuesModal = true;
    this.focusAmountInput();
  }

  closeQuickDuesModal(): void {
    this.showQuickDuesModal = false;
    this.quickDuesMemberId = null;
  }

  openMemberReport(memberId: number): void {
    this.selectedMemberReport = this.store.getMemberReport(memberId);
    this.showMemberReportModal = !!this.selectedMemberReport;
    this.actionMenuMemberId = null;
  }

  closeMemberReport(): void {
    this.showMemberReportModal = false;
    this.selectedMemberReport = null;
  }

  toggleActionMenu(memberId: number, event: Event): void {
    event.stopPropagation();
    this.actionMenuMemberId = this.actionMenuMemberId === memberId ? null : memberId;
  }

  closeActionMenu(): void {
    this.actionMenuMemberId = null;
  }

  @HostListener('document:keydown.escape')
  onEscapePressed(): void {
    if (this.showMemberReportModal) {
      this.closeMemberReport();
    }
    if (this.showQuickDuesModal) {
      this.closeQuickDuesModal();
    }
    this.closeActionMenu();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement | null;
    if (!target?.closest('.summary-card-menu')) {
      this.closeActionMenu();
    }
  }

  submitQuickDues(): void {
    this.store.saveDuesPayment();
    if (!this.store.errorMessage) {
      this.closeQuickDuesModal();
    }
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

  openQuickDuesFromMenu(memberId: number): void {
    this.closeActionMenu();
    this.recordDuesFor(memberId);
  }

  private focusAmountInput(): void {
    setTimeout(() => {
      this.quickAmountInput?.nativeElement.focus();
      this.quickAmountInput?.nativeElement.select();
    }, 0);
  }

  copySummary(): void {
    const summary = this.store.summary;
    const totalSessions = this.store.totalSessions;
    const date = new Date().toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const toReceive = summary.filter(player => player.balance > 0.5).sort((a, b) => b.balance - a.balance);
    const owes = summary.filter(player => player.balance < -0.5).sort((a, b) => a.balance - b.balance);
    const settled = summary.filter(player => Math.abs(player.balance) <= 0.5);

    let text = 'Badminton Tracker - Balances\n' + 'Date: ' + date + '\n';

    if (toReceive.length) {
      text += '\nTo Receive\n';
      toReceive.forEach(player => {
        text += '- ' + player.name + ' - Rs ' + Math.round(player.balance).toLocaleString('en-IN') + '\n';
      });
    }

    if (owes.length) {
      text += '\nDues Pending\n';
      owes.forEach(player => {
        text += '- ' + player.name + ' - Owes Rs ' + Math.round(Math.abs(player.balance)).toLocaleString('en-IN') + '\n';
      });
    }

    if (settled.length) {
      text += '\nSettled\n';
      settled.forEach(player => {
        text += '- ' + player.name + '\n';
      });
    }

    text += '\nTotal spent: Rs ' + totalSessions.toLocaleString('en-IN');

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          this.store.errorMessage = '';
          this.store.successMessage = 'Summary copied to clipboard.';
        })
        .catch(() => {
          this.fallbackCopy(text);
        });
      return;
    }

    this.fallbackCopy(text);
  }

  printSummary(): void {
    window.print();
  }

  private fallbackCopy(text: string): void {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    this.store.errorMessage = '';
    this.store.successMessage = 'Summary copied to clipboard.';
  }
}
