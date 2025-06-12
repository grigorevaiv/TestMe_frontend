import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { NgIf } from '@angular/common';
import { environment } from '../../../environments/environment';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, NgIf],
  selector: 'app-admin-login',
  templateUrl: './admin-login.component.html'
})
export class AdminLoginComponent {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private router = inject(Router);

  baseUrl = environment.BASE_URL;

  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required]
  });

  loading = false;
  error: string | null = null;

  onSubmit() {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.error = null;

    const { email, password } = this.loginForm.value;

    this.http.post<{
      access_token: string;
      token_type: string;
      admin: { id: number; firstName: string; lastName: string };
    }>(`${this.baseUrl}/admins/login`, {
      email,
      password
    }).subscribe({
      next: (res) => {
        console.log('[Login successful]', res.access_token);
        localStorage.setItem('adminAccessToken', res.access_token);
        localStorage.setItem('admin_name', `${res.admin.firstName} ${res.admin.lastName}`);
        localStorage.setItem('admin_id', res.admin.id.toString());
        this.router.navigate(['/']);
      },
      error: (err) => {
        console.error('[Login error]', err);
        this.error = 'Invalid credentials. Please try again.';
        this.loading = false;
      }
    });
  }
}
