import { Component, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './contact.html',
  styleUrl: './contact.css',
})
export class ContactComponent {
  submitted = signal(false);

  readonly contactForm;

  constructor(private readonly fb: FormBuilder) {
    this.contactForm = this.fb.nonNullable.group({
      name: ['', [Validators.required, Validators.maxLength(100)]],
      email: ['', [Validators.required, Validators.email]],
      subject: ['Consulta general', Validators.required],
      message: ['', [Validators.required, Validators.maxLength(2000)]],
    });
  }

  onSubmit(): void {
    this.submitted.set(false);

    if (this.contactForm.invalid) {
      this.contactForm.markAllAsTouched();
      return;
    }

    // Pendiente: conectar con el endpoint de contacto.
    this.submitted.set(true);
    this.contactForm.reset({
      name: '',
      email: '',
      subject: 'Consulta general',
      message: '',
    });
  }
}