import { Component, inject } from '@angular/core';
import { ToastService } from '../../services/toast.service';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [NgClass],
  templateUrl: './toast.component.html',
  styleUrl: './toast.component.css'
})
export class ToastComponent {
  toast = inject(ToastService).toast;

  getClass() {
    const type = this.toast()?.type;
    return {
      'bg-sky-600': type === 'info' || !type,
      'bg-emerald-600': type === 'success',
      'bg-red-600': type === 'error',
      'bg-yellow-500 text-black': type === 'warning',
    };
  }
}
