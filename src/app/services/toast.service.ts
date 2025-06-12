import { Injectable, signal } from '@angular/core';


export interface Toast {
  id?: number;
  message: string;
  type?: 'info' | 'success' | 'error' | 'warning';
  visible?: boolean; 
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private counter = 0;
  toasts = signal<Toast[]>([]);

  show(toast: Toast) {
    const id = ++this.counter;
    const fullToast = { ...toast, id, visible: true };
    this.toasts.update((list) => [...list, fullToast]);

    setTimeout(() => this.dismiss(id), 5000);
  }

  dismiss(id: number) {
    this.toasts.update((list) =>
      list.map((t) => (t.id === id ? { ...t, visible: false } : t))
    );

    setTimeout(() => {
      this.toasts.update((list) => list.filter((t) => t.id !== id));
    }, 300);
  }
}


