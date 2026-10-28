import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css'
})
export class Navbar {
  readonly auth = inject(AuthService);
  private router = inject(Router);

  logout() {
    this.auth.signOut()
      .then(() => {
        this.router.navigate(['/']);
      })
      .catch((error) => {
        console.error('Error al cerrar sesión:', error);
      });
  }
}