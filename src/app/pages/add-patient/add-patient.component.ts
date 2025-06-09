import { Component, effect, inject } from '@angular/core';
import { SentencecasePipe } from '../../pipes/sentencecase.pipe';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ResourceService } from '../../services/resource.service';
import { ValidationService } from '../../services/validation.service';
import { PatientService } from '../../services/patient.service';
import { User } from '../../interfaces/test.interface';
import { first, firstValueFrom } from 'rxjs';
import { ToastService } from '../../services/toast.service';
import { PatientResourceService } from '../../services/patient-resource.service';
import { SessionStorageService } from '../../services/session-storage.service';

@Component({
  selector: 'app-add-patient',
  imports: [SentencecasePipe, ReactiveFormsModule],
  templateUrl: './add-patient.component.html',
  styleUrl: './add-patient.component.css'
})
export class AddPatientComponent {
  private fb = inject(FormBuilder);
  private validationService = inject(ValidationService);
  private patientService = inject(PatientService)
  private sessionStorage = inject(SessionStorageService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private resourceService = inject(PatientResourceService);
  private toast = inject(ToastService);
  private patient : User | null = null;
  private patientId: number | null = null;
  private adminId = 1; // Assuming admin ID is 1 for this example, later we can get it from session storage or auth service

  ngOnInit() {
    this.initRouteParams();
  }

  private initRouteParams(): void {
    this.route.paramMap.subscribe((params) => {
      const idParam = params.get('patientId');

      if (idParam) {
        this.patientId = Number(idParam);
        this.sessionStorage.setPatientId(this.patientId);
        this.loadPatientData(this.patientId);
      } 
    });
  }

  loadPatientData(patientId: number) {
    this.patientService.getPatientById(patientId).subscribe((patient) => {
      this.patient = patient;
      console.log('Loaded patient data:', patient);
      this.patientForm.patchValue({
        firstName: patient.firstName,
        lastName: patient.lastName,
        birthDate: patient.birthDate,
        email: patient.email,
      });
    }, (error) => {
      console.error('Error loading patient data:', error);
      this.toast.show({message: 'Failed to load patient data', type: 'error'});
    });
  }

  patientForm = this.fb.group({
    firstName: ['', [Validators.required]],
    lastName: ['', [Validators.required]],
    birthDate: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required, Validators.pattern(/^\+?[1-9]\d{1,14}$/)]],
    assignedToAdmin: [this.adminId, [Validators.required]]
  });

  getError(field: string): string | null {
    const control = this.patientForm.get(field);
    return control && control.touched ? this.validationService.getErrorMessage(control, field) : null;
  }

  async savePatient() {
    if(this.patient && this.patient.id) {
      if (this.patientForm.invalid) {
        this.patientForm.markAllAsTouched();
        return;
      }
      const patientData : User = this.patientForm.value as User;
      const updatedPatient = await firstValueFrom(this.patientService.updatePatient(patientData, this.patient.id));
      if(updatedPatient) {
        this.toast.show({message: 'Patient updated successfully', type: 'success'});
      }
    }
    else {
      if (this.patientForm.invalid) {
        this.patientForm.markAllAsTouched();
        return;
      }
      const patientData : User = this.patientForm.value as User;
      // here we have to assign an admin id to the patient data
      patientData.assignedToAdmin = 1; // Assuming admin ID is 1 for this example
      // but later we have to get the admin ID from the session storage or auth service
      console.log('Saving patient data:', patientData);

      const savedPatient = await firstValueFrom(this.patientService.createPatient(patientData));
      if(savedPatient) {
        this.toast.show({message: 'Patient created successfully', type: 'success'});
      }
    }
  }


}
