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

export const routes: Routes = [
  {
    path: '',
    component: DashboardComponent
  },
  {
    path: 'test/:mode',
    component: TestFormComponent
  },
  {
    path: 'test/:mode/:testId',
    component: TestFormComponent
  },
  {
    path: 'test-blocks/:mode',
    component: TestBlocksComponent
  },
  {
    path: 'test-blocks/:mode/:testId',
    component: TestBlocksComponent
  },
  {
    path: 'test-scales/:mode',
    component: TestScalesComponent
  },
  {
    path: 'test-scales/:mode/:testId',
    component: TestScalesComponent
  },
  {
    path: 'test-questions/:mode',
    component: TestQuestionsComponent
  },
  {
    path: 'test-questions/:mode/:testId',
    component: TestQuestionsComponent
  },
  {
    path: 'test-answers/:mode',
    component: TestAnswersComponent
  },
  {
    path: 'test-answers/:mode/:testId',
    component: TestAnswersComponent
  },
  {
    path: 'test-weights/:mode',
    component: TestWeightsComponent
  },
  {
    path: 'test-weights/:mode/:testId',
    component: TestWeightsComponent
  },
  {
    path: 'test-interpretations/:mode',
    component: TestInterpretationsComponent
  },
  {
    path: 'test-interpretations/:mode/:testId',
    component: TestInterpretationsComponent
  },
  {
    path: 'test-norms/:mode',
    component: TestNormsComponent
  },
  {
    path: 'test-norms/:mode/:testId',
    component: TestNormsComponent
  }
];

