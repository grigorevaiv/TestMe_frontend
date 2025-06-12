import { inject, Injectable, signal } from '@angular/core';
import { PatientService } from './patient.service';
import { of, filter, switchMap } from 'rxjs';
import { SessionStorageService } from './session-storage.service';
import { rxResource } from '@angular/core/rxjs-interop';

@Injectable({
  providedIn: 'root'
})
export class PatientResourceService {

  constructor() { }
  private patientService = inject(PatientService);
  private sessionStorage = inject(SessionStorageService);

  private refreshTrigger = signal(0);

  triggerRefresh() {
    this.refreshTrigger.update(v => v + 1);
  }

  private patientId$() {
    this.refreshTrigger();
    return of(this.sessionStorage.getPatientId()).pipe(
      filter((testId): testId is number => testId !== null)
    );
  }

  patientsResource = rxResource({
    request: () => {
      this.refreshTrigger();
      return {};             
    },
    loader: () => this.patientService.getPatients()
  });

  patientResource = rxResource({
    request: () => {
      this.refreshTrigger();
      return this.patientId$();
    },
    loader: ({ request }) =>
      request.pipe(
        switchMap((patientId) => this.patientService.getPatientById(patientId))
      )
  });


}
