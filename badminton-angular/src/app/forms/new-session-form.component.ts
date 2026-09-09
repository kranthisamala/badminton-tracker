import { CommonModule } from '@angular/common';
import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, EventEmitter, Output, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatChipsModule } from '@angular/material/chips';
import { TrackerStoreService } from '../state/tracker-store.service';

@Component({
  selector: 'app-new-session-form',
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
    MatNativeDateModule,
    MatAutocompleteModule,
    MatChipsModule
  ],
  templateUrl: './new-session-form.component.html'
})
export class NewSessionFormComponent implements AfterViewInit {
  @Output() saved = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  @ViewChild('memberInput') memberInputEl?: ElementRef<HTMLInputElement>;
  @ViewChild('memberChipWrapper') memberChipWrapper?: ElementRef<HTMLDivElement>;

  memberPickerWidth = 500;
  sessionDateValue: Date | null = null;

  constructor(
    public readonly store: TrackerStoreService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngAfterViewInit(): void {
    if (this.memberChipWrapper) {
      this.memberPickerWidth = this.memberChipWrapper.nativeElement.offsetWidth || 500;
      this.cdr.detectChanges();
    }
  }

  onDateSelected(date: Date | null): void {
    this.store.newSessionDate = date ? this.formatDateLabel(date) : '';
  }

  onPlayerSelected(event: MatAutocompleteSelectedEvent): void {
    this.store.addNewSessionAttendee(Number(event.option.value));
    if (this.memberInputEl) this.memberInputEl.nativeElement.value = '';
    setTimeout(() => {
      if (this.memberInputEl) {
        this.memberInputEl.nativeElement.focus();
        this.memberInputEl.nativeElement.dispatchEvent(new Event('input'));
      }
    });
  }

  save(): void {
    this.store.addSession();
    if (!this.store.errorMessage) {
      this.sessionDateValue = null;
      this.saved.emit();
    }
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
