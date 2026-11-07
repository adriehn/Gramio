
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../core/services/auth.service';
import { AuthCredentials } from '../../../core/models/auth.model';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly credentials: AuthCredentials = {
    email: '',
    password: ''
  };

  readonly isSubmitting = signal(false);

  async handleLogin(): Promise<void> {
    if (this.isSubmitting()) return;

    if (
      !this.credentials.email.trim() ||
      !this.credentials.password
    ) {
      return;
    }

    this.isSubmitting.set(true);

    try {
      const success = await this.auth.signIn({
        ...this.credentials,
        email: this.credentials.email.trim()
      });

      if (success) {
        await this.router.navigate(['/nutricion']);
      }
    } finally {
      this.isSubmitting.set(false);
    }
  }

  async handleResendVerification(): Promise<void> {
    if (
      this.isSubmitting() ||
      !this.credentials.email.trim()
    ) {
      return;
    }

    this.isSubmitting.set(true);

    try {
      await this.auth.resendVerificationEmail(
        this.credentials.email.trim()
      );
    } finally {
      this.isSubmitting.set(false);
    }
  }

  async handleSignUp(): Promise<void> {
    if (this.isSubmitting()) return;

    if (
      !this.credentials.email.trim() ||
      !this.credentials.password
    ) {
      return;
    }

    this.isSubmitting.set(true);

    try {
      await this.auth.signUp({
        ...this.credentials,
        email: this.credentials.email.trim()
      });
    } finally {
      this.isSubmitting.set(false);
    }
  }

  async handleGoogleLogin(): Promise<void> {
    if (this.isSubmitting()) return;

    this.isSubmitting.set(true);

    const success = await this.auth.signInWithGoogle();

    if (!success) {
      this.isSubmitting.set(false);
    }
  }
}
