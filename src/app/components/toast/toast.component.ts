import { Component, inject } from '@angular/core';
import { Toast, ToastService } from '../../services/toast.service';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [NgClass],
  templateUrl: './toast.component.html',
  styleUrl: './toast.component.css'
})

export class ToastComponent {
  toastService = inject(ToastService);
  toasts = this.toastService.toasts;

  getClass(toast: Toast) {
    return {
      'opacity-100 translate-y-0': toast.visible,
      'opacity-0 -translate-y-2': !toast.visible,
      'transition-all duration-300 ease-in-out': true,
      'bg-sky-600': toast.type === 'info' || !toast.type,
      'bg-emerald-600': toast.type === 'success',
      'bg-red-600': toast.type === 'error',
      'bg-yellow-500 text-black': toast.type === 'warning',
    };
  }

  dismiss(id: number) {
    this.toastService.dismiss(id);
  }
}


