
import {
  Injectable,
  OnDestroy,
  computed,
  inject,
  signal
} from '@angular/core';
import { Session } from '@supabase/supabase-js';

import { SupabaseService } from './supabase.service';
import { AuthCredentials, UserProfile } from '../models/auth.model';
import { AppError } from '../models/app-error.model';
import { normalizeAppError } from '../utils/error-handler.util';

@Injectable({
  providedIn: 'root'
})
export class AuthService implements OnDestroy {
  private readonly supabase = inject(SupabaseService).client;

  private authSubscription: { unsubscribe: () => void } | null = null;
  private authStateVersion = 0;

  private resendCooldownInterval: ReturnType<typeof setInterval> | null = null;

  readonly session = signal<Session | null>(null);
  readonly userProfile = signal<UserProfile | null>(null);
  readonly isLoading = signal(true);
  readonly currentError = signal<AppError | null>(null);

  // Verificación de email
  readonly needsEmailConfirmation = signal(false);
  readonly isResendingVerification = signal(false);
  readonly verificationResendSent = signal(false);
  readonly verificationResendError = signal<string | null>(null);
  readonly resendCooldown = signal(0);

  readonly isAuthenticated = computed(() => this.session() !== null);
  readonly userEmail = computed(() => this.userProfile()?.email ?? '');

  constructor() {
    void this.initSession();
  }

  private async initSession(): Promise<void> {
    this.authSubscription = this.supabase.auth.onAuthStateChange(
      (_event, session) => {
        this.authStateVersion++;
        this.updateState(session);
        this.isLoading.set(false);
      }
    ).data.subscription;

    const initialVersion = this.authStateVersion;

    try {
      const { data, error } = await this.supabase.auth.getSession();

      if (error) {
        throw error;
      }

      if (this.authStateVersion === initialVersion) {
        this.updateState(data.session);
      }
    } catch (err) {
      if (this.authStateVersion === initialVersion) {
        this.currentError.set(
          normalizeAppError(
            err,
            'No se pudo recuperar la sesión activa.'
          )
        );

        this.updateState(null);
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  private updateState(session: Session | null): void {
    this.session.set(session);

    const user = session?.user;

    if (!user) {
      this.userProfile.set(null);
      return;
    }

    this.userProfile.set({
      id: user.id,
      email: user.email ?? '',
      displayName: user.user_metadata?.['display_name']
    });
  }

  /**
   * Inicia sesión con email y contraseña.
   */
  async signIn(credentials: AuthCredentials): Promise<boolean> {
    this.clearError();

    try {
      const { error } = await this.supabase.auth.signInWithPassword(
        credentials
      );

      if (error) {
        throw error;
      }

      return true;
    } catch (err) {
      const errorCode = (err as { code?: string })?.code;

      if (errorCode === 'email_not_confirmed') {
        this.needsEmailConfirmation.set(true);
        return false;
      }

      this.currentError.set(
        normalizeAppError(
          err,
          'No fue posible iniciar sesión. Verificá tus credenciales.'
        )
      );

      return false;
    }
  }

  /**
   * Reenvía el correo de confirmación de cuenta.
   */
  async resendVerificationEmail(email: string): Promise<boolean> {
    if (
      this.isResendingVerification() ||
      this.resendCooldown() > 0
    ) {
      return false;
    }

    this.isResendingVerification.set(true);
    this.verificationResendSent.set(false);
    this.verificationResendError.set(null);

    try {
      const { error } = await this.supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/login`
        }
      });

      if (error) {
        throw error;
      }

      this.verificationResendSent.set(true);
      this.startResendCooldown();

      return true;
    } catch (err) {
      this.verificationResendError.set(
        normalizeAppError(
          err,
          'No se pudo reenviar el correo. Intentá nuevamente más tarde.'
        ).userMessage
      );

      return false;
    } finally {
      this.isResendingVerification.set(false);
    }
  }

  /**
   * Inicia el tiempo de espera entre reenvíos.
   */
  private startResendCooldown(): void {
    this.clearResendCooldown();

    this.resendCooldown.set(60);

    this.resendCooldownInterval = setInterval(() => {
      const remaining = this.resendCooldown();

      if (remaining <= 1) {
        this.clearResendCooldown();
        return;
      }

      this.resendCooldown.set(remaining - 1);
    }, 1000);
  }

  private clearResendCooldown(): void {
    if (this.resendCooldownInterval) {
      clearInterval(this.resendCooldownInterval);
      this.resendCooldownInterval = null;
    }

    this.resendCooldown.set(0);
  }

  async signUp(credentials: AuthCredentials): Promise<boolean> {
    this.clearError();

    try {
      const { error } = await this.supabase.auth.signUp(credentials);

      if (error) {
        throw error;
      }

      return true;
    } catch (err) {
      this.currentError.set(
        normalizeAppError(
          err,
          'No fue posible registrar la cuenta. Verificá los datos ingresados.'
        )
      );

      return false;
    }
  }

  async signOut(): Promise<void> {
    this.clearError();

    try {
      const { error } = await this.supabase.auth.signOut();

      if (error) {
        throw error;
      }
    } catch (err) {
      this.currentError.set(
        normalizeAppError(
          err,
          'No se pudo cerrar la sesión correctamente.'
        )
      );
    }
  }

  async updateAccount(email: string, displayName: string): Promise<boolean> {
    this.clearError();

    try {
      const { error } = await this.supabase.auth.updateUser({
        email,
        data: { display_name: displayName }
      });

      if (error) throw error;

      return true;
    } catch (err) {
      this.currentError.set(
        normalizeAppError(
          err,
          'No se pudieron actualizar los datos de la cuenta.'
        )
      );

      return false;
    }
  }

  async updateEmail(email: string): Promise<boolean> {
    this.clearError();

    try {
      const { error } = await this.supabase.auth.updateUser({ email });

      if (error) throw error;

      return true;
    } catch (err) {
      this.currentError.set(
        normalizeAppError(err, 'No se pudo actualizar el email.')
      );

      return false;
    }
  }

  clearError(): void {
    this.currentError.set(null);
    this.needsEmailConfirmation.set(false);
    this.verificationResendSent.set(false);
    this.verificationResendError.set(null);
  }

  async signInWithGoogle(): Promise<boolean> {
    this.clearError();

    try {
      const { error } = await this.supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/registro?google=1`,
          queryParams: {
            prompt: 'select_account'
          }
        }
      });

      if (error) throw error;

      return true;
    } catch (err) {
      this.currentError.set(
        normalizeAppError(
          err,
          'No fue posible iniciar sesión con Google.'
        )
      );

      return false;
    }
  }

  ngOnDestroy(): void {
    this.authSubscription?.unsubscribe();
    this.authSubscription = null;
    this.clearResendCooldown();
  }
}
