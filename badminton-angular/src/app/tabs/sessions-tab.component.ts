import { CommonModule } from '@angular/common';
import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatChipsModule } from '@angular/material/chips';
import { Member, Session } from '../models';
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
    MatAutocompleteModule,
    MatChipsModule
  ],
  templateUrl: './sessions-tab.component.html'
})
export class SessionsTabComponent implements AfterViewInit {
  @ViewChild('editMemberInput') editMemberInputEl?: ElementRef<HTMLInputElement>;
  @ViewChild('editMemberChipWrapper') editMemberChipWrapper?: ElementRef<HTMLDivElement>;

  editMemberPickerWidth = 500;

  editingSessionId: number | null = null;
  editDate = '';
  editNotes = '';
  editTime = '';
  editVenue = '';
  editCourtFee: number | null = null;
  editShuttleCount: number | null = null;
  editShuttlePrice: number | null = null;
  editPayments: { memberId: number; amount: number }[] = [];
  editAttendees: number[] = [];
  editMemberQuery = '';

  constructor(
    public readonly store: TrackerStoreService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngAfterViewInit(): void {
    if (this.editMemberChipWrapper) {
      this.editMemberPickerWidth = this.editMemberChipWrapper.nativeElement.offsetWidth || 500;
      this.cdr.detectChanges();
    }
  }

  get editSessionCost(): number {
    return this.editPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }

  get doneSessions(): Session[] {
    return this.store.sortedSessions.filter(session => session.status !== 'in_progress');
  }

  memberNames(sessionId: number): string {
    return this.store.attendeeMembers(sessionId).map(member => member.name).join(', ');
  }

  get editAttendeeMembers(): Member[] {
    return this.editAttendees
      .map(id => this.store.memberById(id))
      .filter((member): member is Member => !!member);
  }

  get editCandidateMembers(): Member[] {
    if (!this.store.data) return [];
    const query = this.editMemberQuery.trim().toLowerCase();
    const picked = new Set(this.editAttendees);
    return this.store.data.members.filter(
      member => !picked.has(member.id) && (!query || member.name.toLowerCase().includes(query))
    );
  }

  addEditAttendee(memberId: number): void {
    if (!this.editAttendees.includes(memberId)) {
      this.editAttendees = [...this.editAttendees, memberId];
    }
    this.editMemberQuery = '';
  }

  removeEditAttendee(memberId: number): void {
    this.editAttendees = this.editAttendees.filter(id => id !== memberId);
  }

  onEditMemberSelected(event: MatAutocompleteSelectedEvent): void {
    this.addEditAttendee(Number(event.option.value));
    if (this.editMemberInputEl) this.editMemberInputEl.nativeElement.value = '';
    setTimeout(() => {
      if (this.editMemberInputEl) {
        this.editMemberInputEl.nativeElement.focus();
        this.editMemberInputEl.nativeElement.dispatchEvent(new Event('input'));
      }
    });
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
    this.editAttendees = [...this.store.attendeeMembers(session.id).map(m => m.id)];
    this.editMemberQuery = '';
    setTimeout(() => {
      if (this.editMemberChipWrapper) {
        this.editMemberPickerWidth = this.editMemberChipWrapper.nativeElement.offsetWidth || 500;
      }
    });
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

  saveEdit(keepInProgress: boolean): void {
    if (this.editingSessionId === null) return;
    this.store.updateSession(this.editingSessionId, this.editDate, this.editNotes, [...this.editPayments], [...this.editAttendees], {
      time: this.editTime,
      venue: this.editVenue,
      courtFee: this.editCourtFee,
      shuttleCount: this.editShuttleCount,
      shuttlePrice: this.editShuttlePrice
    }, { keepInProgress });
    if (!this.store.errorMessage) this.editingSessionId = null;
  }
}
