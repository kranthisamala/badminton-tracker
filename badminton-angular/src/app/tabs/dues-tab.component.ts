import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { DuesPayment, MemberSummary, Settlement } from '../models';
import { TrackerStoreService } from '../state/tracker-store.service';

interface BalanceRow extends MemberSummary {
  attended: number;
}

@Component({
  selector: 'app-dues-tab',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule
  ],
  templateUrl: './dues-tab.component.html'
})
export class DuesTabComponent {
  constructor(public readonly store: TrackerStoreService) {}

  copyBalances(): void {
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
          this.store.successMessage = 'Balances copied to clipboard.';
        })
        .catch(() => this.fallbackCopy(text));
      return;
    }

    this.fallbackCopy(text);
  }

  printBalances(): void {
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
    this.store.successMessage = 'Balances copied to clipboard.';
  }

  get balanceRows(): BalanceRow[] {
    return this.store.summary.map(row => ({
      ...row,
      attended: this.store.getMemberReport(row.id)?.sessionsAttended || 0
    }));
  }

  get settlements(): Settlement[] {
    return this.store.computeSettlements();
  }

  recordSettlement(settlement: Settlement): void {
    if (!this.store.canEdit) return;
    this.store.duesEditId = null;
    this.store.duesFrom = settlement.fromId;
    this.store.duesTo = settlement.toId;
    this.store.duesAmount = settlement.amount;
    this.store.duesDate = new Date().toISOString().split('T')[0];
    this.store.duesNote = '';
    this.store.showRecordDuesModal = true;
  }

  editPayment(payment: DuesPayment): void {
    this.store.editDuesPayment(payment);
    this.store.showRecordDuesModal = true;
  }
}
