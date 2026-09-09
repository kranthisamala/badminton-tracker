import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MemberSummary, Settlement } from '../models';
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
  }
}
