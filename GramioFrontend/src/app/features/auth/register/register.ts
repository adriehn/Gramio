
import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
    selector: 'app-register',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink],
    templateUrl: './register.html',
    styleUrl: './register.css'
})
export class RegisterComponent {
    private readonly supabase = inject(SupabaseService).client;
    private readonly router = inject(Router);

    readonly isSubmitting = signal(false);
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

    async handleRegister(): Promise<void> {
        this.errorMessage.set('');
        this.successMessage.set('');

        if (
            !this.displayName.trim() ||
            !this.email.trim() ||
            !this.password ||
            !this.birthDate ||
            this.heightCm === null
        ) {
            this.errorMessage.set('Completá todos los campos.');
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
            const { data, error } = await this.supabase.auth.signUp({
                email: this.email.trim(),
                password: this.password,
                options: {
                    data: {
                        display_name: this.displayName.trim(),
                        sex: this.sex,
                        birth_date: this.birthDate,
                        height_cm: this.heightCm
                    }
                }
            });

            if (error) {
                throw error;
            }

            if (!data.user) {
                throw new Error('Supabase no devolvió el usuario registrado.');
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
            const message =
                error instanceof Error
                    ? error.message
                    : 'No se pudo completar el registro.';

            this.errorMessage.set(message);
        } finally {
            this.isSubmitting.set(false);
        }
    }
}
