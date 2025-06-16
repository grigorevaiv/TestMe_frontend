import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { TestService } from '../../services/test.service';
import { ToastService } from '../../services/toast.service';
import { PatientService } from '../../services/patient.service';
import { SessionStorageService } from '../../services/session-storage.service';
import { PlayTestService } from '../../patient/services/play-test.service';
import { ResourceService } from '../../services/resource.service';
import { HeaderComponent } from '../../patient/components/header/header.component';
import { FooterComponent } from '../../patient/components/footer/footer.component';
import { NgIf } from '@angular/common';

@Component({
  selector: 'app-verify-email',
  imports: [ReactiveFormsModule, HeaderComponent, FooterComponent, NgIf],
  templateUrl: './verify-email.component.html',
  styleUrl: './verify-email.component.css',
})
export class VerifyEmailComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toast = inject(ToastService);
  private patientService = inject(PatientService);
  private fb = inject(FormBuilder);
  private sessionStorage = inject(SessionStorageService);
  private playTestService = inject(PlayTestService);
  private resources = inject(ResourceService);

  token = '';
  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });
  
  invitationInfo: {
    userFullName: string;
    testTitle: string;
    invitedBy: string;
  } | null = null;

  ngOnInit() {
    this.token = this.route.snapshot.paramMap.get('token')!;
    this.patientService.getInvitationInfo(this.token).subscribe({
    next: (info) => {
      this.invitationInfo = info;
      console.log('Invitation Info:', info);
    },
    error: (err) => {
        this.toast.show({ message: 'Invalid or expired link', type: 'error' });
        this.router.navigate(['/']);
      }
    });
  }

  async submit() {
    if (this.form.invalid || !this.token) return;
    const email = this.form.value.email?.trim();
    try {
      const sessionInfo = await firstValueFrom(
        this.patientService.verifyInvitation(this.token, email!)
      );
      console.log('Session Info:', sessionInfo);
      this.toast.show({
        message: 'Email verified successfully!',
        type: 'success',
      });
      this.sessionStorage.setTestSession(sessionInfo);
      this.sessionStorage.setTestId(sessionInfo.testId);
      console.log('Session Info:', sessionInfo);
      await this.router.navigate(['/play-test', this.token], {
        state: { sessionInfo },
      });

      this.playTestService.init(sessionInfo);
    } catch (err: any) {
      console.error(err);
      this.toast.show({
        message: 'Invalid email or expired link',
        type: 'error',
      });
    }
  }
}
