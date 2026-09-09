import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { Session } from '../models';
import { TrackerStoreService } from '../state/tracker-store.service';

@Component({
  selector: 'app-sessions-tab',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule
  ],
  templateUrl: './sessions-tab.component.html'
})
export class SessionsTabComponent {
  editingSessionId: number | null = null;
  editDate = '';
  editNotes = '';
  editTime = '';
  editVenue = '';
  editCourtFee: number | null = null;
  editShuttleCount: number | null = null;
  editShuttlePrice: number | null = null;
  editPayments: { memberId: number; amount: number }[] = [];

  constructor(public readonly store: TrackerStoreService) {}

  get editSessionCost(): number {
    return this.editPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }

  startEdit(session: Session): void {
    this.editingSessionId = session.id;
    this.editDate = session.date;
    this.editNotes = session.notes || '';
    this.editTime = session.time || '';
    this.editVenue = session.venue || '';
    this.editCourtFee = session.courtFee ?? null;
    this.editShuttleCount = session.shuttleCount ?? null;
    this.editShuttlePrice = session.shuttlePrice ?? null;
    this.editPayments = session.payments.map(p => ({ memberId: p.memberId, amount: p.amount }));
  }

  cancelEdit(): void {
    this.editingSessionId = null;
  }

  addEditPaymentRow(): void {
    this.editPayments.push({ memberId: this.store.data?.members[0]?.id || 0, amount: 0 });
  }

  removeEditPaymentRow(index: number): void {
    if (this.editPayments.length > 1) this.editPayments.splice(index, 1);
  }

  saveEdit(): void {
    if (this.editingSessionId === null) return;
    this.store.updateSession(this.editingSessionId, this.editDate, this.editNotes, [...this.editPayments], {
      time: this.editTime,
      venue: this.editVenue,
      courtFee: this.editCourtFee,
      shuttleCount: this.editShuttleCount,
      shuttlePrice: this.editShuttlePrice
    });
    if (!this.store.errorMessage) this.editingSessionId = null;
  }
}
