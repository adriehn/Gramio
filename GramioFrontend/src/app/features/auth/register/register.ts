
import { CommonModule } from '@angular/common';
import {
  Component,
  OnInit,
  inject,
  signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ActivatedRoute,
  Router,
  RouterLink
} from '@angular/router';

import { SupabaseService } from '../../../core/services/supabase.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class RegisterComponent implements OnInit {
  private readonly supabase = inject(SupabaseService).client;
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly isSubmitting = signal(false);
  readonly isGoogleRegistration = signal(false);

  readonly errorMessage = signal('');
  readonly successMessage = signal('');

  readonly maxBirthDate = new Date().toISOString().slice(0, 10);

  displayName = '';
  email = '';

  password = '';
  confirmPassword = '';

  sex: 'male' | 'female' = 'male';
  birthDate = '';
  heightCm: number | null = null;

  async ngOnInit(): Promise<void> {
    // Ya no dependemos exclusivamente de ?google=1.
    // Comprobamos si existe una sesión Google cada vez que
    // se abre la pantalla de registro.
    await this.handleGoogleCallback();
  }

  private async handleGoogleCallback(): Promise<void> {
    const isGoogleCallback =
      this.route.snapshot.queryParamMap.get('google') === '1';

    try {
      const { data, error } = await this.supabase.auth.getSession();

      if (error) throw error;

      const user = data.session?.user;

      // Si no hay sesión y tampoco estamos regresando de Google,
      // dejamos funcionar normalmente el registro tradicional.
      if (!user) {
        if (isGoogleCallback) {
          throw new Error(
            'No se pudo recuperar la sesión de Google. Intentá nuevamente.'
          );
        }

        return;
      }

      const isGoogleUser =
        user.app_metadata?.['provider'] === 'google' ||
        user.identities?.some(
          identity => identity.provider === 'google'
        );

      // No interferimos con usuarios autenticados mediante email.
      if (!isGoogleUser) return;

      const metadata = user.user_metadata ?? {};

      this.displayName =
        metadata['display_name'] ??
        metadata['full_name'] ??
        metadata['name'] ??
        '';

      this.email = user.email ?? '';

      this.sex =
        metadata['sex'] === 'female' ? 'female' : 'male';

      this.birthDate = metadata['birth_date'] ?? '';

      this.heightCm =
        metadata['height_cm'] != null
          ? Number(metadata['height_cm'])
          : null;

      const hasCompleteProfile =
        !!this.displayName.trim() &&
        (metadata['sex'] === 'male' || metadata['sex'] === 'female') &&
        !!this.birthDate &&
        Number.isFinite(Number(metadata['height_cm'])) &&
        Number(metadata['height_cm']) >= 100 &&
        Number(metadata['height_cm']) <= 250;

      if (hasCompleteProfile) {
        // Aunque los metadatos estén completos, comprobamos que
        // también exista el registro correspondiente en profiles.
        await this.saveProfile(user.id, {
          display_name: this.displayName.trim(),
          sex: this.sex,
          birth_date: this.birthDate,
          height_cm: Number(this.heightCm)
        });

        await this.router.navigate(['/nutricion']);
        return;
      }

      // Usuario Google que todavía debe completar sus datos.
      this.isGoogleRegistration.set(true);

      // Limpiamos el parámetro de callback.
      if (isGoogleCallback) {
        await this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { google: null },
          queryParamsHandling: 'merge',
          replaceUrl: true
        });
      }

    } catch (error: unknown) {
      this.errorMessage.set(
        error instanceof Error
          ? error.message
          : 'No se pudo completar el inicio de sesión con Google.'
      );
    }
  }

  /**
   * Crea o actualiza el perfil del usuario autenticado.
   * La política RLS "own profile" permite operar únicamente
   * sobre el registro cuyo id coincide con auth.uid().
   */
  private async saveProfile(
    userId: string,
    profile: {
      display_name: string;
      sex: 'male' | 'female';
      birth_date: string;
      height_cm: number;
    }
  ): Promise<void> {
    const { error } = await this.supabase
      .from('profiles')
      .upsert(
        {
          id: userId,
          display_name: profile.display_name,
          sex: profile.sex,
          birth_date: profile.birth_date,
          height_cm: profile.height_cm
        },
        {
          onConflict: 'id'
        }
      );

    if (error) {
      throw new Error(
        `No se pudo guardar el perfil: ${error.message}`
      );
    }
  }

  async handleGoogleLogin(): Promise<void> {
    if (this.isSubmitting()) return;

    this.errorMessage.set('');
    this.auth.clearError();
    this.isSubmitting.set(true);

    const success = await this.auth.signInWithGoogle();

    if (!success) {
      this.errorMessage.set(
        this.auth.currentError()?.userMessage ??
        'No fue posible conectar con Google.'
      );

      this.isSubmitting.set(false);
    }
  }

  async handleRegister(): Promise<void> {
    if (this.isSubmitting()) return;

    this.errorMessage.set('');
    this.successMessage.set('');

    if (
      !this.displayName.trim() ||
      !this.email.trim() ||
      !this.birthDate ||
      this.heightCm === null
    ) {
      this.errorMessage.set('Completá todos los campos.');
      return;
    }

    // Las contraseñas solamente se exigen para el registro tradicional.
    if (!this.isGoogleRegistration()) {
      if (!this.password) {
        this.errorMessage.set('Ingresá una contraseña.');
        return;
      }

      if (this.password.length < 6) {
        this.errorMessage.set(
          'La contraseña debe tener al menos 6 caracteres.'
        );
        return;
      }

      if (this.password !== this.confirmPassword) {
        this.errorMessage.set('Las contraseñas no coinciden.');
        return;
      }
    }

    const date = new Date(`${this.birthDate}T00:00:00`);
    const today = new Date();

    today.setHours(0, 0, 0, 0);

    if (Number.isNaN(date.getTime()) || date >= today) {
      this.errorMessage.set(
        'Ingresá una fecha de nacimiento válida.'
      );
      return;
    }

    if (
      !Number.isFinite(this.heightCm) ||
      this.heightCm < 100 ||
      this.heightCm > 250
    ) {
      this.errorMessage.set(
        'La altura debe estar entre 100 y 250 cm.'
      );
      return;
    }

    this.isSubmitting.set(true);

    try {
      const profileMetadata = {
        display_name: this.displayName.trim(),
        sex: this.sex,
        birth_date: this.birthDate,
        height_cm: this.heightCm
      };

      if (this.isGoogleRegistration()) {
        // 1. Actualizamos los metadatos de Supabase Auth.
        const { data, error } =
          await this.supabase.auth.updateUser({
            data: profileMetadata
          });

        if (error) throw error;

        if (!data.user) {
          throw new Error(
            'No se pudo recuperar el usuario autenticado.'
          );
        }

        // 2. Creamos o actualizamos su fila en public.profiles.
        await this.saveProfile(data.user.id, {
          ...profileMetadata,
          height_cm: Number(profileMetadata.height_cm)
        });

        this.successMessage.set(
          '¡Tu perfil fue completado correctamente!'
        );

        await this.router.navigate(['/perfil']);
        return;
      }

      // Registro tradicional: conserva el comportamiento existente.
      const { data, error } = await this.supabase.auth.signUp({
        email: this.email.trim(),
        password: this.password,
        options: {
          data: profileMetadata
        }
      });

      if (error) throw error;

      if (!data.user) {
        throw new Error(
          'Supabase no devolvió el usuario registrado.'
        );
      }

      if (!data.session) {
        this.successMessage.set(
          'Tu cuenta fue creada. Revisá tu correo para confirmar el registro antes de iniciar sesión.'
        );
        return;
      }

      this.successMessage.set(
        '¡Tu cuenta fue creada correctamente!'
      );

      await this.router.navigate(['/perfil']);

    } catch (error: unknown) {
      this.errorMessage.set(
        error instanceof Error
          ? error.message
          : 'No se pudo completar el registro.'
      );
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
