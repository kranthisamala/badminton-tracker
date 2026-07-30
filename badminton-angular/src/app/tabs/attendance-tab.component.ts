import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { TrackerStoreService } from '../state/tracker-store.service';

@Component({
  selector: 'app-attendance-tab',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './attendance-tab.component.html'
})
export class AttendanceTabComponent {
  constructor(public readonly store: TrackerStoreService) {}
}
