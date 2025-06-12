import { Routes } from '@angular/router';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { TestFormComponent } from './pages/test-form/test-form.component';
import { TestBlocksComponent } from './pages/test-blocks/test-blocks.component';
import { TestScalesComponent } from './pages/test-scales/test-scales.component';
import { TestAnswersComponent } from './pages/test-answers/test-answers.component';
import { TestInterpretationsComponent } from './pages/test-interpretations/test-interpretations.component';
import { TestNormsComponent } from './pages/test-norms/test-norms.component';
import { TestQuestionsComponent } from './pages/test-questions/test-questions.component';
import { TestWeightsComponent } from './pages/test-weights/test-weights.component';
import { PlayTestComponent } from './patient/components/play-test/play-test.component';
import { PatientsComponent } from './pages/patients/patients.component';
import { AddPatientComponent } from './pages/add-patient/add-patient.component';
import { ViewResultsComponent } from './pages/view-results/view-results.component';
import { VerifyEmailComponent } from './pages/verify-email/verify-email.component';
import { adminGuard } from './guards/auth.guard';
import { AdminLoginComponent } from './pages/admin-login/admin-login.component';
import { NotFoundComponent } from './components/not-found/not-found.component';
import { ThankYouComponent } from './patient/components/thank-you/thank-you.component';

export const routes: Routes = [
  {
    path: '',
    component: DashboardComponent,
    canActivate: [adminGuard]
  },
  {
    path: 'test/:mode',
    component: TestFormComponent,
    canActivate: [adminGuard]
  },
  {
    path: 'test/:mode/:testId',
    component: TestFormComponent,
    canActivate: [adminGuard]
  },
  {
    path: 'test-blocks/:mode',
    component: TestBlocksComponent,
    canActivate: [adminGuard]
  },
  {
    path: 'test-blocks/:mode/:testId',
    component: TestBlocksComponent,
    canActivate: [adminGuard]
  },
  {
    path: 'test-scales/:mode',
    component: TestScalesComponent,
    canActivate: [adminGuard]
  },
  {
    path: 'test-scales/:mode/:testId',
    component: TestScalesComponent,
    canActivate: [adminGuard]
  },
  {
    path: 'test-questions/:mode',
    component: TestQuestionsComponent,
    canActivate: [adminGuard]
  },
  {
    path: 'test-questions/:mode/:testId',
    component: TestQuestionsComponent,
    canActivate: [adminGuard]
  },
  {
    path: 'test-answers/:mode',
    component: TestAnswersComponent,
    canActivate: [adminGuard]
  },
  {
    path: 'test-answers/:mode/:testId',
    component: TestAnswersComponent,
    canActivate: [adminGuard]
  },
  {
    path: 'test-weights/:mode',
    component: TestWeightsComponent,
    canActivate: [adminGuard]
  },
  {
    path: 'test-weights/:mode/:testId',
    component: TestWeightsComponent,
    canActivate: [adminGuard]
  },
  {
    path: 'test-interpretations/:mode',
    component: TestInterpretationsComponent,
    canActivate: [adminGuard]
  },
  {
    path: 'test-interpretations/:mode/:testId',
    component: TestInterpretationsComponent,
    canActivate: [adminGuard]
  },
  {
    path: 'test-norms/:mode',
    component: TestNormsComponent,
    canActivate: [adminGuard]
  },
  {
    path: 'test-norms/:mode/:testId',
    component: TestNormsComponent,
    canActivate: [adminGuard]
  },
  {
    path: 'patients',
    component: PatientsComponent,
    canActivate: [adminGuard]
  },
    {
    path: 'patient/history/:patientId',
    component: ViewResultsComponent,
    canActivate: [adminGuard]
  },
  {
    path: 'patient/:mode',
    component: AddPatientComponent,
    canActivate: [adminGuard]
  },
  {
    path: 'patient/:mode/:patientId',
    component: AddPatientComponent,
    canActivate: [adminGuard]
  },
  // Незащищённые маршруты
  {
    path: 'play-test/:token/verify',
    component: VerifyEmailComponent
  },
  {
    path: 'play-test/:token',
    component: PlayTestComponent
  },
  {
    path: 'login',
    component: AdminLoginComponent
  },
  { path: 'thank-you', 
    component: ThankYouComponent 
  },
  {
    path: '**',
    component: NotFoundComponent,
  }
];



