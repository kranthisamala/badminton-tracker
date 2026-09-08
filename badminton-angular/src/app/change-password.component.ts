import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [CommonModule, FormsModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  templateUrl: './change-password.component.html'
})
export class ChangePasswordComponent {
  newPassword = '';
  confirmPassword = '';
  contactEmail = '';
  submitting = false;
  localError = '';

  constructor(public readonly auth: AuthService) {}

  async submit(): Promise<void> {
    this.localError = '';

    if (this.newPassword.length < 6) {
      this.localError = 'Password must be at least 6 characters.';
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.localError = 'Passwords do not match.';
      return;
    }

    this.submitting = true;
    try {
      await this.auth.completePasswordChange(this.newPassword, this.contactEmail);
    } catch {
      // auth.errorMessage already set by AuthService
    } finally {
      this.submitting = false;
    }
  }
}
