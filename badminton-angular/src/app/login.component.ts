import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  templateUrl: './login.component.html'
})
export class LoginComponent {
  username = '';
  password = '';
  submitting = false;

  constructor(public readonly auth: AuthService) {}

  async submit(): Promise<void> {
    if (!this.username.trim() || !this.password) return;

    this.submitting = true;
    try {
      await this.auth.login(this.username.trim().toLowerCase(), this.password);
      // Deliberately stay in the submitting state on success: the app shell
      // replaces this screen once auth state propagates, and resetting here
      // would flash an idle "Sign in" button in the gap.
    } catch {
      // auth.errorMessage already set by AuthService
      this.submitting = false;
    }
  }
}
