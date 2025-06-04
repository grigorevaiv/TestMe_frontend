import { Injectable, signal } from '@angular/core';

export interface Toast {
  message: string;
  type?: 'info' | 'success' | 'error' | 'warning';
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  toast = signal<Toast | null>(null);

  show(toast: Toast) {
    console.log('[TOAST] show called with:', toast);
    this.toast.set(toast);
    setTimeout(() => this.toast.set(null), 3000);
  }
}
