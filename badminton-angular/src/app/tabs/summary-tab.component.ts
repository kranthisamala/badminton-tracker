import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MemberReportModalComponent } from '../components/member-report-modal.component';
import { MemberReport } from '../models';
import { TrackerStoreService } from '../state/tracker-store.service';

@Component({
  selector: 'app-summary-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, MemberReportModalComponent],
  templateUrl: './summary-tab.component.html'
})
export class SummaryTabComponent {
  @ViewChild('quickAmountInput') quickAmountInput?: ElementRef<HTMLInputElement>;

  showQuickDuesModal = false;
  quickDuesMember = '';
  selectedMemberReport: MemberReport | null = null;
  showMemberReportModal = false;
  actionMenuMember: string | null = null;

  constructor(public readonly store: TrackerStoreService) {}

  recordDuesFor(member: string): void {
    this.store.prepareQuickDuesFor(member);
    this.quickDuesMember = member;
    this.showQuickDuesModal = true;
    this.focusAmountInput();
  }

  closeQuickDuesModal(): void {
    this.showQuickDuesModal = false;
    this.quickDuesMember = '';
  }

  openMemberReport(member: string): void {
    this.selectedMemberReport = this.store.getMemberReport(member);
    this.showMemberReportModal = !!this.selectedMemberReport;
    this.actionMenuMember = null;
  }

  closeMemberReport(): void {
    this.showMemberReportModal = false;
    this.selectedMemberReport = null;
  }

  toggleActionMenu(member: string, event: Event): void {
    event.stopPropagation();
    this.actionMenuMember = this.actionMenuMember === member ? null : member;
  }

  closeActionMenu(): void {
    this.actionMenuMember = null;
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

  openQuickDuesFromMenu(member: string): void {
    this.closeActionMenu();
    this.recordDuesFor(member);
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
