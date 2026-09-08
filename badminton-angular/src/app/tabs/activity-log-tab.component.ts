import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { collection, limit, onSnapshot, orderBy, query, Timestamp } from 'firebase/firestore';
import { db } from '../firebase.config';

export interface AuditLogEntry {
  uid: string;
  username: string;
  action: string;
  timestamp: Timestamp | null;
}

@Component({
  selector: 'app-activity-log-tab',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './activity-log-tab.component.html'
})
export class ActivityLogTabComponent implements OnInit, OnDestroy {
  entries: (AuditLogEntry & { id: string })[] = [];
  private unsubscribe: (() => void) | null = null;

  ngOnInit(): void {
    const auditQuery = query(collection(db, 'auditLog'), orderBy('timestamp', 'desc'), limit(200));
    this.unsubscribe = onSnapshot(auditQuery, snapshot => {
      this.entries = snapshot.docs.map(d => ({ id: d.id, ...(d.data() as AuditLogEntry) }));
    });
  }

  ngOnDestroy(): void {
    this.unsubscribe?.();
  }

  formatTimestamp(ts: Timestamp | null): string {
    if (!ts) return 'just now';
    return ts.toDate().toLocaleString('en-IN');
  }
}
