import { Component, effect, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { stepRoutes } from '../../constants/step-routes';
import { Test, User } from '../../interfaces/test.interface';
import { ResourceService } from '../../services/resource.service';
import { SessionStorageService } from '../../services/session-storage.service';
import { PatientResourceService } from '../../services/patient-resource.service';
import { ListItemComponent } from '../../components/list-item/list-item.component';

@Component({
  selector: 'app-patients',
  imports: [ListItemComponent],
  templateUrl: './patients.component.html',
  styleUrl: './patients.component.css'
})
export class PatientsComponent {
  resourceService = inject(ResourceService);
  route = inject(Router);
  router = inject (ActivatedRoute);
  sessionStorage = inject(SessionStorageService);
  resouceService = inject(PatientResourceService);
  patients: User[] = [];
  constructor() {
    effect(() => {
      const data = this.resouceService.patientsResource.value();
      if (data) {
      this.patients = data/*.filter((patient: User) => {
        return patient.assignedToAdmin && patient.isActive;
      });*/
      }
      console.log('Patients data:', this.patients);
    });
  }

  onCreatePatient(){
    this.route.navigate(['/patient/add']);
  }

  onEditPatient(patient: User) {
    this.route.navigate(['/patient/edit', patient.id]);
  }

  onViewResults(patient: User) {
    this.route.navigate(['/patient/history', patient.id]);
  }

  // todo: implement delete test functionality
  onDeletePatient(patient: User) {
  }
}
