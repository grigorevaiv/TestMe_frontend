import { Component, effect, ElementRef, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Test } from '../../interfaces/test.interface';
import { ResourceService } from '../../services/resource.service';
import { PatientService } from '../../services/patient.service';
import { DatePipe, JsonPipe, NgClass, NgFor, NgIf } from '@angular/common';
import { ToastService } from '../../services/toast.service';
import { catchError, forkJoin, of } from 'rxjs';
import { TestService } from '../../services/test.service';
import { HttpErrorResponse } from '@angular/common/http';
import { TimeFilterComponent } from '../../components/time-filter/time-filter.component';
import { SearchFilterComponent } from '../../components/search-filter/search-filter.component';
declare let pdfMake: any;

@Component({
  selector: 'app-view-results',
  imports: [NgIf, NgFor, DatePipe, NgClass, TimeFilterComponent, SearchFilterComponent],
  templateUrl: './view-results.component.html',
  styleUrl: './view-results.component.css',
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
  isPatientActive: boolean = false;

  constructor() {
    effect(() => {
      const data = this.testResource.testsResource.value();
      if (data) {
        const activeTests = data.filter(
          (test) => test.state?.state === 'active'
        );
        this.tests = activeTests;
        console.log('Tests', this.tests);
      }
    });
  }

  ngOnInit() {
    this.initializeRouteParams();
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
            this.isPatientActive = patient.isActive!;
            console.log('Patient email:', this.patientEmail);
          },
          error: (err) => {
            console.error('Error on downloading patient:', err);
            this.toast.show({
              message: 'Error on downloading patient',
              type: 'error',
            });
          },
        });
      } else {
        console.error('No patient ID found in route parameters');
      }
    });
  }

  isModalOpen = false;
  selectedTestIds: number[] = [];

  openModal() {
    console.log('Patient email', this.patientEmail);
    console.log('Patient active', this.isPatientActive);
    if (!this.isPatientActive) {
      this.toast.show({
        message: 'You can assign tests only to active patients',
        type: 'warning',
      });
      return;
    }
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
      this.selectedTestIds = this.selectedTestIds.filter((id) => id !== testId);
    }
  }

  onCheckboxChange(event: Event, testId: number) {
    const input = event.target as HTMLInputElement;
    this.toggleTestSelection(testId, input.checked);
  }

  saveAssignedTests() {
    if (!this.patientId || !this.patientEmail) {
      this.toast.show({
        message: 'Missing patient ID or email',
        type: 'error',
      });
      return;
    }

    const selectedTests = this.tests.filter((test) =>
      this.selectedTestIds.includes(test.id!)
    );

    const requests = selectedTests.map((test) => {
      const payload = {
        userId: this.patientId!,
        userEmail: this.patientEmail!,
        testId: test.id!,
      };

      return this.patientService.assignTestToPatient(payload).pipe(
        catchError((error) => {
          console.warn(`Test ${test.id} failed:`, error);
          const message =
            error instanceof HttpErrorResponse
              ? error.error.detail
              : 'An error occurred while assigning the test';
          this.toast.show({ message: message, type: 'error' });
          return of(null);
        })
      );
    });

    forkJoin(requests).subscribe((results) => {
      const successCount = results.filter((r) => r !== null).length;
      if (successCount > 0) {
        this.toast.show({
          message: `${successCount} invitations sent successfully`,
          type: 'success',
        });
      }
      this.closeModal();
    });
  }

  results: any[] = [];
  filteredResults: any[] = [];
  dateFilter: { fromDate?: string; toDate?: string } = {};
  searchTerm: string = '';

  loadUserResults(userId: number) {
    this.testService.getAllResultsByUser(userId).subscribe({
      next: (data) => {
        this.results = data;
        this.reapplyFilters();
        console.log('History:', this.results);
      },
      error: (err) => {
        console.error('Error on obtaining history', err);
      },
    });
  }

  applyFilter(filter: { fromDate?: string; toDate?: string }) {
    this.dateFilter = filter;
    this.reapplyFilters();
  }

  applySearchTerm(term: string) {
    this.searchTerm = term.trim().toLowerCase();
    this.reapplyFilters();
  }

  reapplyFilters() {
    const from = this.dateFilter.fromDate ? new Date(this.dateFilter.fromDate) : null;
    const to = this.dateFilter.toDate ? new Date(this.dateFilter.toDate) : null;
    if (to) {
      to.setHours(23, 59, 59, 999);
    }

    this.filteredResults = this.results.filter((result) => {
      const date = new Date(result.createdAt);
      const matchesDate = (!from || date >= from) && (!to || date <= to);
      const matchesSearch = !this.searchTerm || this.searchMatches(result);
      return matchesDate && matchesSearch;
    });
  }

  searchMatches(result: any): boolean {
    return result.testTitle?.toLowerCase().includes(this.searchTerm);
  }

  groupByBlock(results: any[]): { block: string; scales: any[] }[] {
    const map = new Map<string, any[]>();
    for (const r of results) {
      const block = r.block || 'Other';
      if (!map.has(block)) {
        map.set(block, []);
      }
      map.get(block)!.push(r);
    }
    return Array.from(map.entries()).map(([block, scales]) => ({
      block,
      scales,
    }));
  }

  expandedResults: Set<number> = new Set();

  toggleExpand(id: number) {
    if (this.expandedResults.has(id)) {
      this.expandedResults.delete(id);
    } else {
      this.expandedResults.add(id);
    }
  }
}


