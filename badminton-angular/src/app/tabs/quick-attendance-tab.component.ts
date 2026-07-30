import { CommonModule } from '@angular/common';
import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatAutocomplete, MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatChipsModule } from '@angular/material/chips';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { TrackerStoreService } from '../state/tracker-store.service';

@Component({
  selector: 'app-quick-attendance-tab',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatAutocompleteModule,
    MatChipsModule,
    MatCheckboxModule,
    MatIconModule
  ],
  templateUrl: './quick-attendance-tab.component.html'
})
export class QuickAttendanceTabComponent implements AfterViewInit {
  @ViewChild('memberInput') memberInputEl?: ElementRef<HTMLInputElement>;
  @ViewChild('membersAuto') membersAuto?: MatAutocomplete;
  @ViewChild('memberChipWrapper') memberChipWrapper?: ElementRef<HTMLDivElement>;

  memberPickerWidth = 500;

  constructor(public readonly store: TrackerStoreService, private readonly cdr: ChangeDetectorRef) {}

  ngAfterViewInit(): void {
    if (this.memberChipWrapper) {
      this.memberPickerWidth = this.memberChipWrapper.nativeElement.offsetWidth || 500;
      this.cdr.detectChanges();
    }
  }

  onSessionChange(sessionId: number): void {
    this.store.setQuickAttendanceSession(sessionId);
    this.store.quickAttendanceQuery = '';
  }

  onOptionSelected(event: MatAutocompleteSelectedEvent): void {
    const member: string = event.option.value;
    // Immediately add to session attendance (one step)
    this.store.addQuickAttendanceMember(member);
    this.store.quickAttendanceQuery = '';
    if (this.memberInputEl) {
      this.memberInputEl.nativeElement.value = '';
    }
    // Re-open autocomplete for next pick
    setTimeout(() => {
      if (this.memberInputEl) {
        this.memberInputEl.nativeElement.focus();
        this.memberInputEl.nativeElement.dispatchEvent(new Event('input'));
      }
    });
  }

  removeFromSession(member: string): void {
    this.store.removeQuickAttendanceMember(member);
  }
}
