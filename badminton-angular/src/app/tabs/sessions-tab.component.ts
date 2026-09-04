import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
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
    MatButtonModule,
    MatIconModule,
    MatDatepickerModule,
    MatNativeDateModule
  ],
  templateUrl: './sessions-tab.component.html'
})
export class SessionsTabComponent {
  sessionDateValue: Date | null = null;

  editingSessionId: number | null = null;
  editDate = '';
  editNotes = '';
  editPayments: { player: string; amount: number }[] = [];

  constructor(public readonly store: TrackerStoreService) {}

  get editSessionCost(): number {
    return this.editPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }

  onDateSelected(date: Date | null): void {
    if (!date) {
      this.store.newSessionDate = '';
      return;
    }
    this.store.newSessionDate = this.formatDateLabel(date);
  }

  startEdit(session: Session): void {
    this.editingSessionId = session.id;
    this.editDate = session.date;
    this.editNotes = session.notes || '';
    this.editPayments = session.payments.map(p => ({ player: p.player, amount: p.amount }));
  }

  cancelEdit(): void {
    this.editingSessionId = null;
  }

  addEditPaymentRow(): void {
    this.editPayments.push({ player: this.store.data?.members[0] || '', amount: 0 });
  }

  removeEditPaymentRow(index: number): void {
    if (this.editPayments.length > 1) this.editPayments.splice(index, 1);
  }

  saveEdit(): void {
    if (this.editingSessionId === null) return;
    this.store.updateSession(this.editingSessionId, this.editDate, this.editNotes, [...this.editPayments]);
    if (!this.store.errorMessage) this.editingSessionId = null;
  }

  private formatDateLabel(date: Date): string {
    const day = date.getDate();
    const month = date.toLocaleDateString('en-IN', { month: 'long' });
    const v = day % 100;
    const suffixes = ['th', 'st', 'nd', 'rd'];
    const suffix = suffixes[(v - 20) % 10] ?? suffixes[v] ?? suffixes[0];
    return `${day}${suffix} ${month}`;
  }
}