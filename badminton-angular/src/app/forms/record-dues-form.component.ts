import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { TrackerStoreService } from '../state/tracker-store.service';

@Component({
  selector: 'app-record-dues-form',
  standalone: true,
  imports: [CommonModule, FormsModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule],
  templateUrl: './record-dues-form.component.html'
})
export class RecordDuesFormComponent {
  @Output() saved = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  constructor(public readonly store: TrackerStoreService) {}

  save(): void {
    this.store.saveDuesPayment();
    if (!this.store.errorMessage) this.saved.emit();
  }
}
