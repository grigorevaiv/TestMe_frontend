import { Component, effect, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Test } from '../../interfaces/test.interface';
import { ResourceService } from '../../services/resource.service';
import { PatientService } from '../../services/patient.service';
import { DatePipe, JsonPipe, NgFor, NgIf } from '@angular/common';
import { NgModel } from '@angular/forms';
import { ToastService } from '../../services/toast.service';
import { catchError, forkJoin, of } from 'rxjs';
import { TestService } from '../../services/test.service';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-view-results',
  imports: [NgIf, NgFor, JsonPipe, DatePipe],
  templateUrl: './view-results.component.html',
  styleUrl: './view-results.component.css'
})
export class ViewResultsComponent {

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private testResource = inject(ResourceService);
  private testService = inject(TestService);
  private patientService = inject(PatientService);
  private toast = inject(ToastService);
  patientId: number | null = null;
  patientEmail: string | null = null;
  tests: Test[] = [];
  patientFullName: string | null = null;

  constructor() {
    effect(() => {
      const data = this.testResource.testsResource.value();
      if (data) {
        const activeTests = data.filter(test => test.state?.state === 'active');
        this.tests = activeTests;
        console.log('Tests', this.tests);
      }
    });
  }

initializeRouteParams(): void {
  this.route.paramMap.subscribe((params) => {
    const idParam = params.get('patientId');
    if (idParam) {
      this.patientId = Number(idParam);
      console.log('Patient ID:', this.patientId);
      this.loadUserResults(this.patientId);
      this.patientService.getPatientById(this.patientId).subscribe({
        next: (patient) => {
          this.patientEmail = patient.email;
          this.patientFullName = `${patient.firstName} ${patient.lastName}`;
          console.log('Patient email:', this.patientEmail);
        },
        error: (err) => {
          console.error('Error on downloading patient:', err);
          this.toast.show({ message: 'Error on downloading patient', type: 'error' });
        }
      });

    } else {
      console.error('No patient ID found in route parameters');
    }
  });
}

  ngOnInit() {
    this.initializeRouteParams();
  }

  isModalOpen = false;
  selectedTestIds: number[] = [];

  openModal() {
    this.isModalOpen = true;
  }

  closeModal() {
    this.isModalOpen = false;
    this.selectedTestIds = []; 
  }

  toggleTestSelection(testId: number, checked: boolean) {
    if (checked) {
      this.selectedTestIds.push(testId);
    } else {
      this.selectedTestIds = this.selectedTestIds.filter(id => id !== testId);
    }
  }

  onCheckboxChange(event: Event, testId: number) {
    const input = event.target as HTMLInputElement;
    this.toggleTestSelection(testId, input.checked);
  }

  
  saveAssignedTests() {
    if (!this.patientId || !this.patientEmail) {
      this.toast.show({ message: 'Missing patient ID or email', type: 'error' });
      return;
    }

    const selectedTests = this.tests.filter(test => this.selectedTestIds.includes(test.id!));

    const requests = selectedTests.map(test => {
      const payload = {
        userId: this.patientId!,
        userEmail: this.patientEmail!,
        testId: test.id!
      };

    return this.patientService.assignTestToPatient(payload).pipe(
        catchError(error => {
          console.warn(`Test ${test.id} failed:`, error);
          const message = error instanceof HttpErrorResponse ? error.error.detail : 'An error occurred while assigning the test';
          this.toast.show({ message: message, type: 'error' });
          return of(null);
        })
      );
    });

    forkJoin(requests).subscribe(results => {
      const successCount = results.filter(r => r !== null).length;
      if (successCount > 0) {
        this.toast.show({ message: `${successCount} invitations sent successfully`, type: 'success' });
      }
      this.closeModal();
    });
  }

  results: any[] = [];

loadUserResults(userId: number) {
  this.testService.getAllResultsByUser(userId).subscribe({
    next: (data) => {
      this.results = data;
      console.log('История результатов:', this.results);
    },
    error: (err) => {
      console.error('Ошибка при получении истории результатов', err);
    }
  });
}



}
