// services/before-unload.service.ts
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class BeforeUnloadService {
  private enabled = false;

  enable() {
    if (!this.enabled) {
      window.addEventListener('beforeunload', this.handleBeforeUnload);
      this.enabled = true;
    }
  }

  disable() {
    if (this.enabled) {
      window.removeEventListener('beforeunload', this.handleBeforeUnload);
      this.enabled = false;
    }
  }

  private handleBeforeUnload = (event: BeforeUnloadEvent) => {
    event.preventDefault();
    event.returnValue = '';
  };
}
