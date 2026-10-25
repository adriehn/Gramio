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
        await this.router.navigate(['/perfil']);
      }
    } catch (error) {
      console.error('Error al iniciar sesión:', error);
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
    } catch (error) {
      console.error('Error al registrarse:', error);
    } finally {
      this.isSubmitting.set(false);
    }
  }
}