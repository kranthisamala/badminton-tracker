import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { AuthService, RoleRecord, UserRole } from '../auth.service';

@Component({
  selector: 'app-access-tab',
  standalone: true,
  imports: [CommonModule, MatButtonModule],
  templateUrl: './access-tab.component.html'
})
export class AccessTabComponent implements OnInit, OnDestroy {
  roles: (RoleRecord & { uid: string })[] = [];
  private unsubscribe: (() => void) | null = null;

  constructor(public readonly auth: AuthService) {}

  ngOnInit(): void {
    this.unsubscribe = this.auth.watchAllRoles(roles => {
      this.roles = roles.slice().sort((a, b) => a.username.localeCompare(b.username));
    });
  }

  ngOnDestroy(): void {
    this.unsubscribe?.();
  }

  setRole(uid: string, role: UserRole): void {
    this.auth.setRole(uid, role);
  }
}
