import { Component, effect, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { stepRoutes } from '../../constants/step-routes';
import { Test, User } from '../../interfaces/test.interface';
import { ResourceService } from '../../services/resource.service';
import { SessionStorageService } from '../../services/session-storage.service';
import { PatientResourceService } from '../../services/patient-resource.service';
import { ListItemComponent } from '../../components/list-item/list-item.component';
import { SearchFilterComponent } from '../../components/search-filter/search-filter.component';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';
import { PatientService } from '../../services/patient.service';
import { firstValueFrom } from 'rxjs';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-patients',
  imports: [ListItemComponent, SearchFilterComponent, ConfirmDialogComponent],
  templateUrl: './patients.component.html',
  styleUrl: './patients.component.css',
})
export class PatientsComponent {
  route = inject(Router);
  router = inject(ActivatedRoute);
  sessionStorage = inject(SessionStorageService);
  resouceService = inject(PatientResourceService);
  patientService = inject(PatientService);
  patients: User[] = [];
  filteredPatients: User[] = [];
  placeholder = 'Search patients...';
  confirmVisible = false;
  confirmMessage = '';
  private pendingAction: (() => void) | null = null;
  toast = inject(ToastService);

  constructor() {
    effect(() => {
      const data = this.resouceService.patientsResource.value();
      if (!data) return;
      if (data) {
        this.patients = data;
        this.filteredPatients = data;
      }
      console.log('Patients data:', this.patients);
    });
  }

  ngOnInit() {
    this.resouceService.triggerRefresh();
  }

  onCreatePatient() {
    this.route.navigate(['/patient/new']);
  }

  onEditPatient(patient: User) {
    this.route.navigate(['/patient/edit', patient.id]);
  }

  onViewResults(patient: User) {
    this.route.navigate(['/patient/history', patient.id]);
  }

  onDeletePatient(patient: User) {
    if (!patient.isActive) {
      this.toast.show({
        message: 'This patient is already inactive',
        type: 'warning',
      });
      return;
    }
    this.confirmMessage = 'Are you sure you want to deactivate this patient?';
    this.confirmVisible = true;
    this.pendingAction = async () => {
      await firstValueFrom(this.patientService.deactivatePatient(patient.id!));
      this.resouceService.triggerRefresh();
    };
  }

  onReactivatePatient(patient: User) {
    if (patient.isActive) {
      this.toast.show({
        message: 'This patient is already active',
        type: 'warning',
      });
      return;
    }
    this.confirmMessage = 'Do you want to reactivate this patient?';
    this.confirmVisible = true;
    this.pendingAction = async () => {
      await firstValueFrom(this.patientService.reactivatePatient(patient.id!));
      this.resouceService.triggerRefresh();
    };
  }

  onConfirmDialog() {
    this.confirmVisible = false;
    if (this.pendingAction) {
      this.pendingAction();
      this.pendingAction = null;
    }
  }

  onCancelDialog() {
    this.confirmVisible = false;
    this.pendingAction = null;
  }
}
