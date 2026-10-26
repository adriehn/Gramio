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

  readonly session = signal<Session | null>(null);
  readonly userProfile = signal<UserProfile | null>(null);
  readonly isLoading = signal(true);
  readonly currentError = signal<AppError | null>(null);

  readonly isAuthenticated = computed(() => this.session() !== null);
  readonly userEmail = computed(() => this.userProfile()?.email ?? '');

  constructor() {
    void this.initSession();
  }

  /**
   * Inicializa el estado de autenticación y escucha cambios de Supabase.
   */
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

      // Evita sobrescribir un cambio de autenticación más reciente.
      if (this.authStateVersion === initialVersion) {
        this.updateState(data.session);
      }
    } catch (err) {
      // No reemplaza el estado si Supabase notificó un cambio mientras
      // se recuperaba la sesión inicial.
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

  /**
   * Mantiene sincronizados la sesión y el perfil del usuario.
   */
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
   * Registra una nueva cuenta.
   */
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

  /**
   * Cierra la sesión actual.
   */
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

  /**
 * Actualiza datos personales
 */
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
      this.currentError.set(normalizeAppError(err, 'No se pudieron actualizar los datos de la cuenta.'));
      return false;
    }
  }
   /**
 * Actualiza email del usuario
 */
  async updateEmail(email: string): Promise<boolean> {
    this.clearError();
    try {
      const { error } = await this.supabase.auth.updateUser({ email });
      if (error) throw error;
      return true;
    } catch (err) {
      this.currentError.set(normalizeAppError(err, 'No se pudo actualizar el email.'));
      return false;
    }
  }
  /**
   * Limpia el error mostrado por la interfaz.
   */
  clearError(): void {
    this.currentError.set(null);
  }

  /**
   * Libera la suscripción al destruirse el servicio.
   */
  ngOnDestroy(): void {
    this.authSubscription?.unsubscribe();
    this.authSubscription = null;
  }
}