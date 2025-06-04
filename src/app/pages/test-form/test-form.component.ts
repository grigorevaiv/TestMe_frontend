import { Component, effect, inject } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { State, Test } from '../../interfaces/test.interface';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
//import { CacheService } from '../../services/cache.service';
import { ResourceService } from '../../services/resource.service';
import { TestService } from '../../services/test.service';
import { ValidationService } from '../../services/validation.service';
import { SentencecasePipe } from '../../pipes/sentencecase.pipe';
import { ToastService } from '../../services/toast.service';
import { ProgressBarComponent } from '../../components/progress-bar/progress-bar.component';
import { TagChipsComponent } from '../../components/tag-chips/tag-chips.component';
import { stepRoutes } from '../../constants/step-routes';
import { SessionStorageService } from '../../services/session-storage.service';

@Component({
  selector: 'app-test-form',
  standalone: true,
  imports: [ReactiveFormsModule, SentencecasePipe, ProgressBarComponent, TagChipsComponent],
  templateUrl: './test-form.component.html',
  styleUrl: './test-form.component.css'
})

export class TestFormComponent {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  //private cacheService = inject(CacheService);
  private testService = inject(TestService);
  private validationService = inject(ValidationService);
  private resourceService = inject(ResourceService);
  private toast = inject(ToastService);
  private sessionStorage = inject(SessionStorageService);

  private testId: number | null = null;
  private mode: string = '';
  step: number = 1;
  completedSteps: number[] = [];
  testState: State | null = null;

  // можно использовать реальные, но для теста оставим статичные
  suggestedTags = [
    'interests', 'intelligence', 'personality', 
    'motivation', 'values', 'self-esteem',
    'emotional intelligence', 'problem-solving',
    'anxiety', 'depression'
  ]

  testForm = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(15)]],
    author: [''],
    version: [''],
    description: ['', [Validators.required, Validators.minLength(100)]],
    instructions: ['', [Validators.required, Validators.minLength(250)]],
    tags: this.fb.control<string[]>([])
  });

  constructor() {
  effect(() => {
    if (this.testId) {
      console.log('[TestFormComponent] Test ID:', this.testId);
      this.testState = this.resourceService.testResource.value()?.state ?? null;
      if (this.testState) {
        console.log('Test state:', this.testState);
      }
    }
  });
}

ngOnInit() {
  this.initRouteParams();
  this.step = 1;
}

private initRouteParams(): void {
  this.route.paramMap.subscribe((params) => {
    this.mode = params.get('mode') || 'new';
    const idParam = params.get('testId');
    console.log('Mode:', this.mode);

    if (idParam) {
      this.testId = Number(idParam);
      this.sessionStorage.setTestId(this.testId);
      this.loadTestData(this.testId);
    } 
  });
}

  getError(field: string): string | null {
    const control = this.testForm.get(field);
    return control && control.touched ? this.validationService.getErrorMessage(control, field) : null;
  }

  loadTestData(testId: number) {
  this.testService.getTestById(testId).subscribe((test) => {
    console.log('[loadTestData] пришли теги:', test.tags);
      this.testForm.patchValue({
        title: test.title,
        author: test.author,
        version: test.version,
        description: test.description,
        instructions: test.instructions,
        tags: test.tags || []
      });
    }); 
  }

  get currentTags(): string[] {
    return this.testForm.get('tags')?.value || [];
  }

  async saveTest(navigate: boolean = false): Promise<void> {
    const test: Test = this.testForm.value as Test;
    console.log('[saveTest] Called with test:', test);
    console.log('This is what we would send:', test);

    if (!this.testForm.valid) {
      this.testForm.markAllAsTouched();
      this.toast.show({
        message: 'Please fill in all required fields correctly',
        type: 'warning'
      });
      return;
    }

    try {
      let savedTest: Test;

      if (this.testId) {
        console.log('[saveTest] Updating test:', this.testId);
        savedTest = await firstValueFrom(this.testService.updateTest(this.testId, test));
        this.toast.show({
          message: 'Test updated successfully',
          type: 'success'
        });
      } else {
        console.log('[saveTest] Creating new test...');
        savedTest = await firstValueFrom(this.testService.addTest(test));
        this.toast.show({
          message: 'Test created successfully',
          type: 'success'
        });
        console.log('[saveTest] Received from addTest:', savedTest);

        if (!savedTest || !savedTest.id) {
          console.error('[saveTest] Test ID is not defined after creation:', savedTest);
          return;
        }

        this.testId = savedTest.id;
        this.sessionStorage.setTestId(savedTest.id);
      }

      console.log('[saveTest] Saved test:', savedTest);

      if (navigate) {
        const step = savedTest.state?.currentStep ?? 0;
        console.log('[saveTest] Step:', step);

        this.step = savedTest.state?.currentStep ?? 1;
        this.completedSteps.push(this.step);
        console.log('[saveTest] Completed steps:', this.completedSteps);

        this.resourceService.triggerRefresh();

        if (step === 1) {
          this.toast.show({
            message: 'Going to next step...',
            type: 'info'
          });

          setTimeout(() => {
            this.router.navigate(['/test-blocks/new/']);
          }, 700);

        } else if (step > 1) {
          if (!savedTest.id) {
            console.error('Cannot navigate to edit: savedTest.id is missing');
            return;
          }
          
          this.toast.show({
            message: 'Going to next step...',
            type: 'info'
          });

          setTimeout(() => {
            this.router.navigate(['/test-blocks/edit/', savedTest.id]);
          }, 700);
        } else {
          console.warn('Unknown step, cannot navigate');
        }
      }
    } catch (err) {
      console.error('[saveTest] Error:', err);
    }
  }

  onTagsChanged(tags: string[]) {
    console.log('[onTagsChange] Tags changed:', tags);
    this.testForm.patchValue({ tags });
  }

  get completedStepsArray(): number[] {
    if (!this.testState || !this.testState.currentStep) {
      return [];
    }
    console.log(Array.from({ length: this.testState.currentStep }, (_, i) => i + 1));
    return Array.from({ length: this.testState.currentStep }, (_, i) => i + 1);
  }

  onStepSelected(step: number) {
    if (!this.testId || !stepRoutes[step]) return;
    this.router.navigate(stepRoutes[step](this.testId));
  }
}


export default TestFormComponent;
