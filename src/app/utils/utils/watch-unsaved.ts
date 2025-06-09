import { AbstractControl } from '@angular/forms';
import { BeforeUnloadService } from '../../services/before-unload.service';

export function watchForUnsavedChanges(control: AbstractControl, unload: BeforeUnloadService) {
  const sub = control.valueChanges.subscribe(() => {
    if (control.dirty) {
      unload.enable();
    } else {
      unload.disable();
    }
  });

  // Поддержка ручного сброса dirty
  const original = control.markAsPristine?.bind(control);
  if (original) {
    control.markAsPristine = (...args: any[]) => {
      unload.disable();
      return original(...args);
    };
  }

  return sub;
}
